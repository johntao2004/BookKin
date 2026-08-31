package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.catalog.BookFile;
import io.github.johntao2004.bookkin.catalog.BookFileStatus;
import io.github.johntao2004.bookkin.catalog.BookRepository;
import io.github.johntao2004.bookkin.config.BookKinProperties;
import io.github.johntao2004.bookkin.filemanagement.FileOperationRepository.ExecutionRecord;
import io.github.johntao2004.bookkin.ingestion.LibraryRoot;
import io.github.johntao2004.bookkin.ingestion.LibraryRootRepository;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class FileTransactionExecutor {
    private static final Logger log = LoggerFactory.getLogger(FileTransactionExecutor.class);
    private final FileOperationRepository operations;
    private final BookRepository books;
    private final LibraryRootRepository roots;
    private final RecycleBinRepository recycleBin;
    private final FileVersionRepository versions;
    private final FileLeaseRepository leases;
    private final FileFingerprints fingerprints;
    private final FileInspector inspector;
    private final MetadataWriteService metadataWriter;
    private final AuditService audit;
    private final BookKinProperties properties;
    private final PathPolicy pathPolicy;

    public FileTransactionExecutor(FileOperationRepository operations, BookRepository books, LibraryRootRepository roots,
                                   RecycleBinRepository recycleBin, FileVersionRepository versions,
                                   FileLeaseRepository leases, FileFingerprints fingerprints, FileInspector inspector,
                                   MetadataWriteService metadataWriter, AuditService audit, BookKinProperties properties,
                                   PathPolicy pathPolicy) {
        this.operations = operations;
        this.books = books;
        this.roots = roots;
        this.recycleBin = recycleBin;
        this.versions = versions;
        this.leases = leases;
        this.fingerprints = fingerprints;
        this.inspector = inspector;
        this.metadataWriter = metadataWriter;
        this.audit = audit;
        this.properties = properties;
        this.pathPolicy = pathPolicy;
    }

    public void execute(ExecutionRecord operation) {
        BookFile file = books.findFile(operation.bookFileId()).orElse(null);
        FileLeaseRepository.Lease lease = null;
        log.info("Starting file operation operationId={} type={}", operation.id(), operation.type());
        try {
            if (file == null) throw new OperationFailure("BOOK_FILE_MISSING", "数据库中的文件记录不存在");
            lease = waitForWriteLease(file.id(), operation.id());
            String result = switch (operation.type()) {
                case RENAME, MOVE -> move(operation, file);
                case TRASH -> trash(operation, file);
                case WRITE_METADATA -> writeMetadata(operation, file);
                case RESTORE -> restore(operation, file);
                case PURGE -> purge(operation, file);
            };
            operations.succeed(operation.id(), result);
            audit.record(operation.requestedBy(), operation.type().name(), "BOOK_FILE", file.id().toString(),
                    operation.sourcePath(), operation.targetPath(), operation.expectedFingerprint(), result, "SUCCEEDED", "{}");
            log.info("Completed file operation operationId={} type={}", operation.id(), operation.type());
        } catch (Exception exception) {
            String code = exception instanceof OperationFailure failure ? failure.code : "FILE_OPERATION_FAILED";
            boolean rolledBack = code.endsWith("_ROLLED_BACK") || code.equals("SOURCE_TRASH_FAILED");
            if (rolledBack) operations.rolledBack(operation.id(), code, safeMessage(exception));
            else operations.fail(operation.id(), code, safeMessage(exception));
            if (file != null && file.status() == BookFileStatus.OPERATING) {
                BookFileStatus fallback = operation.type() == FileOperationType.PURGE
                        || (operation.type() == FileOperationType.RESTORE && operation.recycleBinEntryId() != null)
                        ? BookFileStatus.TRASHED : BookFileStatus.AVAILABLE;
                books.updateFileStatus(file.id(), fallback);
            }
            audit.record(operation.requestedBy(), operation.type().name(), "BOOK_FILE",
                    file == null ? null : file.id().toString(), operation.sourcePath(), operation.targetPath(),
                    operation.expectedFingerprint(), null, rolledBack ? "ROLLED_BACK" : "FAILED", "{\"code\":\"" + code + "\"}");
            log.warn("File operation ended unsuccessfully operationId={} type={} status={} code={}",
                    operation.id(), operation.type(), rolledBack ? "ROLLED_BACK" : "FAILED", code, exception);
        } finally {
            if (lease != null) leases.release(lease);
        }
    }

    private String move(ExecutionRecord operation, BookFile file) throws IOException {
        LibraryRoot sourceRoot = root(operation.sourceRootId());
        LibraryRoot targetRoot = root(operation.targetRootId());
        Path source = pathPolicy.resolveExisting(rootPath(sourceRoot), file.relativePath());
        verifyFingerprint(source, operation.expectedFingerprint());
        String targetRelative = relativeDisplay(operation.targetPath(), targetRoot.name());
        Path target = pathPolicy.resolveTarget(rootPath(targetRoot), targetRelative);
        if (Files.exists(target) || pathPolicy.hasCaseInsensitiveConflict(target)) {
            throw new OperationFailure("TARGET_EXISTS", "目标路径已存在");
        }
        Files.createDirectories(target.getParent());

        if (sourceRoot.id().equals(targetRoot.id())) {
            operations.updateStage(operation.id(), "ATOMIC_MOVE");
            moveWithoutOverwrite(source, target);
            try {
                String fingerprint = fingerprints.sha256(target);
                BasicFileAttributes attributes = Files.readAttributes(target, BasicFileAttributes.class);
                books.updateFileLocation(file.id(), targetRoot.id(), targetRelative, normalized(targetRelative), fingerprint,
                        attributes.size(), attributes.lastModifiedTime().toInstant().atOffset(ZoneOffset.UTC));
                return fingerprint;
            } catch (Exception exception) {
                moveWithoutOverwrite(target, source);
                throw new OperationFailure("MOVE_ROLLED_BACK", "目录更新失败，文件已恢复到原路径", exception);
            }
        } else {
            return crossRootMove(operation, file, sourceRoot, targetRoot, source, target, targetRelative);
        }
    }

    private String crossRootMove(ExecutionRecord operation, BookFile file, LibraryRoot sourceRoot, LibraryRoot targetRoot,
                                 Path source, Path target, String targetRelative) throws IOException {
        operations.updateStage(operation.id(), "CHECKING_SPACE");
        long required = Files.size(source) + 64L * 1024 * 1024;
        if (Files.getFileStore(rootPath(targetRoot)).getUsableSpace() < required) {
            throw new OperationFailure("INSUFFICIENT_SPACE", "目标书库空间不足");
        }
        Path staging = internal(rootPath(targetRoot), ".bookkin-staging/" + operation.id() + "/" + target.getFileName() + ".part");
        Files.createDirectories(staging.getParent());
        String sourceFingerprint;
        String stagedFingerprint;
        try {
            operations.updateStage(operation.id(), "COPYING");
            copyAndForce(source, staging);
            operations.updateStage(operation.id(), "VERIFYING_SHA256");
            sourceFingerprint = fingerprints.sha256(source);
            stagedFingerprint = fingerprints.sha256(staging);
            if (!sourceFingerprint.equals(operation.expectedFingerprint())) {
                throw new OperationFailure("SOURCE_CHANGED", "复制期间源文件发生变化，源文件保持不变");
            }
            if (!sourceFingerprint.equals(stagedFingerprint)) {
                throw new OperationFailure("CHECKSUM_FAILED", "暂存文件校验失败，源文件保持不变");
            }
            inspector.assertReadable(staging, file.format());
            operations.updateStage(operation.id(), "FINALIZING_TARGET");
            moveWithoutOverwrite(staging, target);
        } catch (Exception exception) {
            Files.deleteIfExists(staging);
            if (exception instanceof IOException io) throw io;
            throw exception;
        }
        String trashRelative = ".bookkin-trash/" + operation.id() + "/" + source.getFileName();
        Path trash = internal(rootPath(sourceRoot), trashRelative);
        RecycleBinRepository.RecycleEntry entry = null;
        try {
            operations.updateStage(operation.id(), "TRASHING_SOURCE");
            Files.createDirectories(trash.getParent());
            moveWithoutOverwrite(source, trash);
            entry = recycleBin.create(file.id(), sourceRoot.id(), file.relativePath(), trashRelative, sourceFingerprint,
                    Files.size(trash), operation.requestedBy(), OffsetDateTime.now().plus(properties.retention().recycleBin()));
            BasicFileAttributes attributes = Files.readAttributes(target, BasicFileAttributes.class);
            books.createMovedFileAndTrashSource(file, targetRoot.id(), targetRelative, normalized(targetRelative),
                    stagedFingerprint, attributes.size(), attributes.lastModifiedTime().toInstant().atOffset(ZoneOffset.UTC));
            return stagedFingerprint;
        } catch (Exception exception) {
            if (Files.exists(trash, java.nio.file.LinkOption.NOFOLLOW_LINKS)
                    && !Files.exists(source, java.nio.file.LinkOption.NOFOLLOW_LINKS)) {
                moveWithoutOverwrite(trash, source);
            }
            Files.deleteIfExists(target);
            if (entry != null) recycleBin.delete(entry.id());
            throw new OperationFailure("SOURCE_TRASH_FAILED", "目标副本已回滚，源文件保持在原位置", exception);
        }
    }

    private String trash(ExecutionRecord operation, BookFile file) throws IOException {
        LibraryRoot root = root(operation.sourceRootId());
        Path source = pathPolicy.resolveExisting(rootPath(root), file.relativePath());
        verifyFingerprint(source, operation.expectedFingerprint());
        String trashRelative = ".bookkin-trash/" + operation.id() + "/" + source.getFileName();
        Path target = internal(rootPath(root), trashRelative);
        Files.createDirectories(target.getParent());
        operations.updateStage(operation.id(), "ATOMIC_TRASH");
        moveWithoutOverwrite(source, target);
        RecycleBinRepository.RecycleEntry entry = null;
        try {
            entry = recycleBin.create(file.id(), root.id(), file.relativePath(), trashRelative, operation.expectedFingerprint(),
                    Files.size(target), operation.requestedBy(), OffsetDateTime.now().plus(properties.retention().recycleBin()));
            books.updateFileStatus(file.id(), BookFileStatus.TRASHED);
            return operation.expectedFingerprint();
        } catch (Exception exception) {
            if (Files.exists(target, java.nio.file.LinkOption.NOFOLLOW_LINKS)) {
                moveWithoutOverwrite(target, source);
            }
            if (entry != null) recycleBin.delete(entry.id());
            books.updateFileStatus(file.id(), BookFileStatus.AVAILABLE);
            throw new OperationFailure("TRASH_ROLLED_BACK", "回收记录未能提交，文件已恢复到原路径", exception);
        }
    }

    private String restore(ExecutionRecord operation, BookFile file) throws IOException {
        if (operation.fileVersionId() != null) return restoreVersion(operation, file);
        var entry = recycleBin.find(operation.recycleBinEntryId()).orElseThrow(() -> new OperationFailure("RECYCLE_ENTRY_MISSING", "回收记录不存在"));
        if (!entry.active()) throw new OperationFailure("RECYCLE_ENTRY_INACTIVE", "回收记录已经恢复或清理");
        LibraryRoot root = root(entry.libraryRootId());
        Path source = internal(rootPath(root), entry.trashPath());
        Path target = pathPolicy.resolveTarget(rootPath(root), entry.originalPath());
        verifyFingerprint(source, entry.fingerprint());
        if (Files.exists(target) || pathPolicy.hasCaseInsensitiveConflict(target)) throw new OperationFailure("TARGET_EXISTS", "原路径已有新文件，不能覆盖");
        Files.createDirectories(target.getParent());
        moveWithoutOverwrite(source, target);
        try {
            var attributes = Files.readAttributes(target, BasicFileAttributes.class);
            books.updateFileLocation(file.id(), root.id(), entry.originalPath(), normalized(entry.originalPath()), entry.fingerprint(),
                    attributes.size(), attributes.lastModifiedTime().toInstant().atOffset(ZoneOffset.UTC));
            recycleBin.markRestored(entry.id());
            return entry.fingerprint();
        } catch (Exception exception) {
            if (Files.exists(target, java.nio.file.LinkOption.NOFOLLOW_LINKS)) {
                moveWithoutOverwrite(target, source);
            }
            books.updateFileStatus(file.id(), BookFileStatus.TRASHED);
            throw new OperationFailure("RESTORE_ROLLED_BACK", "恢复记录未能提交，文件已移回回收站", exception);
        }
    }

    private String restoreVersion(ExecutionRecord operation, BookFile file) throws IOException {
        var version = versions.find(operation.fileVersionId()).orElseThrow(() -> new OperationFailure("VERSION_MISSING", "文件版本不存在"));
        LibraryRoot root = root(version.libraryRootId());
        Path current = pathPolicy.resolveExisting(rootPath(root), file.relativePath());
        verifyFingerprint(current, operation.expectedFingerprint());
        Path archived = internal(rootPath(root), version.versionPath());
        verifyFingerprint(archived, version.fingerprint());
        inspector.assertReadable(archived, file.format());

        String backupRelative = ".bookkin-versions/" + file.id() + "/restore-backup-" + operation.id() + "-" + current.getFileName();
        Path backup = internal(rootPath(root), backupRelative);
        Files.createDirectories(backup.getParent());
        copyAndForce(current, backup);
        versions.create(file.id(), root.id(), backupRelative, file.relativePath(), operation.expectedFingerprint(),
                Files.size(backup), "RESTORE_VERSION_BACKUP", operation.requestedBy(),
                OffsetDateTime.now().plus(properties.retention().fileVersions()));

        Path temporary = current.resolveSibling(".bookkin-restore-" + operation.id() + ".tmp");
        try {
            copyAndForce(archived, temporary);
            inspector.assertReadable(temporary, file.format());
            Files.move(temporary, current, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception exception) {
            Files.deleteIfExists(temporary);
            throw exception;
        }
        try {
            var attributes = Files.readAttributes(current, BasicFileAttributes.class);
            books.updateFileLocation(file.id(), root.id(), file.relativePath(), normalized(file.relativePath()), version.fingerprint(),
                    attributes.size(), attributes.lastModifiedTime().toInstant().atOffset(ZoneOffset.UTC));
            versions.markRestored(version.id());
            return version.fingerprint();
        } catch (Exception exception) {
            Path rollback = current.resolveSibling(".bookkin-restore-rollback-" + operation.id() + ".tmp");
            Files.deleteIfExists(rollback);
            copyAndForce(backup, rollback);
            inspector.assertReadable(rollback, file.format());
            Files.move(rollback, current, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            var attributes = Files.readAttributes(current, BasicFileAttributes.class);
            books.updateFileLocation(file.id(), root.id(), file.relativePath(), normalized(file.relativePath()),
                    operation.expectedFingerprint(), attributes.size(),
                    attributes.lastModifiedTime().toInstant().atOffset(ZoneOffset.UTC));
            throw new OperationFailure("VERSION_RESTORE_ROLLED_BACK", "版本恢复未能提交，当前文件已回滚", exception);
        }
    }

    private String purge(ExecutionRecord operation, BookFile file) throws IOException {
        var entry = recycleBin.find(operation.recycleBinEntryId()).orElseThrow(() -> new OperationFailure("RECYCLE_ENTRY_MISSING", "回收记录不存在"));
        if (!entry.active()) throw new OperationFailure("RECYCLE_ENTRY_INACTIVE", "回收记录已经恢复或清理");
        LibraryRoot root = root(entry.libraryRootId());
        Path source = internal(rootPath(root), entry.trashPath());
        verifyFingerprint(source, entry.fingerprint());
        Files.delete(source);
        recycleBin.markPurged(entry.id());
        books.updateFileStatus(file.id(), BookFileStatus.DELETED);
        return entry.fingerprint();
    }

    private String writeMetadata(ExecutionRecord operation, BookFile file) throws IOException {
        LibraryRoot root = root(file.libraryRootId());
        Path source = pathPolicy.resolveExisting(rootPath(root), file.relativePath());
        verifyFingerprint(source, operation.expectedFingerprint());
        operations.updateStage(operation.id(), "PREPARING_OVERWRITE");
        var result = metadataWriter.write(operation.id(), file, root, source);
        try {
            var attributes = Files.readAttributes(source, BasicFileAttributes.class);
            books.updateFileLocation(file.id(), root.id(), file.relativePath(), normalized(file.relativePath()), result.fingerprint(),
                    attributes.size(), attributes.lastModifiedTime().toInstant().atOffset(ZoneOffset.UTC));
            try {
                metadataWriter.complete(result);
            } catch (IOException cleanupFailure) {
                log.warn("Unable to remove metadata rollback staging operationId={}: {}", operation.id(), cleanupFailure.getMessage());
            }
            return result.fingerprint();
        } catch (Exception exception) {
            metadataWriter.restoreOriginal(operation.id(), file, root, source, result);
            throw new OperationFailure("METADATA_WRITE_ROLLED_BACK", "元数据写回未能提交，原文件已恢复", exception);
        }
    }

    private FileLeaseRepository.Lease waitForWriteLease(UUID fileId, UUID operationId) throws InterruptedException {
        long deadline = System.nanoTime() + properties.fileLeaseTimeout().toNanos();
        while (System.nanoTime() < deadline) {
            var lease = leases.tryAcquireWrite(fileId, "operation:" + operationId, properties.fileLeaseTimeout().plusSeconds(30));
            if (lease.isPresent()) return lease.get();
            Thread.sleep(200);
        }
        throw new OperationFailure("ACTIVE_LEASE_TIMEOUT", "等待阅读器释放文件超时");
    }

    private void verifyFingerprint(Path path, String expected) throws IOException {
        if (!fingerprints.sha256(path).equals(expected)) throw new OperationFailure("SOURCE_CHANGED", "文件指纹与预期不一致");
    }

    private void copyAndForce(Path source, Path target) throws IOException {
        try (FileChannel input = FileChannel.open(source, StandardOpenOption.READ);
             FileChannel output = FileChannel.open(target, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            long position = 0;
            while (position < input.size()) {
                long transferred = input.transferTo(position, Math.min(16L * 1024 * 1024, input.size() - position), output);
                if (transferred <= 0) throw new IOException("复制进度停滞");
                position += transferred;
            }
            output.force(true);
        }
    }

    private void moveWithoutOverwrite(Path source, Path target) throws IOException {
        Files.move(source, target);
    }

    private LibraryRoot root(UUID id) {
        return roots.findById(id).orElseThrow(() -> new OperationFailure("ROOT_MISSING", "书库根目录不存在"));
    }

    private Path rootPath(LibraryRoot root) {
        return Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath());
    }

    private Path internal(Path root, String relative) throws IOException {
        Path canonical = root.toRealPath();
        Path result = canonical.resolve(relative).normalize();
        if (!result.startsWith(canonical)) throw new OperationFailure("UNSAFE_INTERNAL_PATH", "内部路径越界");
        if (Files.exists(result, java.nio.file.LinkOption.NOFOLLOW_LINKS)) {
            if (Files.isSymbolicLink(result)) throw new OperationFailure("UNSAFE_INTERNAL_PATH", "内部路径不能是软链接");
            Path real = result.toRealPath();
            if (!real.startsWith(canonical)) throw new OperationFailure("UNSAFE_INTERNAL_PATH", "内部路径越界");
            return real;
        }
        Path parent = result.getParent();
        while (parent != null && !Files.exists(parent, java.nio.file.LinkOption.NOFOLLOW_LINKS)) parent = parent.getParent();
        if (parent == null || Files.isSymbolicLink(parent) || !parent.toRealPath().startsWith(canonical)) {
            throw new OperationFailure("UNSAFE_INTERNAL_PATH", "内部目录越过书库边界");
        }
        return result;
    }

    private String relativeDisplay(String display, String rootName) {
        if (display == null) throw new OperationFailure("TARGET_REQUIRED", "缺少目标路径");
        String prefix = rootName + "/";
        return display.startsWith(prefix) ? display.substring(prefix.length()) : display;
    }

    private String normalized(String relative) {
        return relative.replace('\\', '/').toLowerCase(java.util.Locale.ROOT);
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        return message == null ? exception.getClass().getSimpleName() : message.substring(0, Math.min(message.length(), 2000));
    }

    private static final class OperationFailure extends RuntimeException {
        private final String code;
        private OperationFailure(String code, String message) { super(message); this.code = code; }
        private OperationFailure(String code, String message, Throwable cause) { super(message, cause); this.code = code; }
    }
}
