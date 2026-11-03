package com.elexvx.bookkin.filemanagement;

import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.FileOperationModels.ExecuteRequest;
import com.elexvx.bookkin.filemanagement.FileOperationModels.FileConflict;
import com.elexvx.bookkin.filemanagement.FileOperationModels.FileVersionList;
import com.elexvx.bookkin.filemanagement.FileOperationModels.FileVersionView;
import com.elexvx.bookkin.filemanagement.FileOperationModels.Operation;
import com.elexvx.bookkin.filemanagement.FileOperationModels.Preview;
import com.elexvx.bookkin.filemanagement.FileOperationModels.PreviewRequest;
import com.elexvx.bookkin.ingestion.LibraryRoot;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
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

// 预览负责收集冲突，执行入口验证预览后入队；实际 NAS 写入由 Worker 执行。
// Preview collects conflicts and execution validates then queues it; the worker performs actual NAS writes.
@Service
public class FileOperationService {
    private final com.elexvx.bookkin.auth.RolePermissionService permissions;
    private final BookRepository books;
    private final LibraryRootRepository roots;
    private final UserRepository users;
    private final FileOperationRepository operations;
    private final PathPolicy pathPolicy;
    private final FileFingerprints fingerprints;
    private final FileLeaseRepository leases;
    private final RecycleBinRepository recycleBin;
    private final FileVersionRepository versions;

    public FileOperationService(BookRepository books, LibraryRootRepository roots, UserRepository users,
                                FileOperationRepository operations, PathPolicy pathPolicy,
                                FileFingerprints fingerprints, FileLeaseRepository leases,
                                RecycleBinRepository recycleBin, FileVersionRepository versions,
                                com.elexvx.bookkin.auth.RolePermissionService permissions) {
        this.permissions = permissions;
        this.books = books;
        this.roots = roots;
        this.users = users;
        this.operations = operations;
        this.pathPolicy = pathPolicy;
        this.fingerprints = fingerprints;
        this.leases = leases;
        this.recycleBin = recycleBin;
        this.versions = versions;
    }

    public Preview previewTitleRename(BookFile file, String titleStem, Principal principal) {
        return preview(new PreviewRequest(file.id(), FileOperationType.RENAME, null, titleStem,
                file.fingerprint(), null, null), principal, true);
    }

    public Preview preview(PreviewRequest input, Principal principal) {
        return preview(input, principal, false);
    }

    private Preview preview(PreviewRequest input, Principal principal, boolean literalTitle) {
        var actor = users.findByUsername(principal.getName()).orElseThrow();
        requirePermission(principal, input.type());
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
            if (literalTitle) pathPolicy.requireNoSymbolicLinks(rootPath(sourceRoot), file.relativePath());
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
                        ? (literalTitle ? BookTitleFilename.inDirectory(file.relativePath(), targetRelative, file.format(), pathPolicy)
                                : RenameTargetPath.resolve(file, targetRelative, pathPolicy))
                        : pathPolicy.normalizeRelative(targetRelative);
                if (input.type() == FileOperationType.MOVE) ensureExtension(file, targetRelative);
                Path target = pathPolicy.resolveTarget(rootPath(targetRoot), targetRelative);
                targetDisplay = targetRoot.name() + "/" + targetRelative;
                if (!targetRoot.canWrite()) conflicts.add(new FileConflict("ROOT_READ_ONLY", "目标书库当前为只读。", targetRoot.name()));
                if (pathPolicy.targetConflict(source, target)) {
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
                warnings.add("写回前会保存当前文件版本，可在保留期内预览并恢复。");
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            conflicts.add(new FileConflict("ROOT_OFFLINE", "无法访问 NAS 文件：" + exception.getMessage(), sourceDisplay));
        }

        return operations.savePreview(actor.id(), input.type(), file.id(), sourceRoot.id(), targetRoot.id(), sourceDisplay,
                targetDisplay, input.expectedFingerprint(), requiredBytes, conflicts, warnings, null, null);
    }

    // 幂等键按操作者隔离且绑定同一预览与指纹，不能重复用于不同请求。
    // Idempotency keys are actor-scoped and bound to the same preview and fingerprint, not reusable for another request.
    public Operation execute(ExecuteRequest input, String idempotencyKey, Principal principal) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 160) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "必须提供有效的幂等键。");
        }
        var actor = users.findByUsername(principal.getName()).orElseThrow();
        var existing = operations.findIdempotency(actor.id(), idempotencyKey);
        if (existing.isPresent()) {
            requirePermission(principal, existing.get().type());
            requireSameRequest(existing.get(), input);
            return existing.get().operation();
        }
        var preview = operations.findPreview(input.previewToken())
                .orElseThrow(() -> ApiException.notFound("PREVIEW_NOT_FOUND", "预览不存在或已被使用。"));
        requirePermission(principal, preview.type());
        if (!preview.requestedBy().equals(actor.id())) throw ApiException.forbidden("PREVIEW_OWNER_MISMATCH", "不能执行其他用户的预览。");
        if (preview.expiresAt().isBefore(OffsetDateTime.now())) throw ApiException.conflict("PREVIEW_EXPIRED", "预览已过期，请重新检查。");
        if (!"[]".equals(preview.conflictsJson())) throw ApiException.conflict("PREVIEW_HAS_CONFLICTS", "预览仍有冲突，不能执行。");
        if (!preview.expectedFingerprint().equals(input.expectedFingerprint())) throw ApiException.conflict("FINGERPRINT_MISMATCH", "提交的文件指纹与预览不一致。");

        try {
            // 预览和提交之间存在时间窗口，提交前必须重读源文件指纹。
            // Preview and submission are separated in time, so reread the source fingerprint before queuing.
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
            requirePermission(principal, existing.get().type());
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

    public FileVersionList listVersions(UUID bookFileId, Principal principal) {
        permissions.require(principal, "settings.recycle.view");
        books.findFile(bookFileId).orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件不存在。"));
        return new FileVersionList(versions.listForFile(bookFileId).stream()
                .map(version -> new FileVersionView(version.id(), version.sourcePath(), version.fingerprint(),
                        version.sizeBytes(), version.reason(), version.createdAt(), version.expiresAt(), version.restoredAt()))
                .toList());
    }

    public Preview previewVersionRestore(UUID versionId, String expectedFingerprint, Principal principal) {
        permissions.require(principal, "settings.recycle.restore");
        var actor = users.findByUsername(principal.getName()).orElseThrow();
        var version = versions.find(versionId)
                .orElseThrow(() -> ApiException.notFound("FILE_VERSION_NOT_FOUND", "文件版本不存在。"));
        if (!version.expiresAt().isAfter(OffsetDateTime.now())) {
            throw ApiException.conflict("FILE_VERSION_EXPIRED", "文件版本已过期，不能恢复。");
        }
        var file = books.findFile(version.bookFileId())
                .orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件不存在。"));
        if (file.status() != com.elexvx.bookkin.catalog.BookFileStatus.AVAILABLE) {
            throw ApiException.conflict("BOOK_FILE_UNAVAILABLE", "当前书籍文件不可恢复版本。");
        }
        String expectedVersionPrefix = ".bookkin-versions/" + file.id() + "/";
        if (!version.bookFileId().equals(file.id()) || !version.libraryRootId().equals(file.libraryRootId())
                || !version.versionPath().startsWith(expectedVersionPrefix)) {
            throw ApiException.conflict("VERSION_MISMATCH", "文件版本与当前书籍文件不匹配。");
        }

        LibraryRoot root = roots.findById(file.libraryRootId()).orElseThrow();
        String display = root.name() + "/" + file.relativePath();
        List<FileConflict> conflicts = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        if (!root.canWrite()) conflicts.add(new FileConflict("ROOT_READ_ONLY", "书库当前为只读。", root.name()));
        try {
            pathPolicy.requireNoSymbolicLinks(rootPath(root), file.relativePath());
            Path current = pathPolicy.resolveExisting(rootPath(root), file.relativePath());
            String actual = fingerprints.sha256(current);
            if (!actual.equals(expectedFingerprint) || !actual.equals(file.fingerprint())) {
                conflicts.add(new FileConflict("SOURCE_CHANGED", "当前文件已被外部修改，请刷新后重新预览。", display));
            }
            Path archived = resolveVersionFile(root, file.id(), version.versionPath());
            if (!fingerprints.sha256(archived).equals(version.fingerprint())) {
                conflicts.add(new FileConflict("VERSION_CHANGED", "历史版本的文件指纹已变化，不能恢复。", version.sourcePath()));
            }
            if (leases.hasActiveReadLease(file.id())) warnings.add("这本书正在被阅读；Worker 会等待读取租约释放，超时后安全失败。");
            warnings.add("恢复会用所选版本覆盖当前文件，并把当前文件另存为可恢复版本。");
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            conflicts.add(new FileConflict("VERSION_UNAVAILABLE", "无法读取当前文件或历史版本。", display));
        }

        return operations.savePreview(actor.id(), FileOperationType.RESTORE, file.id(), root.id(), root.id(),
                display, display, expectedFingerprint, 0, conflicts, warnings, null, version.id());
    }

    public Operation executeForVersion(UUID versionId, ExecuteRequest input, String idempotencyKey, Principal principal) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 160) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "必须提供有效的幂等键。");
        }
        var actor = users.findByUsername(principal.getName()).orElseThrow();
        var existing = operations.findIdempotency(actor.id(), idempotencyKey);
        if (existing.isPresent()) {
            requirePermission(principal, existing.get().type());
            requireSameRequest(existing.get(), input);
            if (existing.get().type() != FileOperationType.RESTORE
                    || !Objects.equals(existing.get().fileVersionId(), versionId)) {
                throw ApiException.conflict("IDEMPOTENCY_KEY_REUSED", "同一幂等键不能用于不同的文件版本恢复请求。");
            }
            return existing.get().operation();
        }
        var preview = operations.findPreview(input.previewToken())
                .orElseThrow(() -> ApiException.notFound("PREVIEW_NOT_FOUND", "预览不存在或已被使用。"));
        if (preview.type() != FileOperationType.RESTORE || !Objects.equals(preview.fileVersionId(), versionId)) {
            throw ApiException.conflict("PREVIEW_TARGET_MISMATCH", "预览与当前文件版本恢复操作不匹配。");
        }
        return execute(input, idempotencyKey, principal);
    }

    private void requirePermission(Principal principal, FileOperationType type) {
        permissions.require(principal, switch (type) {
            case TRASH -> "library.trash";
            case RESTORE -> "settings.recycle.restore";
            case PURGE -> "settings.recycle.purge";
            default -> "library.files";
        });
        if (type == FileOperationType.MOVE) {
            throw ApiException.forbidden("BOOK_MOVE_DISABLED", "暂不支持移动书籍。");
        }
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

    private Path resolveVersionFile(LibraryRoot root, UUID fileId, String relative) throws IOException {
        String expectedPrefix = ".bookkin-versions/" + fileId + "/";
        if (relative == null || !relative.startsWith(expectedPrefix)) {
            throw invalid("UNSAFE_VERSION_PATH", "历史版本路径不安全。");
        }
        Path relativePath = Path.of(relative).normalize();
        if (relativePath.isAbsolute() || relativePath.startsWith("..")
                || !relativePath.toString().replace('\\', '/').equals(relative)) {
            throw invalid("UNSAFE_VERSION_PATH", "历史版本路径不安全。");
        }
        Path canonicalRoot = rootPath(root).toRealPath();
        Path candidate = canonicalRoot.resolve(relativePath).normalize();
        if (!candidate.startsWith(canonicalRoot)) throw invalid("UNSAFE_VERSION_PATH", "历史版本路径越过书库边界。");
        Path segment = canonicalRoot;
        for (Path part : relativePath) {
            segment = segment.resolve(part);
            if (Files.isSymbolicLink(segment)) throw invalid("UNSAFE_VERSION_PATH", "历史版本路径不能包含软链接。");
        }
        if (!Files.isRegularFile(candidate, LinkOption.NOFOLLOW_LINKS)) throw new IOException("历史版本文件不存在");
        Path real = candidate.toRealPath();
        if (!real.startsWith(canonicalRoot)) throw invalid("UNSAFE_VERSION_PATH", "历史版本路径越过书库边界。");
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
