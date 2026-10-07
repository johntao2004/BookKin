package com.elexvx.bookkin.ingestion;

import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.filemanagement.FileFingerprints;
import com.elexvx.bookkin.filemanagement.FileInspector;
import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class LibraryScanCoordinator {
    private static final Logger log = LoggerFactory.getLogger(LibraryScanCoordinator.class);
    private static final Set<String> INTERNAL = Set.of(".bookkin-trash", ".bookkin-staging", ".bookkin-versions", ".bookkin-cache", ".bookkin-assets");
    private final LibraryRootRepository roots;
    private final CatalogIngestionRepository catalog;
    private final FileFingerprints fingerprints;
    private final FileInspector inspector;
    private final BookMetadataExtractor metadataExtractor;
    private final BookKinProperties properties;

    public LibraryScanCoordinator(LibraryRootRepository roots, CatalogIngestionRepository catalog,
                                  FileFingerprints fingerprints, FileInspector inspector,
                                  BookMetadataExtractor metadataExtractor, BookKinProperties properties) {
        this.roots = roots;
        this.catalog = catalog;
        this.fingerprints = fingerprints;
        this.inspector = inspector;
        this.metadataExtractor = metadataExtractor;
        this.properties = properties;
    }

    public ScanSummary scanAll() {
        AtomicInteger seen = new AtomicInteger();
        AtomicInteger changed = new AtomicInteger();
        AtomicInteger failed = new AtomicInteger();
        for (LibraryRoot root : roots.findAll()) {
            if (!root.canRead() || root.status() == LibraryRoot.RootStatus.OFFLINE) continue;
            ScanSummary result = scan(root);
            seen.addAndGet(result.seen());
            changed.addAndGet(result.changed());
            failed.addAndGet(result.failed());
        }
        return new ScanSummary(seen.get(), changed.get(), failed.get());
    }

    private ScanSummary scan(LibraryRoot root) {
        UUID scanId = UUID.randomUUID();
        AtomicInteger seen = new AtomicInteger();
        AtomicInteger changed = new AtomicInteger();
        AtomicInteger failed = new AtomicInteger();
        Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath());
        try {
            var knownFingerprints = catalog.quickFingerprints(root.id());
            var unchangedPaths = new ArrayList<String>();
            int batchSize = Math.max(1, properties.scan().batchSize());
            Files.walkFileTree(rootPath, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult preVisitDirectory(Path directory, BasicFileAttributes attributes) {
                    return !directory.equals(rootPath) && isInternal(rootPath.relativize(directory))
                            ? FileVisitResult.SKIP_SUBTREE : FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path path, BasicFileAttributes attributes) {
                    if (!attributes.isRegularFile() || !isBook(path) || isInternal(rootPath.relativize(path))) {
                        return FileVisitResult.CONTINUE;
                    }
                    seen.incrementAndGet();
                    try {
                        String relative = Normalizer.normalize(rootPath.relativize(path).toString(), Normalizer.Form.NFC)
                                .replace('\\', '/');
                        String normalized = relative.toLowerCase(Locale.ROOT);
                        String quick = attributes.size() + ":" + attributes.lastModifiedTime().toMillis();
                        if (quick.equals(knownFingerprints.get(normalized))) {
                            unchangedPaths.add(normalized);
                            if (unchangedPaths.size() >= batchSize) {
                                var batch = new ArrayList<>(unchangedPaths);
                                unchangedPaths.clear();
                                catalog.touchBatch(root.id(), batch, scanId);
                            }
                            return FileVisitResult.CONTINUE;
                        }
                        BookFormat format = relative.toLowerCase(Locale.ROOT).endsWith(".epub") ? BookFormat.EPUB : BookFormat.PDF;
                        String fingerprint = fingerprints.sha256(path);
                        var inspection = inspector.inspect(path, format);
                        if (!inspection.parseable()) throw new IllegalArgumentException("文件无法解析");
                        var metadata = metadataExtractor.extract(path, format, rootPath, fingerprint);
                        var result = catalog.upsert(root.id(), relative, normalized, format, attributes, quick, fingerprint, inspection, metadata, scanId);
                        if (!result.imported()) {
                            log.info("Duplicate book content at {} matches catalog book {}", path, result.duplicateBookId());
                            return FileVisitResult.CONTINUE;
                        }
                        changed.incrementAndGet();
                        if (changed.get() % batchSize == 0) log.info("Scanned {} changed files in root {}", changed.get(), root.name());
                    } catch (Exception exception) {
                        failed.incrementAndGet();
                        log.warn("Skipping unreadable book {}: {}", path, exception.getMessage());
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path path, IOException exception) {
                    failed.incrementAndGet();
                    log.warn("Unable to visit {} during library scan: {}", path, exception.getMessage());
                    return FileVisitResult.CONTINUE;
                }
            });
            if (!unchangedPaths.isEmpty()) catalog.touchBatch(root.id(), unchangedPaths, scanId);
            if (failed.get() == 0) catalog.markMissing(root.id(), scanId);
            roots.recordScan(root.id());
        } catch (Exception exception) {
            log.error("Library scan failed for {}", root.name(), exception);
            failed.incrementAndGet();
        }
        return new ScanSummary(seen.get(), changed.get(), failed.get());
    }

    private boolean isBook(Path path) {
        String value = path.getFileName().toString().toLowerCase(Locale.ROOT);
        return value.endsWith(".epub") || value.endsWith(".pdf");
    }

    private boolean isInternal(Path relative) {
        return relative.getNameCount() > 0 && INTERNAL.contains(relative.getName(0).toString());
    }

    public record ScanSummary(int seen, int changed, int failed) {}
}
