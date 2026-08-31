package io.github.johntao2004.bookkin.catalog;

import io.github.johntao2004.bookkin.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

@Repository
public class DisplayCatalogRepository {
    private final DSLContext dsl;

    public DisplayCatalogRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public DisplayBookPage list(String query, String cursor, int requestedLimit) {
        int limit = Math.max(1, Math.min(100, requestedLimit));
        DisplayCursor decoded = DisplayCursor.decode(cursor);
        String rawQuery = query == null || query.isBlank() ? null : query.strip();
        String likeQuery = rawQuery == null ? null : "%" + rawQuery + "%";
        var records = dsl.fetch("""
                select e.book_id, e.sort_order, b.title, b.primary_author, b.description, b.updated_at,
                       bf.format, bf.status, bf.id as file_id
                  from display_catalog_entries e
                  join books b on b.id = e.book_id
                  left join lateral (
                    select f.id, f.format, f.status from book_files f
                     where f.book_id = b.id
                     order by case f.status when 'AVAILABLE' then 0 when 'TRASHED' then 1 else 2 end,
                              case f.format when 'EPUB' then 0 else 1 end, f.id
                     limit 1
                  ) bf on true
                 where e.catalog_id = 1
                   and (?::text is null or b.title ilike ? or b.primary_author ilike ? or coalesce(b.description, '') ilike ?)
                   and (?::bigint is null or (e.sort_order, e.book_id) > (?::bigint, ?::uuid))
                 order by e.sort_order, e.book_id
                 limit ?
                """, rawQuery, likeQuery, likeQuery, likeQuery,
                decoded == null ? null : decoded.order(), decoded == null ? null : decoded.order(),
                decoded == null ? null : decoded.bookId(), limit + 1);
        boolean hasMore = records.size() > limit;
        var items = records.stream().limit(limit).map(this::map).toList();
        String next = hasMore && !items.isEmpty()
                ? DisplayCursor.encode(items.getLast().sortOrder(), UUID.fromString(items.getLast().id()))
                : null;
        return new DisplayBookPage(items, next, revision());
    }

    public DisplayBook find(UUID bookId) {
        return dsl.fetchOptional("""
                select e.book_id, e.sort_order, b.title, b.primary_author, b.description, b.updated_at,
                       bf.format, bf.status, bf.id as file_id
                  from display_catalog_entries e
                  join books b on b.id = e.book_id
                  left join lateral (
                    select f.id, f.format, f.status from book_files f
                     where f.book_id = b.id
                     order by case f.status when 'AVAILABLE' then 0 when 'TRASHED' then 1 else 2 end,
                              case f.format when 'EPUB' then 0 else 1 end, f.id
                     limit 1
                  ) bf on true
                 where e.catalog_id = 1 and e.book_id = ?
                """, bookId).map(this::map)
                .orElseThrow(() -> ApiException.notFound("DISPLAY_BOOK_NOT_FOUND", "这本书不在公共展示书目中。"));
    }

    public boolean contains(UUID bookId) {
        var record = dsl.fetchOne("select exists(select 1 from display_catalog_entries where catalog_id = 1 and book_id = ?)", bookId);
        return record != null && Boolean.TRUE.equals(record.get(0, Boolean.class));
    }

    public long revision() {
        var record = dsl.fetchOne("select revision from display_catalog where id = 1");
        Long revision = record == null ? null : record.get(0, Long.class);
        return revision == null ? 0 : revision;
    }

    public DisplayBook add(UUID bookId, UUID actorId, long expectedRevision) {
        lockAndCheckRevision(expectedRevision);
        if (contains(bookId)) return find(bookId);
        return insert(bookId, actorId);
    }

    public DisplayBook publish(UUID bookId, UUID actorId) {
        lockCatalog();
        if (contains(bookId)) return find(bookId);
        return insert(bookId, actorId);
    }

    public boolean remove(UUID bookId, long expectedRevision) {
        lockAndCheckRevision(expectedRevision);
        int deleted = dsl.execute("delete from display_catalog_entries where catalog_id = 1 and book_id = ?", bookId);
        if (deleted > 0) bumpRevision();
        return deleted > 0;
    }

    public DisplayBookPage reorder(List<UUID> orderedBookIds, long expectedRevision) {
        lockAndCheckRevision(expectedRevision);
        List<UUID> current = dsl.fetch("select book_id from display_catalog_entries where catalog_id = 1 order by sort_order, book_id")
                .getValues("book_id", UUID.class);
        if (current.size() != orderedBookIds.size() || !new HashSet<>(current).equals(new HashSet<>(orderedBookIds))) {
            throw ApiException.conflict("DISPLAY_CATALOG_CHANGED", "公共书单已发生变化，请刷新后重试。");
        }
        for (int index = 0; index < orderedBookIds.size(); index++) {
            dsl.execute("update display_catalog_entries set sort_order = ?, updated_at = now() where catalog_id = 1 and book_id = ?",
                    index + 1L, orderedBookIds.get(index));
        }
        bumpRevision();
        return list(null, null, 100);
    }

    private void lockAndCheckRevision(long expectedRevision) {
        Long actual = lockCatalog();
        if (actual == null || actual != expectedRevision) {
            throw ApiException.conflict("DISPLAY_CATALOG_CHANGED", "公共书单已发生变化，请刷新后重试。");
        }
    }

    private Long lockCatalog() {
        var record = dsl.fetchOne("select revision from display_catalog where id = 1 for update");
        return record == null ? null : record.get(0, Long.class);
    }

    private DisplayBook insert(UUID bookId, UUID actorId) {
        var record = dsl.fetchOne("select coalesce(max(sort_order), 0) + 1 from display_catalog_entries where catalog_id = 1");
        Long nextOrder = record == null ? null : record.get(0, Long.class);
        dsl.execute("insert into display_catalog_entries(catalog_id, book_id, sort_order, created_by) values (1, ?, ?, ?)",
                bookId, nextOrder == null ? 1 : nextOrder, actorId);
        bumpRevision();
        return find(bookId);
    }

    private void bumpRevision() {
        dsl.execute("update display_catalog set revision = revision + 1, updated_at = now() where id = 1");
    }

    private DisplayBook map(Record record) {
        String format = record.get("format", String.class);
        String status = record.get("status", String.class);
        UUID bookId = record.get("book_id", UUID.class);
        OffsetDateTime updatedAt = record.get("updated_at", OffsetDateTime.class);
        return new DisplayBook(bookId.toString(), record.get("title", String.class), record.get("primary_author", String.class),
                record.get("description", String.class), format == null ? null : BookFormat.valueOf(format),
                "/api/v1/display-books/" + bookId + "/cover?v=" + (updatedAt == null ? 0 : updatedAt.toInstant().toEpochMilli()),
                "AVAILABLE".equals(status), record.get("sort_order", Long.class));
    }

    public record DisplayBook(String id, String title, String author, String description, BookFormat format,
                              String coverUrl, boolean available, long sortOrder) {}

    public record DisplayBookPage(List<DisplayBook> items, String nextCursor, long revision) {}

    private record DisplayCursor(long order, UUID bookId) {
        static String encode(long order, UUID bookId) {
            return Base64.getUrlEncoder().withoutPadding().encodeToString((order + ":" + bookId).getBytes(StandardCharsets.UTF_8));
        }

        static DisplayCursor decode(String value) {
            if (value == null || value.isBlank()) return null;
            try {
                String[] parts = new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8).split(":", 2);
                return new DisplayCursor(Long.parseLong(parts[0]), UUID.fromString(parts[1]));
            } catch (RuntimeException exception) {
                throw ApiException.conflict("INVALID_DISPLAY_CURSOR", "公共书单游标无效，请重新加载。");
            }
        }
    }
}
