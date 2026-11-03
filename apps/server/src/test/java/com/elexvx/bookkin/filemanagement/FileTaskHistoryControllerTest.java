package com.elexvx.bookkin.filemanagement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.elexvx.bookkin.filemanagement.FileTaskHistoryModels.Entry;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.BookUploadStatus;
import com.elexvx.bookkin.ingestion.upload.BookUploadTaskHistoryModels.UploadSummary;
import com.elexvx.bookkin.ingestion.upload.BookUploadTaskHistoryGateway;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FileTaskHistoryControllerTest {
    @Test void mergesChronologicallyAcrossSourcesAndPagesWithExactTotal() {
        var operations = mock(FileOperationTaskHistoryGateway.class);
        var uploads = mock(BookUploadTaskHistoryGateway.class);
        var newest = OffsetDateTime.parse("2026-11-03T10:00:00Z");
        var middle = newest.minusMinutes(1);
        var oldest = newest.minusMinutes(2);
        var fileId = UUID.fromString("00000000-0000-0000-0000-000000000003");
        var uploadId = UUID.fromString("00000000-0000-0000-0000-000000000002");
        var olderUploadId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        when(operations.count()).thenReturn(1L);
        when(uploads.count()).thenReturn(2L);
        var fileRow = new Entry(fileId, "FILE_OPERATION", FileOperationType.RENAME, FileOperationStatus.RUNNING.name(),
                "RUNNING", "source", null, middle, middle);
        var uploadRows = List.of(
                new UploadSummary(uploadId, BookUploadStatus.READY_FOR_REVIEW.name(), null, "review.pdf", newest, newest),
                new UploadSummary(olderUploadId, BookUploadStatus.FAILED.name(), "Retry title", "retry.epub", oldest, oldest));
        when(operations.page(anyInt(), anyLong())).thenAnswer(call -> ((long) call.getArgument(1) == 0) ? List.of(fileRow) : List.of());
        when(uploads.page(anyInt(), anyLong())).thenAnswer(call -> {
            long offset = call.getArgument(1);
            return offset >= uploadRows.size() ? List.of() : uploadRows.subList((int) offset, uploadRows.size());
        });

        var service = new FileTaskHistoryService(operations, uploads);
        var first = service.page(0, 2);
        var second = service.page(1, 2);
        assertThat(second.items()).extracting(e -> e.type() + ":" + e.id()).containsExactly("BOOK_UPLOAD:" + olderUploadId);
        assertThat(first.total()).isEqualTo(3);
        assertThat(first.items()).extracting(e -> e.type() + ":" + e.id())
                .containsExactly("BOOK_UPLOAD:" + uploadId, "FILE_OPERATION:" + fileId);
        assertThat(first.items().get(0).title()).isEqualTo("review.pdf");
        assertThat(second.items()).singleElement().satisfies(e -> {
            assertThat(e.id()).isEqualTo(olderUploadId);
            assertThat(e.title()).isEqualTo("Retry title");
            assertThat(e.status()).isEqualTo("FAILED");
        });
    }

    @Test void mergesPastBothDatabaseChunksAcrossAStableInterleavedPage() {
        var operations = mock(FileOperationTaskHistoryGateway.class);
        var uploads = mock(BookUploadTaskHistoryGateway.class);
        var base = OffsetDateTime.parse("2026-11-03T10:00:00Z");
        var fileRows = new java.util.ArrayList<Entry>();
        var uploadRows = new java.util.ArrayList<UploadSummary>();
        for (int i = 0; i < 150; i++) {
            var fileTime = base.minusSeconds(i * 2L);
            var uploadTime = base.minusSeconds(i * 2L + 1);
            fileRows.add(new Entry(new UUID(0, 1000L + i), "FILE_OPERATION", FileOperationType.RENAME,
                    "RUNNING", "RUNNING", "book-" + i, null, fileTime, fileTime));
            uploadRows.add(new UploadSummary(new UUID(0, 2000L + i), "FAILED", null,
                    "upload-" + i + ".epub", uploadTime, uploadTime));
        }
        when(operations.count()).thenReturn(150L);
        when(uploads.count()).thenReturn(150L);
        when(operations.page(anyInt(), anyLong())).thenAnswer(call -> slice(fileRows, call.getArgument(0), call.getArgument(1)));
        when(uploads.page(anyInt(), anyLong())).thenAnswer(call -> slice(uploadRows, call.getArgument(0), call.getArgument(1)));

        var page = new FileTaskHistoryService(operations, uploads).page(2, 100);
        assertThat(page.total()).isEqualTo(300);
        assertThat(page.items()).hasSize(100);
        assertThat(page.items().get(0).id()).isEqualTo(fileRows.get(100).id());
        assertThat(page.items().get(1).id()).isEqualTo(uploadRows.get(100).id());
        assertThat(page.items().get(99).id()).isEqualTo(uploadRows.get(149).id());
        org.mockito.Mockito.verify(operations).page(100, 0);
        org.mockito.Mockito.verify(operations).page(100, 100);
        org.mockito.Mockito.verify(uploads).page(100, 0);
        org.mockito.Mockito.verify(uploads).page(100, 100);
    }

    @Test void outOfRangeAndMaximumPageReturnExactTotalWithoutReadingSlices() {
        var operations = mock(FileOperationTaskHistoryGateway.class);
        var uploads = mock(BookUploadTaskHistoryGateway.class);
        when(operations.count()).thenReturn(2L);
        when(uploads.count()).thenReturn(3L);
        var service = new FileTaskHistoryService(operations, uploads);
        assertThat(service.page(2, 3).items()).isEmpty();
        assertThat(service.page(Integer.MAX_VALUE, 100).items()).isEmpty();
        assertThat(service.page(Integer.MAX_VALUE, 100).total()).isEqualTo(5);
        verify(operations, never()).page(anyInt(), anyLong());
        verify(uploads, never()).page(anyInt(), anyLong());
    }

    private static <T> List<T> slice(List<T> rows, int limit, long offset) {
        if (offset >= rows.size()) return List.of();
        return rows.subList((int) offset, Math.min(rows.size(), (int) offset + limit));
    }

    @Test void resolvesSameTimestampWithStableTypeAndUnsignedUuidOrderAndSkipsEmptySource() throws Exception {
        var operations = mock(FileOperationTaskHistoryGateway.class);
        var uploads = mock(BookUploadTaskHistoryGateway.class);
        var at = OffsetDateTime.parse("2026-11-03T10:00:00Z");
        var low = UUID.fromString("00000000-0000-0000-0000-000000000001");
        var high = UUID.fromString("f0000000-0000-0000-0000-000000000001");
        when(operations.count()).thenReturn(0L);
        when(uploads.count()).thenReturn(2L);
        when(operations.page(anyInt(), anyLong())).thenReturn(List.of());
        when(uploads.page(anyInt(), anyLong())).thenReturn(List.of(
                new UploadSummary(high, "FAILED", null, "high.pdf", at, at),
                new UploadSummary(low, "CANCELLED", null, "low.pdf", at, at)));
        var page = new FileTaskHistoryService(operations, uploads).page(0, 2);
        assertThat(page.items()).extracting(Entry::id).containsExactly(high, low);
        org.mockito.Mockito.verify(operations, org.mockito.Mockito.times(1)).page(2, 0);
        var tx = FileTaskHistoryService.class.getMethod("page", int.class, int.class)
                .getAnnotation(org.springframework.transaction.annotation.Transactional.class);
        assertThat(tx).isNotNull();
        assertThat(tx.isolation()).isEqualTo(org.springframework.transaction.annotation.Isolation.REPEATABLE_READ);
        assertThat(tx.readOnly()).isTrue();
    }

    @Test void publicHistoryProjectionContainsNoFilesystemPathsOrPrivateDraftFields() {
        var names = java.util.Arrays.stream(FileTaskHistoryModels.Entry.class.getRecordComponents())
                .map(java.lang.reflect.RecordComponent::getName).toList();
        assertThat(names).contains("id", "type", "action", "status", "stage", "title", "originalFilename", "createdAt", "updatedAt")
                .doesNotContain("sourcePath", "targetPath", "stagingPath", "draftMetadata", "detectedMetadata", "errorDetail");
        var uploadNames = java.util.Arrays.stream(com.elexvx.bookkin.ingestion.upload.BookUploadTaskHistoryModels.UploadSummary.class.getRecordComponents())
                .map(java.lang.reflect.RecordComponent::getName).toList();
        assertThat(uploadNames).contains("id", "status", "title", "originalFilename", "createdAt", "updatedAt")
                .doesNotContain("stagingPath", "targetPath", "draftMetadata", "detectedMetadata", "errorDetail");
    }
}
