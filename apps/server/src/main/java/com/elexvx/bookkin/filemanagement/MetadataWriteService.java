package com.elexvx.bookkin.filemanagement;

import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.BookMetadataRepository;
import com.elexvx.bookkin.ingestion.LibraryRoot;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import org.springframework.stereotype.Service;

// 当前写回保留操作级暂存快照用于补偿，成功后清理；不是可浏览的持久历史版本。
// Current writeback retains a temporary operation snapshot for compensation and removes it on success, not browsable persistent history.
@Service
public class MetadataWriteService {
    private final BookMetadataRepository metadataRepository;
    private final FileFingerprints fingerprints;
    private final FileInspector inspector;
    private final EpubMetadataWriter epubWriter;
    private final PdfMetadataWriter pdfWriter;

    public MetadataWriteService(BookMetadataRepository metadataRepository, FileFingerprints fingerprints,
                                FileInspector inspector, EpubMetadataWriter epubWriter, PdfMetadataWriter pdfWriter) {
        this.metadataRepository = metadataRepository;
        this.fingerprints = fingerprints;
        this.inspector = inspector;
        this.epubWriter = epubWriter;
        this.pdfWriter = pdfWriter;
    }

    // 写临时文件、验证可读并刷盘后才替换原文件；调用方数据库更新失败时仍可恢复快照。
    // Replace the original only after validating and flushing the temporary file; callers can restore the snapshot if catalog updates fail.
    public WriteResult write(UUID operationId, BookFile file, LibraryRoot root, Path source) throws IOException {
        var inspection = inspector.inspect(source, file.format());
        if (!inspection.parseable() || inspection.encrypted() || inspection.drmProtected() || inspection.digitallySigned()) {
            throw new IOException("受保护、损坏或带签名的文件禁止写回");
        }
        var metadata = metadataRepository.find(file.bookId()).orElseThrow();
        Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).toRealPath();
        Path rollback = rootPath.resolve(".bookkin-staging/metadata/" + operationId + "/original-" + source.getFileName()).normalize();
        if (!rollback.startsWith(rootPath)) throw new IOException("元数据暂存路径越过书库边界");
        Files.createDirectories(rollback.getParent());
        Files.copy(source, rollback, StandardCopyOption.COPY_ATTRIBUTES);
        force(rollback);
        String originalFingerprint = fingerprints.sha256(rollback);
        if (!originalFingerprint.equals(file.fingerprint())) {
            cleanup(rollback);
            throw new IOException("原文件指纹已经变化");
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
            Files.move(temporary, source, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            replaced = true;
            force(source);
            return new WriteResult(resultingFingerprint, originalFingerprint, rollback);
        } catch (Exception exception) {
            Files.deleteIfExists(temporary);
            if (replaced) restoreSnapshot(operationId, file, rootPath, source, rollback, originalFingerprint);
            cleanup(rollback);
            if (exception instanceof IOException io) throw io;
            throw new IOException("元数据写回失败", exception);
        }
    }

    public void restoreOriginal(UUID operationId, BookFile file, LibraryRoot root, Path source, WriteResult result)
            throws IOException {
        Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).toRealPath();
        restoreSnapshot(operationId, file, rootPath, source, result.rollbackPath(), result.originalFingerprint());
        cleanup(result.rollbackPath());
    }

    public void complete(WriteResult result) throws IOException {
        cleanup(result.rollbackPath());
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

    private void cleanup(Path rollback) throws IOException {
        Files.deleteIfExists(rollback);
        Path operationDirectory = rollback.getParent();
        if (operationDirectory != null && Files.isDirectory(operationDirectory)) {
            try (var entries = Files.list(operationDirectory)) {
                if (entries.findAny().isEmpty()) Files.deleteIfExists(operationDirectory);
            }
        }
    }

    private void force(Path file) throws IOException {
        try (FileChannel channel = FileChannel.open(file, StandardOpenOption.WRITE)) {
            channel.force(true);
        }
    }

    public record WriteResult(String fingerprint, String originalFingerprint, Path rollbackPath) {}
}
