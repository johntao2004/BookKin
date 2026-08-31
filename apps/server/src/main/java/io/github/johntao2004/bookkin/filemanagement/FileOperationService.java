package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.catalog.BookFile;
import io.github.johntao2004.bookkin.catalog.BookRepository;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.ExecuteRequest;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.FileConflict;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.Operation;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.Preview;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.PreviewRequest;
import io.github.johntao2004.bookkin.ingestion.LibraryRoot;
import io.github.johntao2004.bookkin.ingestion.LibraryRootRepository;
import io.github.johntao2004.bookkin.users.UserRepository;
import io.github.johntao2004.bookkin.users.UserRole;
import java.io.IOException;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class FileOperationService {
    private final BookRepository books;
    private final LibraryRootRepository roots;
    private final UserRepository users;
    private final FileOperationRepository operations;
    private final PathPolicy pathPolicy;
    private final FileFingerprints fingerprints;
    private final FileLeaseRepository leases;
    private final RecycleBinRepository recycleBin;

    public FileOperationService(BookRepository books, LibraryRootRepository roots, UserRepository users,
                                FileOperationRepository operations, PathPolicy pathPolicy,
                                FileFingerprints fingerprints, FileLeaseRepository leases,
                                RecycleBinRepository recycleBin) {
        this.books = books;
        this.roots = roots;
        this.users = users;
        this.operations = operations;
        this.pathPolicy = pathPolicy;
        this.fingerprints = fingerprints;
        this.leases = leases;
        this.recycleBin = recycleBin;
    }

    public Preview preview(PreviewRequest input, Principal principal) {
        var actor = users.findByUsername(principal.getName()).orElseThrow();
        if (input.type() == FileOperationType.PURGE && actor.role() != UserRole.OWNER) {
            throw ApiException.forbidden("OWNER_REQUIRED", "只有主人可以永久清理文件。");
        }
        if (input.recycleBinEntryId() != null) return previewRecycle(input, actor.id());
        if (input.type() == FileOperationType.RESTORE || input.type() == FileOperationType.PURGE) {
            throw invalid("PREVIEW_TARGET_REQUIRED", "恢复或永久清理必须指定回收站记录。");
        }
        if (input.bookFileId() == null) throw invalid("BOOK_FILE_REQUIRED", "文件操作必须指定书籍文件。");
        BookFile file = books.findFile(input.bookFileId()).or(() -> books.findPreferredFile(input.bookFileId()))
                .orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件不存在。"));
        LibraryRoot sourceRoot = roots.findById(file.libraryRootId()).orElseThrow();
        LibraryRoot targetRoot = input.type() == FileOperationType.RENAME || input.targetRootId() == null
                ? sourceRoot : roots.findById(input.targetRootId())
                .orElseThrow(() -> ApiException.notFound("TARGET_ROOT_NOT_FOUND", "目标书库不存在。"));
        String targetRelative = input.targetPath();
        if (input.type() == FileOperationType.MOVE && input.targetRootId() == null && targetRelative != null) {
            int slash = targetRelative.indexOf('/');
            if (slash > 0) {
                var namedRoot = roots.findByName(targetRelative.substring(0, slash));
                if (namedRoot.isPresent()) {
                    targetRoot = namedRoot.get();
                    targetRelative = targetRelative.substring(slash + 1);
                }
            }
        }

        List<FileConflict> conflicts = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        String sourceDisplay = sourceRoot.name() + "/" + file.relativePath();
        String targetDisplay = null;
        long requiredBytes = 0;
        try {
            Path source = pathPolicy.resolveExisting(rootPath(sourceRoot), file.relativePath());
            String actualFingerprint = fingerprints.sha256(source);
            if (!actualFingerprint.equals(input.expectedFingerprint()) || !actualFingerprint.equals(file.fingerprint())) {
                conflicts.add(new FileConflict("SOURCE_CHANGED", "文件已被外部修改，请重新扫描或刷新后再试。", sourceDisplay));
            }
            if (!sourceRoot.canWrite()) conflicts.add(new FileConflict("ROOT_READ_ONLY", "源书库当前为只读。", sourceRoot.name()));
            if (leases.hasActiveReadLease(file.id())) warnings.add("这本书正在被阅读；Worker 会等待读取租约释放，超时后安全失败。");

            if (input.type() == FileOperationType.RENAME || input.type() == FileOperationType.MOVE) {
                if (targetRelative == null || targetRelative.isBlank()) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "TARGET_REQUIRED", "重命名或移动必须指定目标路径。");
                }
                targetRelative = input.type() == FileOperationType.RENAME
                        ? RenameTargetPath.resolve(file, targetRelative, pathPolicy)
                        : pathPolicy.normalizeRelative(targetRelative);
                if (input.type() == FileOperationType.MOVE) ensureExtension(file, targetRelative);
                Path target = pathPolicy.resolveTarget(rootPath(targetRoot), targetRelative);
                targetDisplay = targetRoot.name() + "/" + targetRelative;
                if (!targetRoot.canWrite()) conflicts.add(new FileConflict("ROOT_READ_ONLY", "目标书库当前为只读。", targetRoot.name()));
                if (Files.exists(target) || pathPolicy.hasCaseInsensitiveConflict(target)) {
                    conflicts.add(new FileConflict("TARGET_EXISTS", "目标路径已有文件，BookKin不会覆盖它。", targetDisplay));
                }
                if (!targetRoot.id().equals(sourceRoot.id())) {
                    requiredBytes = file.sizeBytes();
                    FileStore store = Files.getFileStore(rootPath(targetRoot));
                    if (store.getUsableSpace() < requiredBytes + 64L * 1024 * 1024) {
                        conflicts.add(new FileConflict("INSUFFICIENT_SPACE", "目标书库剩余空间不足。", targetRoot.name()));
                    }
                    warnings.add("跨书库移动会先复制到暂存区、刷盘、校验 SHA-256，再把源文件移入回收站。");
                }
            }
            if (input.type() == FileOperationType.TRASH) warnings.add("原文件将移入 .bookkin-trash 并保留 30 天；阅读记录和笔记不会删除。");
            if (input.type() == FileOperationType.WRITE_METADATA) {
                if (file.encrypted() || file.drmProtected() || file.digitallySigned()) {
                    conflicts.add(new FileConflict("WRITEBACK_PROTECTED", "加密、DRM 或带数字签名的文件禁止写回。", sourceDisplay));
                }
                warnings.add("写回会校验临时文件后原子覆盖当前原文件，不保留可浏览的历史版本。");
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            conflicts.add(new FileConflict("ROOT_OFFLINE", "无法访问 NAS 文件：" + exception.getMessage(), sourceDisplay));
        }

        return operations.savePreview(actor.id(), input.type(), file.id(), sourceRoot.id(), targetRoot.id(), sourceDisplay,
                targetDisplay, input.expectedFingerprint(), requiredBytes, conflicts, warnings, null, null);
    }

    public Operation execute(ExecuteRequest input, String idempotencyKey, Principal principal) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 160) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "必须提供有效的幂等键。");
        }
        var actor = users.findByUsername(principal.getName()).orElseThrow();
        var existing = operations.findIdempotency(actor.id(), idempotencyKey);
        if (existing.isPresent()) {
            requireSameRequest(existing.get(), input);
            return existing.get().operation();
        }
        var preview = operations.findPreview(input.previewToken())
                .orElseThrow(() -> ApiException.notFound("PREVIEW_NOT_FOUND", "预览不存在或已被使用。"));
        if (!preview.requestedBy().equals(actor.id())) throw ApiException.forbidden("PREVIEW_OWNER_MISMATCH", "不能执行其他用户的预览。");
        if (preview.expiresAt().isBefore(OffsetDateTime.now())) throw ApiException.conflict("PREVIEW_EXPIRED", "预览已过期，请重新检查。");
        if (!"[]".equals(preview.conflictsJson())) throw ApiException.conflict("PREVIEW_HAS_CONFLICTS", "预览仍有冲突，不能执行。");
        if (!preview.expectedFingerprint().equals(input.expectedFingerprint())) throw ApiException.conflict("FINGERPRINT_MISMATCH", "提交的文件指纹与预览不一致。");

        try {
            String actual = fingerprints.sha256(previewSource(preview));
            if (!actual.equals(preview.expectedFingerprint())) throw ApiException.conflict("SOURCE_CHANGED", "预览后文件又被修改，请重新预览。");
        } catch (IOException exception) {
            throw ApiException.conflict("SOURCE_UNAVAILABLE", "执行前无法读取源文件。");
        }
        Operation operation;
        try {
            operation = operations.create(actor.id(), idempotencyKey, preview);
        } catch (FileOperationRepository.BookFileBusyException exception) {
            throw ApiException.conflict("BOOK_FILE_BUSY", "这份文件正在执行其他任务，请等待完成后重新预览。");
        } catch (DataIntegrityViolationException exception) {
            var concurrent = operations.findIdempotency(actor.id(), idempotencyKey).orElseThrow(() -> exception);
            if (!Objects.equals(concurrent.previewToken(), input.previewToken())
                    || !Objects.equals(concurrent.expectedFingerprint(), input.expectedFingerprint())) {
                throw ApiException.conflict("IDEMPOTENCY_KEY_REUSED", "同一幂等键不能用于不同的文件操作请求。");
            }
            return concurrent.operation();
        }
        return operation;
    }

    public Operation executeForRecycleEntry(UUID entryId, FileOperationType type, ExecuteRequest input,
                                            String idempotencyKey, Principal principal) {
        var actor = users.findByUsername(principal.getName()).orElseThrow();
        var existing = operations.findIdempotency(actor.id(), idempotencyKey);
        if (existing.isPresent()) {
            requireSameRequest(existing.get(), input);
            if (!Objects.equals(existing.get().recycleBinEntryId(), entryId) || existing.get().type() != type) {
                throw ApiException.conflict("IDEMPOTENCY_KEY_REUSED", "同一幂等键不能用于不同的回收站操作。");
            }
            return existing.get().operation();
        }
        var preview = operations.findPreview(input.previewToken())
                .orElseThrow(() -> ApiException.notFound("PREVIEW_NOT_FOUND", "预览不存在或已被使用。"));
        if (preview.recycleBinEntryId() == null || !preview.recycleBinEntryId().equals(entryId) || preview.type() != type) {
            throw ApiException.conflict("PREVIEW_TARGET_MISMATCH", "预览与当前回收站操作不匹配。");
        }
        return execute(input, idempotencyKey, principal);
    }

    private void requireSameRequest(FileOperationRepository.IdempotencyRecord existing, ExecuteRequest input) {
        if (!Objects.equals(existing.previewToken(), input.previewToken())
                || !Objects.equals(existing.expectedFingerprint(), input.expectedFingerprint())) {
            throw ApiException.conflict("IDEMPOTENCY_KEY_REUSED", "同一幂等键不能用于不同的文件操作请求。");
        }
    }

    private Preview previewRecycle(PreviewRequest input, UUID actorId) {
        if (input.type() != FileOperationType.RESTORE && input.type() != FileOperationType.PURGE) {
            throw invalid("RECYCLE_OPERATION_INVALID", "回收记录只支持恢复或永久清理。");
        }
        var entry = recycleBin.find(input.recycleBinEntryId())
                .orElseThrow(() -> ApiException.notFound("RECYCLE_ENTRY_NOT_FOUND", "回收记录不存在。"));
        if (!entry.active()) throw ApiException.conflict("RECYCLE_ENTRY_INACTIVE", "文件已经恢复或永久清理。");
        var file = books.findFile(entry.bookFileId()).orElseThrow();
        var root = roots.findById(entry.libraryRootId()).orElseThrow();
        List<FileConflict> conflicts = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        String sourceDisplay = root.name() + "/" + entry.trashPath();
        String targetDisplay = input.type() == FileOperationType.RESTORE ? root.name() + "/" + entry.originalPath() : null;
        try {
            Path source = internalExisting(root, entry.trashPath());
            String actual = fingerprints.sha256(source);
            if (!actual.equals(entry.fingerprint()) || !actual.equals(input.expectedFingerprint())) {
                conflicts.add(new FileConflict("SOURCE_CHANGED", "回收站文件已被外部修改，不能继续。", sourceDisplay));
            }
            if (!root.canWrite()) conflicts.add(new FileConflict("ROOT_READ_ONLY", "书库当前为只读。", root.name()));
            if (leases.hasActiveReadLease(file.id())) warnings.add("这本书正在被阅读；Worker 会等待读取租约释放，超时后安全失败。");
            if (input.type() == FileOperationType.RESTORE) {
                Path target = pathPolicy.resolveTarget(rootPath(root), entry.originalPath());
                if (Files.exists(target, LinkOption.NOFOLLOW_LINKS) || pathPolicy.hasCaseInsensitiveConflict(target)) {
                    conflicts.add(new FileConflict("TARGET_EXISTS", "原路径已有新文件，BookKin不会覆盖它。", targetDisplay));
                }
                warnings.add("恢复会把文件移回原路径；阅读记录和笔记保持不变。");
            } else {
                warnings.add("永久清理会从 NAS 删除回收文件，且无法通过BookKin恢复。");
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            conflicts.add(new FileConflict("ROOT_OFFLINE", "无法访问 NAS 文件：" + exception.getMessage(), sourceDisplay));
        }
        return operations.savePreview(actorId, input.type(), file.id(), root.id(), root.id(), sourceDisplay,
                targetDisplay, input.expectedFingerprint(), 0, conflicts, warnings, entry.id(), null);
    }

    private Path previewSource(FileOperationRepository.PreviewRecord preview) throws IOException {
        var root = roots.findById(preview.sourceRootId()).orElseThrow();
        if (preview.recycleBinEntryId() != null) {
            var entry = recycleBin.find(preview.recycleBinEntryId())
                    .orElseThrow(() -> ApiException.notFound("RECYCLE_ENTRY_NOT_FOUND", "回收记录不存在。"));
            if (!entry.active()) throw ApiException.conflict("RECYCLE_ENTRY_INACTIVE", "文件已经恢复或永久清理。");
            return internalExisting(root, entry.trashPath());
        }
        var file = books.findFile(preview.bookFileId()).orElseThrow();
        return pathPolicy.resolveExisting(rootPath(root), file.relativePath());
    }

    private Path internalExisting(LibraryRoot root, String relative) throws IOException {
        Path canonicalRoot = rootPath(root).toRealPath();
        Path candidate = canonicalRoot.resolve(relative).normalize();
        if (!candidate.startsWith(canonicalRoot) || Files.isSymbolicLink(candidate)) {
            throw invalid("UNSAFE_INTERNAL_PATH", "内部文件路径越过书库边界。");
        }
        Path real = candidate.toRealPath();
        if (!real.startsWith(canonicalRoot)) throw invalid("UNSAFE_INTERNAL_PATH", "内部文件路径越过书库边界。");
        return real;
    }

    private ApiException invalid(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private Path rootPath(LibraryRoot root) {
        return Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath());
    }

    private void ensureExtension(BookFile file, String targetRelative) {
        String expected = "." + file.format().name().toLowerCase(Locale.ROOT);
        if (!targetRelative.toLowerCase(Locale.ROOT).endsWith(expected)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FORMAT_EXTENSION_MISMATCH", "目标文件扩展名必须保持为 " + expected + "。");
        }
    }
}
