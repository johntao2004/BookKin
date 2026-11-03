package com.elexvx.bookkin.filemanagement;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class FileTaskHistoryModels {
    private FileTaskHistoryModels() {}
    public record Entry(UUID id, String type, FileOperationType action, String status, String stage, String title,
                        String originalFilename, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    public record Page(List<Entry> items, long total) {}
}
