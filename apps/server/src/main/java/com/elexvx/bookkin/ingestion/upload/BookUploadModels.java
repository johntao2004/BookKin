package com.elexvx.bookkin.ingestion.upload;

import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.knowledge.KnowledgeDraft;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class BookUploadModels {
    private BookUploadModels() {}

    public enum BookUploadStatus { RECEIVING, INSPECTING, ENRICHING, READY_FOR_REVIEW, COMMITTING, SUCCEEDED, DUPLICATE, FAILED, CANCELLED, EXPIRED }
    public enum MetadataSource { FILE, FILENAME, OPEN_LIBRARY, GOOGLE_BOOKS, WIKIDATA, AI, MANUAL }
    public enum CoverSource { EMBEDDED, PDF_FIRST_PAGE, OPEN_LIBRARY, GOOGLE_BOOKS, CUSTOM, GENERATED }

    public record MetadataDraft(
            String title, String subtitle, List<String> authors, List<String> translators, String language,
            String publisher, String publishedDate, String isbn, String description, String series,
            BigDecimal seriesIndex, List<String> tags, Integer pageCount, Long wordCount,
            Map<String, MetadataSource> sources, String targetPath, Boolean publiclyVisible,
            List<String> subjectCodes, String authorBiography, String tableOfContents, KnowledgeDraft knowledgeDraft,
            List<String> knowledgeTerms) {
        public MetadataDraft(String title, String subtitle, List<String> authors, List<String> translators, String language,
                             String publisher, String publishedDate, String isbn, String description, String series,
                             BigDecimal seriesIndex, List<String> tags, Integer pageCount, Long wordCount,
                             Map<String, MetadataSource> sources, String targetPath, Boolean publiclyVisible,
                             List<String> subjectCodes, String authorBiography, String tableOfContents) {
            this(title, subtitle, authors, translators, language, publisher, publishedDate, isbn, description, series,
                    seriesIndex, tags, pageCount, wordCount, sources, targetPath, publiclyVisible, subjectCodes,
                    authorBiography, tableOfContents, null, null);
        }
        public MetadataDraft(String title, String subtitle, List<String> authors, List<String> translators, String language,
                             String publisher, String publishedDate, String isbn, String description, String series,
                             BigDecimal seriesIndex, List<String> tags, Integer pageCount, Long wordCount,
                             Map<String, MetadataSource> sources, String targetPath, Boolean publiclyVisible,
                             List<String> subjectCodes, String authorBiography, String tableOfContents,
                             KnowledgeDraft knowledgeDraft) {
            this(title, subtitle, authors, translators, language, publisher, publishedDate, isbn, description, series,
                    seriesIndex, tags, pageCount, wordCount, sources, targetPath, publiclyVisible, subjectCodes,
                    authorBiography, tableOfContents, knowledgeDraft, null);
        }
        public MetadataDraft(String title, String subtitle, List<String> authors, List<String> translators, String language,
                             String publisher, String publishedDate, String isbn, String description, String series,
                             BigDecimal seriesIndex, List<String> tags, Integer pageCount, Long wordCount,
                             Map<String, MetadataSource> sources, String targetPath, Boolean publiclyVisible) {
            this(title, subtitle, authors, translators, language, publisher, publishedDate, isbn, description, series,
                    seriesIndex, tags, pageCount, wordCount, sources, targetPath, publiclyVisible, List.of(), null, null);
        }
        public MetadataDraft(String title, String subtitle, List<String> authors, List<String> translators, String language,
                             String publisher, String publishedDate, String isbn, String description, String series,
                             BigDecimal seriesIndex, List<String> tags, Integer pageCount, Long wordCount,
                             Map<String, MetadataSource> sources, String targetPath) {
            this(title, subtitle, authors, translators, language, publisher, publishedDate, isbn, description, series,
                    seriesIndex, tags, pageCount, wordCount, sources, targetPath, true);
        }
        public MetadataDraft withPubliclyVisible(Boolean value) {
            return new MetadataDraft(title, subtitle, authors, translators, language, publisher, publishedDate, isbn,
                    description, series, seriesIndex, tags, pageCount, wordCount, sources, targetPath, value, subjectCodes,
                    authorBiography, tableOfContents, knowledgeDraft, knowledgeTerms);
        }
        // 草稿未指定公开状态时默认公开；这里只规范化数据，不执行入库或授权。
        // Missing draft visibility defaults to public; this normalizes data without committing or authorizing ingestion.
        public MetadataDraft {
            publiclyVisible = publiclyVisible == null ? true : publiclyVisible;
            authors = clean(authors);
            translators = clean(translators);
            tags = clean(tags);
            subjectCodes = subjectCodes == null ? List.of() : List.copyOf(subjectCodes);
            sources = sources == null ? Map.of() : Map.copyOf(sources);
            knowledgeTerms = knowledgeTerms == null ? null : clean(knowledgeTerms);
        }
        private static List<String> clean(List<String> values) {
            return values == null ? List.of() : values.stream().filter(value -> value != null && !value.isBlank()).map(String::strip).distinct().toList();
        }
    }

    public record MetadataCandidate(
            String id, MetadataSource provider, String providerLabel, String title, String subtitle, List<String> authors,
            String publisher, String publishedDate, String isbn, String description, List<String> tags,
            String coverUrl, Double confidence, String matchReason, boolean requiresReview,
            String edition, String language, String sourceUrl) {
        public MetadataCandidate(String id, MetadataSource provider, String providerLabel, String title, String subtitle,
                                 List<String> authors, String publisher, String publishedDate, String isbn,
                                 String description, List<String> tags, String coverUrl, Double confidence,
                                 String matchReason, boolean requiresReview) {
            this(id, provider, providerLabel, title, subtitle, authors, publisher, publishedDate, isbn, description,
                    tags, coverUrl, confidence, matchReason, requiresReview, null, null, null);
        }
        public MetadataCandidate(String id, MetadataSource provider, String title, String subtitle, List<String> authors,
                                  String publisher, String publishedDate, String isbn, String description, List<String> tags,
                                  String coverUrl) {
            this(id, provider, null, title, subtitle, authors, publisher, publishedDate, isbn, description, tags,
                    coverUrl, null, null, false);
        }
    }

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
