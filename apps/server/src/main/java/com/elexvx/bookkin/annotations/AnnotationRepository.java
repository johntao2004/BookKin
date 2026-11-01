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
        // Serialize mutations for one reader/book pair so simultaneous creates cannot both miss the same selection.
        // The lock key includes ownership and book scope; a hash collision only causes extra serialization.
        dsl.execute("select pg_advisory_xact_lock(hashtextextended(?::text || ':' || ?::text, 0))", userId, bookId);
        if (type != AnnotationType.BOOKMARK) {
            List<SelectionCandidate> matching = matchingSelection(userId, bookId, locator, quote);
            if (type == AnnotationType.NOTE && !matching.isEmpty()) {
                SelectionCandidate survivor = matching.stream().filter(item -> item.type() == AnnotationType.NOTE)
                        .findFirst().orElse(matching.getFirst());
                dsl.execute("""
                        update annotations
                           set annotation_type = 'NOTE', locator = ?, quote = ?, note = ?, annotation_style = ?, color = ?, updated_at = now()
                         where user_id = ? and book_id = ? and id = ?
                        """, locator, quote, note, style.name(), color, userId, bookId, survivor.id());
                deleteSelectionDuplicates(userId, bookId, matching, survivor.id());
                return find(userId, survivor.id()).orElseThrow();
            }

            if (!matching.isEmpty()) {
                // Applying a highlight to a saved note changes its presentation only; its NOTE type and text survive.
                SelectionCandidate survivor = matching.stream().filter(item -> item.type() == AnnotationType.NOTE)
                        .findFirst().orElse(matching.getFirst());
                dsl.execute("""
                        update annotations set annotation_style = ?, color = ?, updated_at = now()
                         where user_id = ? and book_id = ? and id = ?
                        """, style.name(), color, userId, bookId, survivor.id());
                return find(userId, survivor.id()).orElseThrow();
            }
        }

        return insert(userId, bookId, type, locator, quote, note, style, color);
    }

    private Annotation insert(UUID userId, UUID bookId, AnnotationType type, String locator, String quote, String note,
                              AnnotationStyle style, String color) {
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into annotations(id, user_id, book_id, annotation_type, locator, quote, note, annotation_style, color)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, userId, bookId, type.name(), locator, quote, note, style.name(), color);
        return find(userId, id).orElseThrow();
    }

    private List<SelectionCandidate> matchingSelection(UUID userId, UUID bookId, String locator, String quote) {
        String selectedQuote = normalizedQuote(quote);
        if (selectedQuote == null || selectedQuote.isEmpty() || locator == null || locator.isBlank()) return List.of();
        SelectionLocatorKey selectedLocator = selectionLocatorKey(locator);
        return dsl.fetch("""
                select id, annotation_type, locator, quote
                  from annotations
                 where user_id = ? and book_id = ? and annotation_type <> 'BOOKMARK'
                   and quote is not null and locator is not null
                 order by (annotation_type = 'NOTE') desc, updated_at desc, id desc
                 for update
                """, userId, bookId).stream()
                .filter(record -> selectedQuote.equals(normalizedQuote(record.get("quote", String.class)))
                        && selectedLocator.equals(selectionLocatorKey(record.get("locator", String.class))))
                .map(record -> new SelectionCandidate(record.get("id", UUID.class),
                        AnnotationType.valueOf(record.get("annotation_type", String.class))))
                .toList();
    }

    private void deleteSelectionDuplicates(UUID userId, UUID bookId, List<SelectionCandidate> matching, UUID survivorId) {
        UUID[] redundantIds = matching.stream().map(SelectionCandidate::id).filter(id -> !id.equals(survivorId))
                .toArray(UUID[]::new);
        if (redundantIds.length > 0) {
            dsl.execute("delete from annotations where user_id = ? and book_id = ? and id = any(?::uuid[])",
                    userId, bookId, redundantIds);
        }
    }

    private SelectionLocatorKey selectionLocatorKey(String locator) {
        if (locator == null || !locator.startsWith("epubcfi(") || !locator.endsWith(")")) {
            return new SelectionLocatorKey(locator, null, null);
        }
        String body = locator.substring("epubcfi(".length(), locator.length() - 1);
        int firstDelimiter = -1;
        int secondDelimiter = -1;
        int assertionDepth = 0;
        boolean escaped = false;
        for (int index = 0; index < body.length(); index++) {
            char character = body.charAt(index);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (character == '^') {
                escaped = true;
                continue;
            }
            if (character == '[') {
                assertionDepth++;
                continue;
            }
            if (character == ']') {
                if (--assertionDepth < 0) return exactLocatorKey(locator);
                continue;
            }
            if (character == ',' && assertionDepth == 0) {
                if (firstDelimiter < 0) firstDelimiter = index;
                else if (secondDelimiter < 0) secondDelimiter = index;
                else return exactLocatorKey(locator);
            }
        }
        if (escaped || assertionDepth != 0 || firstDelimiter <= 0 || secondDelimiter <= firstDelimiter + 1
                || secondDelimiter == body.length() - 1) return exactLocatorKey(locator);
        // EPUB range locators differ as the reader's end offset drifts; common path and start offset identify the selection.
        String common = body.substring(0, firstDelimiter);
        String start = body.substring(firstDelimiter + 1, secondDelimiter);
        return new SelectionLocatorKey(null, common, start);
    }

    private SelectionLocatorKey exactLocatorKey(String locator) {
        return new SelectionLocatorKey(locator, null, null);
    }

    private String normalizedQuote(String quote) {
        return quote == null ? null : quote.strip();
    }

    private record SelectionCandidate(UUID id, AnnotationType type) {}
    private record SelectionLocatorKey(String exactLocator, String commonPath, String startPath) {}

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
