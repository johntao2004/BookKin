package io.github.johntao2004.bookkin.filemanagement;

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

    public record ExecuteRequest(@NotNull UUID previewToken, @NotNull String expectedFingerprint) {}

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
}
