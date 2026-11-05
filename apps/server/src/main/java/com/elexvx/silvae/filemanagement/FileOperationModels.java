package com.elexvx.silvae.filemanagement;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class FileOperationModels {
    private FileOperationModels() {}

    public record PreviewRequest(
            UUID bookFileId,
            @NotNull FileOperationType type,
            UUID targetRootId,
            @Size(max = 2048) String targetPath,
            @NotNull String expectedFingerprint,
            Map<String, Object> metadata,
            UUID recycleBinEntryId) {}

    // 执行只引用已保存预览与指纹，避免由客户端重新定义已预览操作。
    // Execution references a stored preview and fingerprint instead of redefining the previewed operation on the client.
    public record ExecuteRequest(@NotNull UUID previewToken, @NotNull String expectedFingerprint) {}

    public record VersionRestorePreviewRequest(@NotNull String expectedFingerprint) {}

    public record FileConflict(String code, String message, String path) {}

    public record Preview(
            UUID previewToken,
            FileOperationType type,
            String sourcePath,
            String targetPath,
            long requiredBytes,
            String expectedFingerprint,
            OffsetDateTime expiresAt,
            List<FileConflict> conflicts,
            List<String> warnings) {}

    public record Operation(
            UUID id,
            FileOperationType type,
            FileOperationStatus status,
            String sourcePath,
            String targetPath,
            OffsetDateTime createdAt,
            String stage,
            String errorCode,
            String errorDetail) {}

    public record FileVersionList(List<FileVersionView> items) {}

    public record FileVersionView(UUID id, String sourcePath, String fingerprint, long sizeBytes, String reason,
                                  OffsetDateTime createdAt, OffsetDateTime expiresAt, OffsetDateTime restoredAt) {}

}
