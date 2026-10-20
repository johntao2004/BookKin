package com.elexvx.bookkin.annotations;

import com.elexvx.bookkin.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

// 所有批注查询与删除都绑定 userId；管理角色不构成他人私人笔记访问权。
// Annotation queries and deletes bind userId; a management role does not grant access to another reader’s private notes.
@Repository
public class AnnotationRepository {
    private final DSLContext dsl;

    public AnnotationRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<Annotation> list(UUID userId, UUID bookId) {
        if (bookId == null) {
            return dsl.fetch("""
                    select a.*, b.title as book_title, b.primary_author as book_author
                      from annotations a join books b on b.id = a.book_id
                     where a.user_id = ? order by a.updated_at desc, a.id desc limit 500
                    """, userId).map(this::map);
        }
        return dsl.fetch("""
                select a.*, b.title as book_title, b.primary_author as book_author
                  from annotations a join books b on b.id = a.book_id
                 where a.user_id = ? and a.book_id = ? order by a.updated_at desc, a.id desc
                """, userId, bookId).map(this::map);
    }

    public List<Annotation> search(UUID userId, UUID bookId, String query) {
        // 先按所有权与文本过滤，再限制结果数量，让较旧私人笔记可检索且不泄露其他读者数据。
        // Apply ownership and text matching before limiting results, so older
        // private notes are searchable without exposing another reader's data.
        return dsl.fetch("""
                select a.*, b.title as book_title, b.primary_author as book_author
                  from annotations a join books b on b.id = a.book_id
                 where a.user_id = ? and (?::uuid is null or a.book_id = ?)
                   and position(lower(?) in lower(concat_ws(' ', b.title, b.primary_author, a.quote, a.note))) > 0
                 order by a.updated_at desc, a.id desc limit 500
                """, userId, bookId, bookId, query).map(this::map);
    }

    // 用最新批注时间和书籍 ID 组成稳定排序游标，多取一条判断是否有下一页。
    // Use latest annotation time plus book ID as the ordering cursor, fetching one extra row to detect another page.
    public AnnotationBookPage listBooks(UUID userId, String query, String cursor, int requestedLimit) {
        int limit = Math.max(1, Math.min(100, requestedLimit));
        AnnotationBookCursor decoded = AnnotationBookCursor.decode(cursor);
        String normalizedQuery = query == null || query.isBlank() ? null : "%" + query.trim() + "%";
        var records = dsl.fetch("""
                select b.id as book_id, b.title as book_title, b.primary_author as book_author, b.updated_at as book_updated_at,
                       count(*)::int as annotation_count,
                       count(*) filter (where a.annotation_type = 'NOTE')::int as note_count,
                       count(*) filter (where a.annotation_style = 'HIGHLIGHT')::int as highlight_count,
                       count(*) filter (where a.annotation_style = 'UNDERLINE')::int as underline_count,
                       count(*) filter (where a.annotation_style = 'BOLD')::int as bold_count,
                       max(a.updated_at) as latest_at
                  from annotations a join books b on b.id = a.book_id
                 where a.user_id = ? and a.annotation_type <> 'BOOKMARK'
                   and (?::text is null or b.title ilike ? or b.primary_author ilike ?)
                 group by b.id, b.title, b.primary_author, b.updated_at
                having (?::timestamptz is null or (max(a.updated_at), b.id) < (?::timestamptz, ?::uuid))
                 order by max(a.updated_at) desc, b.id desc
                 limit ?
                """, userId, normalizedQuery, normalizedQuery, normalizedQuery,
                decoded == null ? null : decoded.latestAt(), decoded == null ? null : decoded.latestAt(),
                decoded == null ? null : decoded.bookId(), limit + 1);
        boolean hasMore = records.size() > limit;
        var items = records.stream().limit(limit).map(record -> new AnnotationBookSummary(
                record.get("book_id", UUID.class), record.get("book_title", String.class),
                record.get("book_author", String.class), "/api/v1/books/" + record.get("book_id", UUID.class) + "/cover?v="
                        + record.get("book_updated_at", OffsetDateTime.class).toInstant().toEpochMilli(),
                record.get("annotation_count", Integer.class), record.get("note_count", Integer.class),
                record.get("highlight_count", Integer.class), record.get("underline_count", Integer.class),
                record.get("bold_count", Integer.class), record.get("latest_at", OffsetDateTime.class))).toList();
        String nextCursor = hasMore && !items.isEmpty()
                ? AnnotationBookCursor.encode(items.getLast().latestAt(), items.getLast().bookId()) : null;
        return new AnnotationBookPage(items, nextCursor);
    }

    public Annotation create(UUID userId, UUID bookId, AnnotationType type, String locator, String quote, String note,
                             AnnotationStyle style, String color) {
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into annotations(id, user_id, book_id, annotation_type, locator, quote, note, annotation_style, color)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, userId, bookId, type.name(), locator, quote, note, style.name(), color);
        return find(userId, id).orElseThrow();
    }

    public Optional<Annotation> find(UUID userId, UUID id) {
        return dsl.fetchOptional("""
                select a.*, b.title as book_title, b.primary_author as book_author
                  from annotations a join books b on b.id = a.book_id
                 where a.user_id = ? and a.id = ?
                """, userId, id).map(this::map);
    }

    public void delete(UUID userId, UUID id) {
        dsl.execute("delete from annotations where user_id = ? and id = ?", userId, id);
    }

    private Annotation map(Record record) {
        return new Annotation(record.get("id", UUID.class), record.get("book_id", UUID.class),
                record.get("book_title", String.class), record.get("book_author", String.class),
                AnnotationType.valueOf(record.get("annotation_type", String.class)),
                record.get("locator", String.class), record.get("quote", String.class), record.get("note", String.class),
                AnnotationStyle.valueOf(record.get("annotation_style", String.class)), record.get("color", String.class), record.get("created_at", OffsetDateTime.class),
                record.get("updated_at", OffsetDateTime.class));
    }

    public enum AnnotationType { HIGHLIGHT, NOTE, BOOKMARK }
    public enum AnnotationStyle { HIGHLIGHT, UNDERLINE, BOLD }
    public record Annotation(UUID id, UUID bookId, String bookTitle, String bookAuthor, AnnotationType type, String locator,
                             String quote, String note, AnnotationStyle style, String color,
                             OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    public record AnnotationBookSummary(UUID bookId, String bookTitle, String bookAuthor, String coverUrl,
                                        int annotationCount, int noteCount, int highlightCount, int underlineCount,
                                        int boldCount, OffsetDateTime latestAt) {}
    public record AnnotationBookPage(List<AnnotationBookSummary> items, String nextCursor) {}

    private record AnnotationBookCursor(OffsetDateTime latestAt, UUID bookId) {
        static String encode(OffsetDateTime latestAt, UUID bookId) {
            String raw = latestAt + "|" + bookId;
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        }

        static AnnotationBookCursor decode(String cursor) {
            if (cursor == null || cursor.isBlank()) return null;
            try {
                String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
                String[] parts = raw.split("\\|", 2);
                if (parts.length != 2) throw new IllegalArgumentException();
                return new AnnotationBookCursor(OffsetDateTime.parse(parts[0]), UUID.fromString(parts[1]));
            } catch (RuntimeException exception) {
                throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "INVALID_CURSOR", "分页游标无效。");
            }
        }
    }
}
