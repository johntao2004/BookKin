package io.github.johntao2004.bookkin.ingestion.upload;

import static io.github.johntao2004.bookkin.ingestion.upload.BookUploadModels.*;

import io.github.johntao2004.bookkin.ai.AiSettingsService;
import io.github.johntao2004.bookkin.catalog.BookFormat;
import io.github.johntao2004.bookkin.filemanagement.FileInspector;
import io.github.johntao2004.bookkin.ingestion.BookMetadataExtractor;
import io.github.johntao2004.bookkin.ingestion.CatalogIngestionRepository;
import io.github.johntao2004.bookkin.ingestion.ExtractedBook;
import io.github.johntao2004.bookkin.ingestion.LibraryRootRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class BookUploadProcessor {
    private final BookUploadRepository uploads;
    private final LibraryRootRepository roots;
    private final CatalogIngestionRepository catalog;
    private final FileInspector inspector;
    private final BookMetadataExtractor extractor;
    private final MetadataEnrichmentService enrichment;
    private final AiSettingsService aiSettings;

    public BookUploadProcessor(BookUploadRepository uploads, LibraryRootRepository roots, CatalogIngestionRepository catalog,
                               FileInspector inspector, BookMetadataExtractor extractor, MetadataEnrichmentService enrichment,
                               AiSettingsService aiSettings) {
        this.uploads = uploads;
        this.roots = roots;
        this.catalog = catalog;
        this.inspector = inspector;
        this.extractor = extractor;
        this.enrichment = enrichment;
        this.aiSettings = aiSettings;
    }

    @Async("bookUploadExecutor")
    public void process(java.util.UUID uploadId) {
        var upload = uploads.find(uploadId).orElse(null);
        if (upload == null || upload.status() != BookUploadStatus.INSPECTING) return;
        try {
            var root = roots.findById(upload.libraryRootId()).orElseThrow();
            Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).toRealPath();
            Path staged = resolveInternal(rootPath, upload.stagingPath());
            if (!Files.isRegularFile(staged) || Files.size(staged) != upload.declaredSizeBytes()) throw new IllegalArgumentException("上传文件不完整");
            var duplicate = catalog.duplicateBookId(upload.fingerprint());
            if (duplicate != null) {
                uploads.duplicate(upload.id(), duplicate);
                return;
            }
            var inspection = inspector.inspect(staged, upload.format());
            if (!inspection.parseable()) throw new IllegalArgumentException("文件无法被解析");
            ExtractedBook extracted = extractor.extract(staged, upload.format(), rootPath, upload.fingerprint());
            MetadataDraft detected = draft(extracted, upload.originalFilename(), upload.format());
            MetadataDraft ready = withTarget(detected, defaultTarget(detected, upload.format()));
            var ai = aiSettings.effective();
            var enrichmentResult = enrichment.enrich(ready, ai.enabled() && ai.autoMatch(), null, false);
            ready = enrichmentResult.draft();
            java.util.UUID[] similar = catalog.similarBooks(ready.title(), String.join(" / ", ready.authors()));
            CoverSource coverSource = upload.format() == BookFormat.PDF && extracted.pageCount() != null && extracted.pageCount() > 0
                    ? CoverSource.PDF_FIRST_PAGE : CoverSource.EMBEDDED;
            uploads.ready(upload.id(), inspection.encrypted(), inspection.drmProtected(), inspection.digitallySigned(),
                    detected, ready, enrichmentResult.candidates(), extracted.coverCacheKey(), coverSource, similar);
        } catch (Exception exception) {
            uploads.failed(uploadId, "INSPECTION_FAILED", safeMessage(exception));
        }
    }

    private MetadataDraft draft(ExtractedBook value, String originalFilename, BookFormat format) {
        Map<String, MetadataSource> sources = new HashMap<>();
        put(sources, "title", value.title(), filenameTitle(originalFilename).equals(value.title()) ? MetadataSource.FILENAME : MetadataSource.FILE);
        put(sources, "subtitle", value.subtitle(), MetadataSource.FILE);
        if (!value.authors().isEmpty()) sources.put("authors", MetadataSource.FILE);
        if (!value.translators().isEmpty()) sources.put("translators", MetadataSource.FILE);
        put(sources, "language", value.language(), MetadataSource.FILE);
        put(sources, "publisher", value.publisher(), MetadataSource.FILE);
        put(sources, "publishedDate", value.publishedDate(), MetadataSource.FILE);
        put(sources, "isbn", value.isbn(), MetadataSource.FILE);
        put(sources, "description", value.description(), MetadataSource.FILE);
        put(sources, "series", value.series(), MetadataSource.FILE);
        if (value.seriesIndex() != null) sources.put("seriesIndex", MetadataSource.FILE);
        if (!value.tags().isEmpty()) sources.put("tags", MetadataSource.FILE);
        return new MetadataDraft(value.title(), value.subtitle(), value.authors(), value.translators(), value.language(),
                value.publisher(), value.publishedDate(), value.isbn(), value.description(), value.series(),
                value.seriesIndex(), value.tags(), value.pageCount(), value.wordCount(), sources, null);
    }

    private MetadataDraft withTarget(MetadataDraft value, String target) {
        return new MetadataDraft(value.title(), value.subtitle(), value.authors(), value.translators(), value.language(),
                value.publisher(), value.publishedDate(), value.isbn(), value.description(), value.series(),
                value.seriesIndex(), value.tags(), value.pageCount(), value.wordCount(), value.sources(), target);
    }

    private String defaultTarget(MetadataDraft value, BookFormat format) {
        String author = value.authors().isEmpty() ? "未知作者" : value.authors().getFirst();
        return safeSegment(author) + "/" + safeSegment(value.title()) + "." + format.name().toLowerCase(Locale.ROOT);
    }

    private String safeSegment(String raw) {
        String value = raw == null ? "未命名" : raw.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", " ").replaceAll("\\s+", " ").strip();
        while (value.endsWith(".") || value.endsWith(" ")) value = value.substring(0, value.length() - 1);
        return value.isBlank() ? "未命名" : value.length() > 180 ? value.substring(0, 180).strip() : value;
    }

    private String filenameTitle(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    private Path resolveInternal(Path root, String relative) throws Exception {
        if (relative == null || !relative.startsWith(".bookkin-staging/uploads/")) throw new IllegalArgumentException("暂存路径无效");
        Path target = root.resolve(relative).normalize();
        if (!target.startsWith(root) || Files.isSymbolicLink(target)) throw new IllegalArgumentException("暂存路径越过书库");
        return target;
    }

    private void put(Map<String, MetadataSource> sources, String field, String value, MetadataSource source) {
        if (value != null && !value.isBlank()) sources.put(field, source);
    }

    private String safeMessage(Exception exception) {
        String value = exception.getMessage();
        return value == null || value.isBlank() ? "书籍识别失败" : value.substring(0, Math.min(500, value.length()));
    }
}
