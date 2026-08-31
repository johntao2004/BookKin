package io.github.johntao2004.bookkin.catalog;

import io.github.johntao2004.bookkin.common.ApiException;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class BooklistRepository {
    private final DSLContext dsl;

    public BooklistRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public BooklistList listVisible(String query, UUID viewerId, boolean authenticated, boolean manager) {
        String normalized = query == null || query.isBlank() ? null : "%" + query.strip() + "%";
        var records = dsl.fetch("""
                select bl.*, u.display_name as owner_display_name
                  from booklists bl join app_users u on u.id = bl.owner_id
                 where (?::text is null or bl.title ilike ? or coalesce(bl.description, '') ilike ?)
                   and ((?::boolean = false and bl.visibility = 'PUBLIC')
                     or (?::boolean = true and (
                          bl.owner_id = ?
                          or bl.visibility in ('MEMBERS', 'PUBLIC')
                     )))
                 order by case bl.kind when 'OFFICIAL' then 0 else 1 end, bl.sort_order, bl.updated_at desc, bl.id
                """, normalized, normalized, normalized, authenticated, authenticated, viewerId);
        boolean publicOnly = !authenticated;
        return new BooklistList(records.stream()
                .map(record -> summary(record, viewerId, manager, publicOnly))
                .toList());
    }

    public RawBooklist findRaw(UUID id) {
        return dsl.fetchOptional("""
                select bl.*, u.display_name as owner_display_name
                  from booklists bl join app_users u on u.id = bl.owner_id where bl.id = ?
                """, id).map(this::raw)
                .orElseThrow(() -> ApiException.notFound("BOOKLIST_NOT_FOUND", "未找到这个书单。"));
    }

    public BooklistDetail detail(RawBooklist raw, UUID viewerId, boolean manager, boolean publicOnly) {
        boolean editable = editable(raw, viewerId, manager);
        return new BooklistDetail(raw.id().toString(), raw.title(), raw.description(), raw.kind(), raw.visibility(),
                raw.ownerDisplayName(), count(raw.id(), publicOnly), preview(raw.id(), publicOnly),
                viewerId != null && raw.ownerId().equals(viewerId), editable, raw.revision(),
                editable && raw.visibility() == BooklistVisibility.PUBLIC ? nonPublicCount(raw.id()) : 0,
                raw.updatedAt());
    }

    public BrowseBookPage books(UUID booklistId, String query, BookFormat format, String cursor,
                                int requestedLimit, boolean publicOnly) {
        int limit = Math.max(1, Math.min(100, requestedLimit));
        int offset = offset(cursor);
        String normalized = query == null || query.isBlank() ? null : "%" + query.strip() + "%";
        String formatName = format == null ? null : format.name();
        String publicJoin = publicOnly
                ? " join display_catalog_entries de on de.catalog_id = 1 and de.book_id = b.id "
                : "";
        var records = dsl.fetch("""
                select b.id as book_id, b.title, b.primary_author, b.description, b.created_at, b.updated_at,
                       bf.format, bf.status, be.sort_order
                  from booklist_entries be join books b on b.id = be.book_id
                """ + publicJoin + """
                  left join lateral (
                    select f.format, f.status from book_files f where f.book_id = b.id
                     order by case f.status when 'AVAILABLE' then 0 when 'TRASHED' then 1 else 2 end,
                              case f.format when 'EPUB' then 0 else 1 end, f.id limit 1
                  ) bf on true
                 where be.booklist_id = ?
                   and (?::text is null or b.title ilike ? or b.primary_author ilike ? or coalesce(b.description, '') ilike ?)
                   and (?::varchar is null or bf.format = ?)
                 order by be.sort_order, be.book_id offset ? limit ?
                """, booklistId, normalized, normalized, normalized, normalized,
                formatName, formatName, offset, limit + 1);
        boolean hasMore = records.size() > limit;
        var items = records.stream().limit(limit).map(record -> mapBook(record, publicOnly)).toList();
        return new BrowseBookPage(items, hasMore ? String.valueOf(offset + limit) : null);
    }

    @Transactional
    public RawBooklist create(UUID ownerId, BooklistKind kind, BooklistVisibility visibility,
                              String title, String description) {
        Record nextOrderRecord = kind == BooklistKind.OFFICIAL
                ? dsl.fetchOne("select coalesce(max(sort_order), 0) + 1 from booklists where kind = 'OFFICIAL'")
                : dsl.fetchOne("select coalesce(max(sort_order), 0) + 1 from booklists where kind = 'PERSONAL' and owner_id = ?",
                        ownerId);
        Long nextOrder = nextOrderRecord == null ? null : nextOrderRecord.get(0, Long.class);
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into booklists(id, owner_id, kind, visibility, title, description, sort_order)
                values (?, ?, ?, ?, ?, ?, ?)
                """, id, ownerId, kind.name(), visibility.name(), title, description, nextOrder == null ? 1L : nextOrder);
        return findRaw(id);
    }

    @Transactional
    public RawBooklist update(UUID id, String title, String description, BooklistVisibility visibility, long revision) {
        lockAndCheck(id, revision);
        dsl.execute("""
                update booklists set title = ?, description = ?, visibility = ?, revision = revision + 1,
                  updated_at = now() where id = ?
                """, title, description, visibility.name(), id);
        return findRaw(id);
    }

    @Transactional
    public void delete(UUID id, long revision) {
        lockAndCheck(id, revision);
        dsl.execute("delete from booklists where id = ?", id);
    }

    @Transactional
    public RawBooklist addBooks(UUID id, List<UUID> bookIds, long revision) {
        lockAndCheck(id, revision);
        Record nextOrderRecord = dsl.fetchOne("select coalesce(max(sort_order), 0) + 1 from booklist_entries where booklist_id = ?", id);
        Long nextOrder = nextOrderRecord == null ? null : nextOrderRecord.get(0, Long.class);
        long order = nextOrder == null ? 1L : nextOrder;
        boolean changed = false;
        for (UUID bookId : bookIds.stream().distinct().toList()) {
            int inserted = dsl.execute("""
                    insert into booklist_entries(booklist_id, book_id, sort_order) values (?, ?, ?)
                    on conflict (booklist_id, book_id) do nothing
                    """, id, bookId, order++);
            changed = changed || inserted > 0;
        }
        if (changed) bumpRevision(id);
        return findRaw(id);
    }

    @Transactional
    public RawBooklist removeBook(UUID id, UUID bookId, long revision) {
        lockAndCheck(id, revision);
        if (dsl.execute("delete from booklist_entries where booklist_id = ? and book_id = ?", id, bookId) > 0) {
            compactOrder(id);
            bumpRevision(id);
        }
        return findRaw(id);
    }

    @Transactional
    public RawBooklist reorder(UUID id, List<UUID> orderedBookIds, long revision) {
        lockAndCheck(id, revision);
        List<UUID> current = allBookIds(id);
        if (current.size() != orderedBookIds.size() || new HashSet<>(orderedBookIds).size() != orderedBookIds.size()
                || !new HashSet<>(current).equals(new HashSet<>(orderedBookIds))) {
            throw ApiException.conflict("BOOKLIST_CHANGED", "书单已经变化，请刷新后重试。");
        }
        for (int index = 0; index < orderedBookIds.size(); index++) {
            dsl.execute("update booklist_entries set sort_order = ?, updated_at = now() where booklist_id = ? and book_id = ?",
                    index + 1L, id, orderedBookIds.get(index));
        }
        bumpRevision(id);
        return findRaw(id);
    }

    public List<UUID> allBookIds(UUID booklistId) {
        return dsl.fetch("select book_id from booklist_entries where booklist_id = ? order by sort_order, book_id", booklistId)
                .getValues("book_id", UUID.class);
    }

    public List<String> nonPublicBookTitles(UUID booklistId) {
        return dsl.fetch("""
                select b.title from booklist_entries be join books b on b.id = be.book_id
                 where be.booklist_id = ? and not exists (
                   select 1 from display_catalog_entries de where de.catalog_id = 1 and de.book_id = be.book_id
                 ) order by be.sort_order, be.book_id
                """, booklistId).getValues("title", String.class);
    }

    public List<String> nonPublicBookTitles(List<UUID> bookIds) {
        if (bookIds.isEmpty()) return List.of();
        return dsl.fetch("""
                select b.title from books b where b.id = any(?::uuid[]) and not exists (
                  select 1 from display_catalog_entries de where de.catalog_id = 1 and de.book_id = b.id
                ) order by b.title
                """, (Object) bookIds.toArray(UUID[]::new)).getValues("title", String.class);
    }

    private BooklistSummary summary(Record record, UUID viewerId, boolean manager, boolean publicOnly) {
        RawBooklist raw = raw(record);
        boolean editable = editable(raw, viewerId, manager);
        return new BooklistSummary(raw.id().toString(), raw.title(), raw.description(), raw.kind(), raw.visibility(),
                raw.ownerDisplayName(), count(raw.id(), publicOnly), preview(raw.id(), publicOnly),
                viewerId != null && raw.ownerId().equals(viewerId), editable, raw.revision(),
                editable && raw.visibility() == BooklistVisibility.PUBLIC ? nonPublicCount(raw.id()) : 0,
                raw.updatedAt());
    }

    private RawBooklist raw(Record record) {
        return new RawBooklist(record.get("id", UUID.class), record.get("owner_id", UUID.class),
                record.get("owner_display_name", String.class), BooklistKind.valueOf(record.get("kind", String.class)),
                BooklistVisibility.valueOf(record.get("visibility", String.class)), record.get("title", String.class),
                record.get("description", String.class), record.get("revision", Long.class),
                record.get("updated_at", OffsetDateTime.class));
    }

    private long count(UUID booklistId, boolean publicOnly) {
        Record record = publicOnly
                ? dsl.fetchOne("""
                        select count(*) from booklist_entries be
                          join display_catalog_entries de on de.catalog_id = 1 and de.book_id = be.book_id
                         where be.booklist_id = ?
                        """, booklistId)
                : dsl.fetchOne("select count(*) from booklist_entries where booklist_id = ?", booklistId);
        Long value = record == null ? null : record.get(0, Long.class);
        return value == null ? 0 : value;
    }

    private int nonPublicCount(UUID booklistId) {
        return nonPublicBookTitles(booklistId).size();
    }

    private List<BrowseBook> preview(UUID booklistId, boolean publicOnly) {
        String publicJoin = publicOnly
                ? " join display_catalog_entries de on de.catalog_id = 1 and de.book_id = b.id "
                : "";
        var records = dsl.fetch("""
                select b.id as book_id, b.title, b.primary_author, b.description, b.created_at, b.updated_at,
                       bf.format, bf.status, be.sort_order
                  from booklist_entries be join books b on b.id = be.book_id
                """ + publicJoin + """
                  left join lateral (
                    select f.format, f.status from book_files f where f.book_id = b.id
                     order by case f.status when 'AVAILABLE' then 0 when 'TRASHED' then 1 else 2 end,
                              case f.format when 'EPUB' then 0 else 1 end, f.id limit 1
                  ) bf on true
                 where be.booklist_id = ? order by be.sort_order, be.book_id limit 4
                """, booklistId);
        return records.map(record -> mapBook(record, publicOnly));
    }

    private BrowseBook mapBook(Record record, boolean publicOnly) {
        UUID id = record.get("book_id", UUID.class);
        String format = record.get("format", String.class);
        String status = record.get("status", String.class);
        OffsetDateTime updatedAt = record.get("updated_at", OffsetDateTime.class);
        String coverPrefix = publicOnly ? "/api/v1/display-books/" : "/api/v1/books/";
        return new BrowseBook(id.toString(), record.get("title", String.class), record.get("primary_author", String.class),
                record.get("description", String.class), format == null ? null : BookFormat.valueOf(format),
                coverPrefix + id + "/cover?v=" + (updatedAt == null ? 0 : updatedAt.toInstant().toEpochMilli()),
                "AVAILABLE".equals(status), record.get("created_at", OffsetDateTime.class));
    }

    private boolean editable(RawBooklist raw, UUID viewerId, boolean manager) {
        if (viewerId == null) return false;
        if (raw.visibility() == BooklistVisibility.PRIVATE && !raw.ownerId().equals(viewerId)) return false;
        return raw.kind() == BooklistKind.OFFICIAL ? manager : raw.ownerId().equals(viewerId);
    }

    private RawBooklist lockAndCheck(UUID id, long expectedRevision) {
        RawBooklist raw = dsl.fetchOptional("""
                select bl.*, u.display_name as owner_display_name from booklists bl
                  join app_users u on u.id = bl.owner_id where bl.id = ? for update
                """, id).map(this::raw)
                .orElseThrow(() -> ApiException.notFound("BOOKLIST_NOT_FOUND", "未找到这个书单。"));
        if (raw.revision() != expectedRevision) {
            throw ApiException.conflict("BOOKLIST_CHANGED", "书单已经变化，请刷新后重试。");
        }
        return raw;
    }

    private void compactOrder(UUID id) {
        dsl.execute("""
                with ranked as (
                  select book_id, row_number() over (order by sort_order, book_id) as next_order
                    from booklist_entries where booklist_id = ?
                )
                update booklist_entries be set sort_order = ranked.next_order, updated_at = now()
                  from ranked where be.booklist_id = ? and be.book_id = ranked.book_id
                """, id, id);
    }

    private void bumpRevision(UUID id) {
        dsl.execute("update booklists set revision = revision + 1, updated_at = now() where id = ?", id);
    }

    private int offset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            int value = Integer.parseInt(cursor);
            if (value < 0) throw new NumberFormatException();
            return value;
        } catch (NumberFormatException exception) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "INVALID_BOOKLIST_CURSOR", "书单分页游标无效。");
        }
    }

    public record RawBooklist(UUID id, UUID ownerId, String ownerDisplayName, BooklistKind kind,
                              BooklistVisibility visibility, String title, String description,
                              long revision, OffsetDateTime updatedAt) {
    }

    public record BooklistSummary(String id, String title, String description, BooklistKind kind,
                                  BooklistVisibility visibility, String ownerDisplayName, long bookCount,
                                  List<BrowseBook> previewBooks, boolean ownedByViewer, boolean editable,
                                  long revision, int hiddenPublicBookCount, OffsetDateTime updatedAt) {
    }

    public record BooklistDetail(String id, String title, String description, BooklistKind kind,
                                 BooklistVisibility visibility, String ownerDisplayName, long bookCount,
                                 List<BrowseBook> previewBooks, boolean ownedByViewer, boolean editable,
                                 long revision, int hiddenPublicBookCount, OffsetDateTime updatedAt) {
    }

    public record BooklistList(List<BooklistSummary> items) {
    }
}
