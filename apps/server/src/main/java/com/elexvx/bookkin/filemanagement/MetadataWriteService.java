package com.elexvx.bookkin.filemanagement;

import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.BookMetadataRepository;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.ingestion.LibraryRoot;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.stereotype.Service;

// 元数据写回前把原文件登记到持久版本库；该版本同时作为跨文件与数据库事务的补偿快照。
// Persist the original file as a managed version before writeback; it also compensates failures across file and database changes.
@Service
public class MetadataWriteService {
    private final BookMetadataRepository metadataRepository;
    private final FileFingerprints fingerprints;
    private final FileInspector inspector;
    private final EpubMetadataWriter epubWriter;
    private final PdfMetadataWriter pdfWriter;
    private final FileVersionRepository versions;
    private final BookKinProperties properties;

    public MetadataWriteService(BookMetadataRepository metadataRepository, FileFingerprints fingerprints,
                                FileInspector inspector, EpubMetadataWriter epubWriter, PdfMetadataWriter pdfWriter,
                                FileVersionRepository versions, BookKinProperties properties) {
        this.metadataRepository = metadataRepository;
        this.fingerprints = fingerprints;
        this.inspector = inspector;
        this.epubWriter = epubWriter;
        this.pdfWriter = pdfWriter;
        this.versions = versions;
        this.properties = properties;
    }

    // 写临时文件、验证可读并刷盘后才替换原文件；调用方数据库更新失败时仍可恢复快照。
    // Replace the original only after validating and flushing the temporary file; callers can restore the snapshot if catalog updates fail.
    public WriteResult write(UUID operationId, BookFile file, LibraryRoot root, Path source, UUID actorId) throws IOException {
        var inspection = inspector.inspect(source, file.format());
        if (!inspection.parseable() || inspection.encrypted() || inspection.drmProtected() || inspection.digitallySigned()) {
            throw new IOException("受保护、损坏或带签名的文件禁止写回");
        }
        var metadata = metadataRepository.find(file.bookId()).orElseThrow();
        Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).toRealPath();
        Path canonicalSource = source.toRealPath();
        if (!canonicalSource.startsWith(rootPath) || Files.isSymbolicLink(source)) throw new IOException("原文件路径越过书库边界或包含软链接");

        Path archive = versionPath(rootPath, file.id(), operationId);
        createVersionDirectory(rootPath, archive.getParent());
        Path snapshot = archive.resolveSibling(".metadata-" + operationId + "-" + UUID.randomUUID() + ".snapshot");
        String originalFingerprint;
        boolean snapshotReserved = false;
        boolean archiveCreated = false;
        try {
            if (Files.exists(snapshot, java.nio.file.LinkOption.NOFOLLOW_LINKS)) throw new IOException("元数据版本暂存路径已存在");
            snapshotReserved = true;
            Files.copy(canonicalSource, snapshot, StandardCopyOption.COPY_ATTRIBUTES);
            force(snapshot);
            originalFingerprint = fingerprints.sha256(snapshot);
            if (!originalFingerprint.equals(file.fingerprint()) || !fingerprints.sha256(canonicalSource).equals(originalFingerprint)) {
                throw new IOException("原文件指纹已经变化");
            }
            // A duplicate operation must never replace or remove the prior managed version.
            Files.move(snapshot, archive);
            snapshotReserved = false;
            archiveCreated = true;
            versions.create(file.id(), root.id(), rootPath.relativize(archive).toString().replace('\\', '/'),
                    file.relativePath(), originalFingerprint, Files.size(archive), "METADATA_WRITE", actorId,
                    OffsetDateTime.now().plus(properties.retention().fileVersions()));
        } catch (Exception exception) {
            if (snapshotReserved) Files.deleteIfExists(snapshot);
            if (archiveCreated) Files.deleteIfExists(archive);
            if (exception instanceof IOException io) throw io;
            throw new IOException("无法登记元数据写回前的文件版本", exception);
        }

        Path temporary = source.resolveSibling(".bookkin-" + operationId + ".tmp");
        boolean replaced = false;
        try {
            Files.deleteIfExists(temporary);
            if (file.format() == BookFormat.EPUB) epubWriter.write(source, temporary, metadata, rootPath);
            else pdfWriter.write(source, temporary, metadata);
            inspector.assertReadable(temporary, file.format());
            force(temporary);
            String resultingFingerprint = fingerprints.sha256(temporary);
            if (!fingerprints.sha256(canonicalSource).equals(originalFingerprint)) {
                throw new IOException("写回期间原文件指纹发生变化");
            }
            Files.move(temporary, source, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            replaced = true;
            force(source);
            return new WriteResult(resultingFingerprint, originalFingerprint, archive);
        } catch (Exception exception) {
            Files.deleteIfExists(temporary);
            if (replaced) restoreSnapshot(operationId, file, rootPath, source, archive, originalFingerprint);
            if (exception instanceof IOException io) throw io;
            throw new IOException("元数据写回失败", exception);
        }
    }

    public void restoreOriginal(UUID operationId, BookFile file, LibraryRoot root, Path source, WriteResult result)
            throws IOException {
        Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).toRealPath();
        restoreSnapshot(operationId, file, rootPath, source, result.versionPath(), result.originalFingerprint());
    }

    private void restoreSnapshot(UUID operationId, BookFile file, Path rootPath, Path source, Path rollback,
                                 String originalFingerprint) throws IOException {
        Path candidate = rollback.normalize();
        if (!candidate.startsWith(rootPath) || Files.isSymbolicLink(candidate) || !Files.isRegularFile(candidate)) {
            throw new IOException("无法定位本次写回的临时回滚文件");
        }
        candidate = candidate.toRealPath();
        if (!candidate.startsWith(rootPath) || !fingerprints.sha256(candidate).equals(originalFingerprint)) {
            throw new IOException("临时回滚文件校验失败");
        }
        Path temporary = source.resolveSibling(".bookkin-rollback-" + operationId + ".tmp");
        Files.deleteIfExists(temporary);
        try {
            Files.copy(candidate, temporary, StandardCopyOption.COPY_ATTRIBUTES);
            force(temporary);
            inspector.assertReadable(temporary, file.format());
            Files.move(temporary, source, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            force(source);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private Path versionPath(Path rootPath, UUID fileId, UUID operationId) throws IOException {
        Path relative = Path.of(".bookkin-versions", fileId.toString(), "metadata-" + operationId + ".version");
        Path archive = rootPath.resolve(relative).normalize();
        if (!archive.startsWith(rootPath)) throw new IOException("元数据版本路径越过书库边界");
        Path current = rootPath;
        for (Path segment : relative) {
            current = current.resolve(segment);
            if (Files.isSymbolicLink(current)) throw new IOException("元数据版本路径不能包含软链接");
        }
        return archive;
    }

    private void createVersionDirectory(Path rootPath, Path directory) throws IOException {
        if (!directory.normalize().startsWith(rootPath)) throw new IOException("元数据版本目录越过书库边界");
        Path current = rootPath;
        for (Path segment : rootPath.relativize(directory)) {
            current = current.resolve(segment);
            if (Files.isSymbolicLink(current)) throw new IOException("元数据版本目录路径不能包含软链接");
            if (!Files.exists(current, java.nio.file.LinkOption.NOFOLLOW_LINKS)) Files.createDirectory(current);
            if (Files.isSymbolicLink(current) || !current.toRealPath().startsWith(rootPath)) {
                throw new IOException("元数据版本目录路径越过书库边界或包含软链接");
            }
        }
    }

    private void force(Path file) throws IOException {
        try (FileChannel channel = FileChannel.open(file, StandardOpenOption.WRITE)) {
            channel.force(true);
        }
    }

    public record WriteResult(String fingerprint, String originalFingerprint, Path versionPath) {}
}
