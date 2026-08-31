package io.github.johntao2004.bookkin.ingestion;

import io.github.johntao2004.bookkin.catalog.BookFormat;
import io.github.johntao2004.bookkin.filemanagement.FileInspector.Inspection;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class CatalogIngestionRepository {
    private final DSLContext dsl;

    public CatalogIngestionRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public String quickFingerprint(UUID rootId, String normalizedPath) {
        var record = dsl.fetchOne("select quick_fingerprint from book_files where library_root_id = ? and normalized_path = ?", rootId, normalizedPath);
        return record == null ? null : record.get(0, String.class);
    }

    public void touch(UUID rootId, String normalizedPath, UUID scanId) {
        dsl.execute("""
                update book_files set last_seen_scan_id = ?, status = case when status = 'MISSING' then 'AVAILABLE' else status end,
                  updated_at = now() where library_root_id = ? and normalized_path = ? and status <> 'OPERATING'
                """, scanId, rootId, normalizedPath);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void upsert(UUID rootId, String relativePath, String normalizedPath, BookFormat format,
                       BasicFileAttributes attributes, String quickFingerprint, String fingerprint,
                       Inspection inspection, ExtractedBook metadata, UUID scanId) {
        var existing = dsl.fetchOne("select id, book_id from book_files where library_root_id = ? and normalized_path = ?", rootId, normalizedPath);
        if (existing == null) {
            existing = dsl.fetchOne("select id, book_id from book_files where fingerprint = ? and status = 'MISSING' order by updated_at desc limit 1", fingerprint);
        }
        UUID bookId;
        UUID fileId;
        if (existing == null) {
            bookId = UUID.randomUUID();
            fileId = UUID.randomUUID();
            insertBook(bookId, metadata, "{}", new String[0]);
            insertFile(fileId, bookId, rootId, relativePath, normalizedPath, format, attributes, quickFingerprint,
                    fingerprint, inspection, scanId, metadata.pageCount(), metadata.wordCount());
        } else {
            fileId = existing.get("id", UUID.class);
            bookId = existing.get("book_id", UUID.class);
            dsl.execute("""
                    update book_files set library_root_id = ?, relative_path = ?, normalized_path = ?, format = ?,
                      status = 'AVAILABLE', size_bytes = ?, modified_at = cast(? as timestamptz), fingerprint = ?, quick_fingerprint = ?,
                      encrypted = ?, drm_protected = ?, digitally_signed = ?, page_count = ?, word_count = ?,
                      last_seen_scan_id = ?, updated_at = now()
                     where id = ? and status <> 'OPERATING'
                    """, rootId, relativePath, normalizedPath, format.name(), attributes.size(),
                    attributes.lastModifiedTime().toInstant().atOffset(ZoneOffset.UTC), fingerprint, quickFingerprint,
                    inspection.encrypted(), inspection.drmProtected(), inspection.digitallySigned(), metadata.pageCount(),
                    metadata.wordCount(), scanId, fileId);
            updateFromScan(bookId, metadata);
        }
        replaceContributors(bookId, metadata, false);
        replaceTags(bookId, metadata, false);
        applySeries(bookId, metadata.series(), metadata.seriesIndex(), false);
    }

    @Transactional
    public UUID createUploaded(UUID bookId, UUID actorId, UUID rootId, String relativePath, String normalizedPath,
                               BookFormat format, BasicFileAttributes attributes, String fingerprint, Inspection inspection,
                               ExtractedBook metadata, String metadataSourcesJson, String[] manualOverrides,
                               CoverAssetInput coverAsset) {
        if (dsl.fetchExists(dsl.selectOne().from("book_files").where("fingerprint = ? and status <> 'DELETED'", fingerprint))) {
            throw new IllegalStateException("DUPLICATE_FINGERPRINT");
        }
        insertBook(bookId, metadata, metadataSourcesJson, manualOverrides);
        applySeries(bookId, metadata.series(), metadata.seriesIndex(), true);
        replaceContributors(bookId, metadata, true);
        replaceTags(bookId, metadata, true);
        UUID fileId = UUID.randomUUID();
        insertFile(fileId, bookId, rootId, relativePath, normalizedPath, format, attributes,
                attributes.size() + ":" + attributes.lastModifiedTime().toMillis(), fingerprint, inspection, null,
                metadata.pageCount(), metadata.wordCount());
        if (coverAsset != null) {
            UUID assetId = UUID.randomUUID();
            dsl.execute("""
                    insert into book_cover_assets(id, book_id, library_root_id, relative_path, fingerprint, mime_type,
                      width, height, source, created_by) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, assetId, bookId, rootId, coverAsset.relativePath(), coverAsset.fingerprint(), coverAsset.mimeType(),
                    coverAsset.width(), coverAsset.height(), coverAsset.source(), actorId);
            dsl.execute("update books set cover_asset_id = ? where id = ?", assetId, bookId);
        }
        return bookId;
    }

    public UUID duplicateBookId(String fingerprint) {
        var record = dsl.fetchOne("select book_id from book_files where fingerprint = ? and status <> 'DELETED' order by created_at limit 1", fingerprint);
        return record == null ? null : record.get(0, UUID.class);
    }

    public UUID[] similarBooks(String title, String author) {
        return dsl.fetch("""
                select id from books where similarity(title, ?) >= 0.72
                  and similarity(primary_author, ?) >= 0.45 order by greatest(similarity(title, ?), similarity(primary_author, ?)) desc limit 5
                """, title, author, title, author).getValues(0, UUID.class).toArray(UUID[]::new);
    }

    public void markMissing(UUID rootId, UUID scanId) {
        dsl.execute("""
                update book_files set status = 'MISSING', updated_at = now()
                 where library_root_id = ? and status = 'AVAILABLE' and (last_seen_scan_id is null or last_seen_scan_id <> ?)
                """, rootId, scanId);
    }

    private void insertBook(UUID bookId, ExtractedBook metadata, String sourcesJson, String[] overrides) {
        dsl.execute("""
                insert into books(id, title, sort_title, subtitle, primary_author, description, language, publisher,
                  published_date, isbn, series_index, cover_cache_key, metadata_sources, metadata_overrides)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)
                """, bookId, metadata.title(), metadata.title().toLowerCase(Locale.ROOT), metadata.subtitle(), metadata.author(),
                metadata.description(), metadata.language(), metadata.publisher(), metadata.publishedDate(), metadata.isbn(),
                metadata.seriesIndex(), metadata.coverCacheKey(), sourcesJson == null ? "{}" : sourcesJson, overrides);
    }

    private void insertFile(UUID fileId, UUID bookId, UUID rootId, String relativePath, String normalizedPath,
                            BookFormat format, BasicFileAttributes attributes, String quickFingerprint, String fingerprint,
                            Inspection inspection, UUID scanId, Integer pageCount, Long wordCount) {
        dsl.execute("""
                insert into book_files(id, book_id, library_root_id, relative_path, normalized_path, format, size_bytes,
                  modified_at, fingerprint, quick_fingerprint, encrypted, drm_protected, digitally_signed, last_seen_scan_id,
                  page_count, word_count)
                values (?, ?, ?, ?, ?, ?, ?, cast(? as timestamptz), ?, ?, ?, ?, ?, ?, ?, ?)
                """, fileId, bookId, rootId, relativePath, normalizedPath, format.name(), attributes.size(),
                attributes.lastModifiedTime().toInstant().atOffset(ZoneOffset.UTC), fingerprint, quickFingerprint,
                inspection.encrypted(), inspection.drmProtected(), inspection.digitallySigned(), scanId, pageCount, wordCount);
    }

    private void updateFromScan(UUID bookId, ExtractedBook metadata) {
        dsl.execute("""
                update books set
                  title = case when not ('title' = any(metadata_overrides)) then ? else title end,
                  sort_title = case when not ('title' = any(metadata_overrides)) then ? else sort_title end,
                  subtitle = case when not ('subtitle' = any(metadata_overrides)) then ? else subtitle end,
                  primary_author = case when not ('authors' = any(metadata_overrides)) then ? else primary_author end,
                  description = case when not ('description' = any(metadata_overrides)) then ? else description end,
                  language = case when not ('language' = any(metadata_overrides)) then ? else language end,
                  publisher = case when not ('publisher' = any(metadata_overrides)) then ? else publisher end,
                  published_date = case when not ('publishedDate' = any(metadata_overrides)) then ? else published_date end,
                  isbn = case when not ('isbn' = any(metadata_overrides)) then ? else isbn end,
                  series_index = case when not ('seriesIndex' = any(metadata_overrides)) then ? else series_index end,
                  cover_cache_key = coalesce(?, cover_cache_key), updated_at = now() where id = ?
                """, metadata.title(), metadata.title().toLowerCase(Locale.ROOT), metadata.subtitle(), metadata.author(),
                metadata.description(), metadata.language(), metadata.publisher(), metadata.publishedDate(), metadata.isbn(),
                metadata.seriesIndex(), metadata.coverCacheKey(), bookId);
    }

    private void applySeries(UUID bookId, String series, java.math.BigDecimal index, boolean force) {
        if (!force && isManual(bookId, "series")) return;
        if (series == null || series.isBlank()) {
            dsl.execute("update books set series_id = null, series_index = coalesce(?, series_index) where id = ?", index, bookId);
            return;
        }
        dsl.execute("insert into series(id, name, sort_name) values (gen_random_uuid(), ?, ?) on conflict do nothing", series, series.toLowerCase(Locale.ROOT));
        UUID seriesId = dsl.fetchOne("select id from series where lower(name) = lower(?)", series).get(0, UUID.class);
        dsl.execute("update books set series_id = ?, series_index = ? where id = ?", seriesId, index, bookId);
    }

    private void replaceContributors(UUID bookId, ExtractedBook metadata, boolean force) {
        if (!force && isManual(bookId, "authors")) return;
        dsl.execute("delete from book_authors where book_id = ?", bookId);
        int position = 0;
        for (String author : metadata.authors()) insertContributor(bookId, author, "AUTHOR", position++);
        position = 0;
        for (String translator : metadata.translators()) insertContributor(bookId, translator, "TRANSLATOR", position++);
    }

    private void insertContributor(UUID bookId, String name, String role, int position) {
        dsl.execute("insert into authors(id, name, sort_name) select gen_random_uuid(), ?, ? where not exists (select 1 from authors where lower(name) = lower(?))",
                name, name.toLowerCase(Locale.ROOT), name);
        UUID authorId = dsl.fetchOne("select id from authors where lower(name) = lower(?) order by id limit 1", name).get(0, UUID.class);
        dsl.execute("insert into book_authors(book_id, author_id, position, contributor_role) values (?, ?, ?, ?) on conflict do nothing",
                bookId, authorId, position, role);
    }

    private void replaceTags(UUID bookId, ExtractedBook metadata, boolean force) {
        if (!force && isManual(bookId, "tags")) return;
        dsl.execute("delete from book_tags where book_id = ?", bookId);
        for (String tag : metadata.tags()) {
            dsl.execute("insert into tags(id, name) values (gen_random_uuid(), ?) on conflict do nothing", tag);
            var tagRecord = dsl.fetchOne("select id from tags where lower(name) = lower(?)", tag);
            if (tagRecord != null) dsl.execute("insert into book_tags(book_id, tag_id) values (?, ?) on conflict do nothing", bookId, tagRecord.get(0, UUID.class));
        }
    }

    private boolean isManual(UUID bookId, String field) {
        var record = dsl.fetchOne("select ? = any(metadata_overrides) as manual from books where id = ?", field, bookId);
        return record != null && Boolean.TRUE.equals(record.get("manual", Boolean.class));
    }

    public record CoverAssetInput(String relativePath, String fingerprint, String mimeType, int width, int height, String source) {}
}
