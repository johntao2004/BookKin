package com.elexvx.silvae.ingestion.upload;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Safe projection exposed across the ingestion module boundary for management task history. */
public final class BookUploadTaskHistoryModels {
    private BookUploadTaskHistoryModels() {}
    public record UploadSummary(UUID id, String status, String title, String originalFilename,
                                OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
}
