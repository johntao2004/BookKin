package io.github.johntao2004.bookkin.ingestion.upload;

import io.github.johntao2004.bookkin.catalog.BookFormat;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class BookUploadModels {
    private BookUploadModels() {}

    public enum BookUploadStatus { RECEIVING, INSPECTING, ENRICHING, READY_FOR_REVIEW, COMMITTING, SUCCEEDED, DUPLICATE, FAILED, CANCELLED, EXPIRED }
    public enum MetadataSource { FILE, FILENAME, OPEN_LIBRARY, GOOGLE_BOOKS, MANUAL }
    public enum CoverSource { EMBEDDED, PDF_FIRST_PAGE, OPEN_LIBRARY, GOOGLE_BOOKS, CUSTOM, GENERATED }

    public record MetadataDraft(
            String title, String subtitle, List<String> authors, List<String> translators, String language,
            String publisher, String publishedDate, String isbn, String description, String series,
            BigDecimal seriesIndex, List<String> tags, Integer pageCount, Long wordCount,
            Map<String, MetadataSource> sources, String targetPath) {
        public MetadataDraft {
            authors = clean(authors);
            translators = clean(translators);
            tags = clean(tags);
            sources = sources == null ? Map.of() : Map.copyOf(sources);
        }
        private static List<String> clean(List<String> values) {
            return values == null ? List.of() : values.stream().filter(value -> value != null && !value.isBlank()).map(String::strip).distinct().toList();
        }
    }

    public record MetadataCandidate(
            String id, MetadataSource provider, String title, String subtitle, List<String> authors,
            String publisher, String publishedDate, String isbn, String description, List<String> tags,
            String coverUrl) {}

    public record BookUpload(
            UUID id, UUID libraryRootId, String libraryRootName, String originalFilename, BookFormat format,
            long declaredSizeBytes, long receivedBytes, String fingerprint, BookUploadStatus status,
            boolean encrypted, boolean drmProtected, boolean digitallySigned, MetadataDraft detectedMetadata,
            MetadataDraft draftMetadata, List<MetadataCandidate> metadataCandidates, String coverUrl,
            CoverSource selectedCoverSource, UUID duplicateBookId, List<UUID> similarBookIds, String targetPath,
            String errorCode, String errorDetail, UUID committedBookId, OffsetDateTime expiresAt,
            OffsetDateTime createdAt, OffsetDateTime updatedAt) {}

    record UploadEntity(
            UUID id, UUID requestedBy, UUID libraryRootId, String libraryRootName, String originalFilename,
            String stagingPath, BookFormat format, long declaredSizeBytes, long receivedBytes, String fingerprint,
            BookUploadStatus status, boolean encrypted, boolean drmProtected, boolean digitallySigned,
            MetadataDraft detectedMetadata, MetadataDraft draftMetadata, List<MetadataCandidate> metadataCandidates,
            String coverCacheKey, CoverSource selectedCoverSource, String selectedCoverStagingPath,
            UUID duplicateBookId, List<UUID> similarBookIds, String targetPath, String errorCode,
            String errorDetail, String idempotencyKey, UUID committedBookId, OffsetDateTime expiresAt,
            OffsetDateTime createdAt, OffsetDateTime updatedAt) {
        BookUpload view() {
            String cover = coverCacheKey == null && selectedCoverStagingPath == null ? null : "/api/v1/book-uploads/" + id + "/cover?v=" + updatedAt.toInstant().toEpochMilli();
            return new BookUpload(id, libraryRootId, libraryRootName, originalFilename, format, declaredSizeBytes,
                    receivedBytes, fingerprint, status, encrypted, drmProtected, digitallySigned, detectedMetadata,
                    draftMetadata, metadataCandidates, cover, selectedCoverSource, duplicateBookId, similarBookIds,
                    targetPath, errorCode, errorDetail, committedBookId, expiresAt, createdAt, updatedAt);
        }
    }
}
