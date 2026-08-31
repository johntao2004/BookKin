package io.github.johntao2004.bookkin.catalog;

import io.github.johntao2004.bookkin.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class BookRepository {
    private final DSLContext dsl;

    public BookRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public BookPage list(UUID userId, String query, BookFormat format, BookSort sort, String cursor, int requestedLimit) {
        int limit = Math.max(1, Math.min(100, requestedLimit));
        BookSort selectedSort = sort == null ? BookSort.RECENT : sort;
        Cursor decoded = Cursor.decode(cursor, selectedSort);
        String rawQuery = query == null || query.isBlank() ? null : query.trim();
        String normalizedQuery = rawQuery == null ? null : "%" + rawQuery + "%";
        String formatName = format == null ? null : format.name();
        String base = """
                select b.id, b.title, b.primary_author, b.description, b.created_at, b.updated_at, s.name as series_name,
                       bf.id as file_id, bf.format, bf.status, bf.relative_path, bf.fingerprint, bf.word_count,
                       lr.id as root_id, lr.name as root_name,
                       coalesce(rp.progress, 0) as progress,
                       coalesce(array(select t.name from book_tags bt join tags t on t.id = bt.tag_id where bt.book_id = b.id order by t.name), array[]::text[]) as tags
                  from books b left join series s on s.id = b.series_id
                  join lateral (
                    select f.* from book_files f where f.book_id = b.id and f.status = 'AVAILABLE'
                      and (?::varchar is null or f.format = ?)
                    order by case f.format when 'EPUB' then 0 else 1 end, f.id limit 1
                  ) bf on true
                  join library_roots lr on lr.id = bf.library_root_id
                  left join reading_positions rp on rp.book_id = b.id and rp.user_id = ?
                 where (?::text is null or b.title % ? or b.primary_author % ? or b.title ilike ? or b.primary_author ilike ?
                   or exists (select 1 from book_tags bt join tags t on t.id = bt.tag_id where bt.book_id = b.id and t.name ilike ?))
                """;
        var records = switch (selectedSort) {
            case RECENT -> dsl.fetch(base + """
                     and (?::timestamptz is null or (b.created_at, b.id) < (?::timestamptz, ?::uuid))
                     order by b.created_at desc, b.id desc limit ?
                    """, formatName, formatName, userId, normalizedQuery, rawQuery, rawQuery, normalizedQuery,
                    normalizedQuery, normalizedQuery, decoded == null ? null : decoded.key(),
                    decoded == null ? null : decoded.key(), decoded == null ? null : decoded.id(), limit + 1);
            case TITLE -> dsl.fetch(base + """
                     and (?::text is null or (b.sort_title, b.id) > (?::text, ?::uuid))
                     order by b.sort_title, b.id limit ?
                    """, formatName, formatName, userId, normalizedQuery, rawQuery, rawQuery, normalizedQuery,
                    normalizedQuery, normalizedQuery, decoded == null ? null : decoded.key(),
                    decoded == null ? null : decoded.key(), decoded == null ? null : decoded.id(), limit + 1);
            case AUTHOR -> dsl.fetch(base + """
                     and (?::text is null or (lower(b.primary_author), b.id) > (?::text, ?::uuid))
                     order by lower(b.primary_author), b.id limit ?
                    """, formatName, formatName, userId, normalizedQuery, rawQuery, rawQuery, normalizedQuery,
                    normalizedQuery, normalizedQuery, decoded == null ? null : decoded.key(),
                    decoded == null ? null : decoded.key(), decoded == null ? null : decoded.id(), limit + 1);
        };
        boolean hasMore = records.size() > limit;
        var items = records.stream().limit(limit).map(this::mapSummary).toList();
        String next = hasMore && !items.isEmpty() ? Cursor.encode(selectedSort, cursorKey(selectedSort, items.getLast()),
                UUID.fromString(items.getLast().id())) : null;
        return new BookPage(items, next);
    }

    private String cursorKey(BookSort sort, BookSummary item) {
        return switch (sort) {
            case RECENT -> item.addedAt().toString();
            case TITLE -> item.title().toLowerCase(java.util.Locale.ROOT);
            case AUTHOR -> item.author().toLowerCase(java.util.Locale.ROOT);
        };
    }

    public Optional<BookSummary> findSummary(UUID userId, UUID bookId) {
        return dsl.fetchOptional("""
                select b.id, b.title, b.primary_author, b.description, b.created_at, b.updated_at, s.name as series_name,
                       bf.id as file_id, bf.format, bf.status, bf.relative_path, bf.fingerprint, bf.word_count,
                       lr.id as root_id, lr.name as root_name,
                       coalesce(rp.progress, 0) as progress,
                       coalesce(array(select t.name from book_tags bt join tags t on t.id = bt.tag_id where bt.book_id = b.id order by t.name), array[]::text[]) as tags
                  from books b left join series s on s.id = b.series_id
                  join lateral (select f.* from book_files f where f.book_id = b.id and f.status = 'AVAILABLE' order by f.id limit 1) bf on true
                  join library_roots lr on lr.id = bf.library_root_id
                  left join reading_positions rp on rp.book_id = b.id and rp.user_id = ?
                 where b.id = ?
                """, userId, bookId).map(this::mapSummary);
    }

    public Optional<BookFile> findFile(UUID id) {
        return dsl.fetchOptional("select * from book_files where id = ?", id).map(record -> new BookFile(
                record.get("id", UUID.class), record.get("book_id", UUID.class), record.get("library_root_id", UUID.class),
                record.get("relative_path", String.class), BookFormat.valueOf(record.get("format", String.class)),
                BookFileStatus.valueOf(record.get("status", String.class)), record.get("size_bytes", Long.class),
                record.get("modified_at", OffsetDateTime.class), record.get("fingerprint", String.class),
                Boolean.TRUE.equals(record.get("encrypted", Boolean.class)), Boolean.TRUE.equals(record.get("drm_protected", Boolean.class)),
                Boolean.TRUE.equals(record.get("digitally_signed", Boolean.class))));
    }

    public Optional<BookFile> findPreferredFile(UUID bookId) {
        return dsl.fetchOptional("""
                select * from book_files where book_id = ? and status = 'AVAILABLE'
                 order by case format when 'EPUB' then 0 else 1 end, id limit 1
                """, bookId).map(record -> findFile(record.get("id", UUID.class)).orElseThrow());
    }

    public boolean exists(UUID bookId) {
        var record = dsl.fetchOne("select exists(select 1 from books where id = ?)", bookId);
        return record != null && Boolean.TRUE.equals(record.get(0, Boolean.class));
    }

    public Optional<CoverLocation> findCover(UUID bookId) {
        return dsl.fetchOptional("""
                select coalesce(asset.relative_path, b.cover_cache_key) as cover_path,
                       lr.configured_path, lr.canonical_path
                  from books b join book_files bf on bf.book_id = b.id
                  join library_roots lr on lr.id = bf.library_root_id
                  left join book_cover_assets asset on asset.id = b.cover_asset_id
                 where b.id = ? and coalesce(asset.relative_path, b.cover_cache_key) is not null
                   and bf.status in ('AVAILABLE', 'TRASHED')
                 order by case bf.status when 'AVAILABLE' then 0 else 1 end, bf.id limit 1
                """, bookId).map(record -> new CoverLocation(record.get("cover_path", String.class),
                record.get("configured_path", String.class), record.get("canonical_path", String.class)));
    }

    public void updateFileLocation(UUID fileId, UUID rootId, String relativePath, String normalizedPath, String fingerprint, long sizeBytes, OffsetDateTime modifiedAt) {
        dsl.execute("""
                update book_files set library_root_id = ?, relative_path = ?, normalized_path = ?, fingerprint = ?,
                  size_bytes = ?, modified_at = ?::timestamptz, status = 'AVAILABLE', updated_at = now() where id = ?
                """, rootId, relativePath, normalizedPath, fingerprint, sizeBytes, modifiedAt, fileId);
    }

    public void updateFileStatus(UUID fileId, BookFileStatus status) {
        dsl.execute("update book_files set status = ?, updated_at = now() where id = ?", status.name(), fileId);
    }

    @Transactional
    public UUID createMovedFileAndTrashSource(BookFile source, UUID targetRootId, String relativePath,
                                              String normalizedPath, String fingerprint, long sizeBytes,
                                              OffsetDateTime modifiedAt) {
        UUID targetId = UUID.randomUUID();
        String quickFingerprint = sizeBytes + ":" + modifiedAt.toInstant().toEpochMilli();
        dsl.execute("""
                insert into book_files(id, book_id, library_root_id, relative_path, normalized_path, format, status,
                  size_bytes, modified_at, fingerprint, quick_fingerprint, encrypted, drm_protected, digitally_signed)
                values (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?, ?, ?)
                """, targetId, source.bookId(), targetRootId, relativePath, normalizedPath, source.format().name(),
                sizeBytes, modifiedAt, fingerprint, quickFingerprint, source.encrypted(), source.drmProtected(),
                source.digitallySigned());
        dsl.execute("update book_files set status = 'TRASHED', updated_at = now() where id = ?", source.id());
        return targetId;
    }

    private BookSummary mapSummary(Record record) {
        var tags = record.get("tags", String[].class);
        var bookId = record.get("id", UUID.class);
        var progress = record.get("progress", java.math.BigDecimal.class);
        return new BookSummary(
                bookId.toString(), record.get("file_id", UUID.class).toString(), record.get("title", String.class),
                record.get("primary_author", String.class), record.get("series_name", String.class), record.get("description", String.class),
                BookFormat.valueOf(record.get("format", String.class)), coverUrl(bookId, record.get("updated_at", OffsetDateTime.class)),
                progress == null ? 0 : progress.multiply(java.math.BigDecimal.valueOf(100)).intValue(),
                formatWordCount(record.get("word_count", Long.class)),
                record.get("created_at", OffsetDateTime.class), record.get("root_name", String.class),
                record.get("relative_path", String.class), record.get("fingerprint", String.class),
                BookFileStatus.valueOf(record.get("status", String.class)), tags == null ? List.of() : Arrays.asList(tags));
    }

    public record BookSummary(String id, String fileId, String title, String author, String series, String description, BookFormat format,
                              String coverUrl, int progress, String wordCount, OffsetDateTime addedAt, String libraryRoot,
                              String relativePath, String fingerprint, BookFileStatus status, List<String> tags) {}
    public record BookPage(List<BookSummary> items, String nextCursor) {}
    public record CoverLocation(String relativePath, String configuredRoot, String canonicalRoot) {}

    private String formatWordCount(Long value) {
        if (value == null) return null;
        if (value >= 10_000) return String.format(java.util.Locale.ROOT, "%.1f 万字", value / 10_000.0);
        return value + " 字";
    }

    private String coverUrl(UUID bookId, OffsetDateTime updatedAt) {
        return "/api/v1/books/" + bookId + "/cover?v=" + (updatedAt == null ? 0 : updatedAt.toInstant().toEpochMilli());
    }

    private record Cursor(String key, UUID id) {
        static Cursor decode(String cursor, BookSort expectedSort) {
            if (cursor == null || cursor.isBlank()) return null;
            try {
                String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
                String[] parts = raw.split("\\|", 3);
                if (parts.length != 3 || !parts[0].equals(expectedSort.name())) throw new IllegalArgumentException();
                String key = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
                if (expectedSort == BookSort.RECENT) OffsetDateTime.parse(key);
                return new Cursor(key, UUID.fromString(parts[2]));
            } catch (RuntimeException exception) {
                throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "INVALID_CURSOR", "分页游标无效。");
            }
        }

        static String encode(BookSort sort, String key, UUID id) {
            String encodedKey = Base64.getUrlEncoder().withoutPadding().encodeToString(key.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString((sort.name() + "|" + encodedKey + "|" + id)
                    .getBytes(StandardCharsets.UTF_8));
        }
    }
}
