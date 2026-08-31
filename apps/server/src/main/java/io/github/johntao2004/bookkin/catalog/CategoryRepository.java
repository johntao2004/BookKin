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
public class CategoryRepository {
    private final DSLContext dsl;

    public CategoryRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public CategoryList list(String query, boolean publicOnly, boolean editable) {
        String normalized = query == null || query.isBlank() ? null : "%" + query.strip() + "%";
        var records = publicOnly
                ? dsl.fetch("""
                        select c.id, c.name, c.description, c.sort_order, count(bc.book_id) as book_count
                          from categories c
                          join book_categories bc on bc.category_id = c.id
                          join display_catalog_entries de on de.catalog_id = 1 and de.book_id = bc.book_id
                         where (?::text is null or c.name ilike ? or coalesce(c.description, '') ilike ?)
                         group by c.id, c.name, c.description, c.sort_order
                         order by c.sort_order, c.id
                        """, normalized, normalized, normalized)
                : dsl.fetch("""
                        select c.id, c.name, c.description, c.sort_order, count(bc.book_id) as book_count
                          from categories c
                          left join book_categories bc on bc.category_id = c.id
                         where (?::text is null or c.name ilike ? or coalesce(c.description, '') ilike ?)
                         group by c.id, c.name, c.description, c.sort_order
                         order by c.sort_order, c.id
                        """, normalized, normalized, normalized);
        return new CategoryList(records.stream().map(record -> summary(record, publicOnly, editable)).toList(), editable);
    }

    public CategoryDetail find(UUID categoryId, boolean publicOnly, boolean editable) {
        String sql = publicOnly ? """
                select c.id, c.name, c.description, c.sort_order, count(bc.book_id) as book_count
                  from categories c
                  join book_categories bc on bc.category_id = c.id
                  join display_catalog_entries de on de.catalog_id = 1 and de.book_id = bc.book_id
                 where c.id = ?
                 group by c.id, c.name, c.description, c.sort_order
                """ : """
                select c.id, c.name, c.description, c.sort_order, count(bc.book_id) as book_count
                  from categories c
                  left join book_categories bc on bc.category_id = c.id
                 where c.id = ?
                 group by c.id, c.name, c.description, c.sort_order
                """;
        return dsl.fetchOptional(sql, categoryId)
                .map(record -> detail(record, publicOnly, editable))
                .orElseThrow(() -> ApiException.notFound("CATEGORY_NOT_FOUND", "未找到这个分类。"));
    }

    public BrowseBookPage books(UUID categoryId, String query, BookFormat format, BookSort sort,
                                String cursor, int requestedLimit, boolean publicOnly) {
        int limit = Math.max(1, Math.min(100, requestedLimit));
        int offset = offset(cursor);
        String normalized = query == null || query.isBlank() ? null : "%" + query.strip() + "%";
        String formatName = format == null ? null : format.name();
        BookSort selectedSort = sort == null ? BookSort.RECENT : sort;
        String publicJoin = publicOnly
                ? " join display_catalog_entries de on de.catalog_id = 1 and de.book_id = b.id "
                : "";
        String order = switch (selectedSort) {
            case RECENT -> "b.created_at desc, b.id desc";
            case TITLE -> "b.sort_title, b.id";
            case AUTHOR -> "lower(b.primary_author), b.id";
        };
        var records = dsl.fetch("""
                select b.id as book_id, b.title, b.primary_author, b.description, b.created_at, b.updated_at,
                       bf.format, bf.status
                  from book_categories bc
                  join books b on b.id = bc.book_id
                """ + publicJoin + """
                  left join lateral (
                    select f.format, f.status from book_files f where f.book_id = b.id
                     order by case f.status when 'AVAILABLE' then 0 when 'TRASHED' then 1 else 2 end,
                              case f.format when 'EPUB' then 0 else 1 end, f.id limit 1
                  ) bf on true
                 where bc.category_id = ?
                   and (?::text is null or b.title ilike ? or b.primary_author ilike ? or coalesce(b.description, '') ilike ?)
                   and (?::varchar is null or bf.format = ?)
                """ + " order by " + order + " offset ? limit ?",
                categoryId, normalized, normalized, normalized, normalized, formatName, formatName, offset, limit + 1);
        boolean hasMore = records.size() > limit;
        var items = records.stream().limit(limit).map(record -> mapBook(record, publicOnly)).toList();
        return new BrowseBookPage(items, hasMore ? String.valueOf(offset + limit) : null);
    }

    @Transactional
    public CategoryDetail create(String name, String description, UUID actorId) {
        ensureNameAvailable(name, null);
        Record nextOrderRecord = dsl.fetchOne("select coalesce(max(sort_order), 0) + 1 from categories");
        Long nextOrder = nextOrderRecord == null ? null : nextOrderRecord.get(0, Long.class);
        UUID id = UUID.randomUUID();
        dsl.execute("insert into categories(id, name, description, sort_order, created_by) values (?, ?, ?, ?, ?)",
                id, name, description, nextOrder == null ? 1L : nextOrder, actorId);
        return find(id, false, true);
    }

    @Transactional
    public CategoryDetail update(UUID id, String name, String description) {
        ensureExists(id);
        ensureNameAvailable(name, id);
        dsl.execute("update categories set name = ?, description = ?, updated_at = now() where id = ?", name, description, id);
        return find(id, false, true);
    }

    @Transactional
    public void delete(UUID id) {
        if (dsl.execute("delete from categories where id = ?", id) == 0) {
            throw ApiException.notFound("CATEGORY_NOT_FOUND", "未找到这个分类。");
        }
    }

    @Transactional
    public CategoryList reorder(List<UUID> categoryIds) {
        List<UUID> current = dsl.fetch("select id from categories order by sort_order, id").getValues("id", UUID.class);
        if (current.size() != categoryIds.size() || new HashSet<>(current).size() != current.size()
                || new HashSet<>(categoryIds).size() != categoryIds.size()
                || !new HashSet<>(current).equals(new HashSet<>(categoryIds))) {
            throw ApiException.conflict("CATEGORY_SET_CHANGED", "分类列表已经变化，请刷新后重试。");
        }
        for (int index = 0; index < categoryIds.size(); index++) {
            dsl.execute("update categories set sort_order = ?, updated_at = now() where id = ?", index + 1L, categoryIds.get(index));
        }
        return list(null, false, true);
    }

    public CategoryList assignedToBook(UUID bookId, boolean editable) {
        var records = dsl.fetch("""
                select c.id, c.name, c.description, c.sort_order, 0::bigint as book_count
                  from categories c join book_categories bc on bc.category_id = c.id
                 where bc.book_id = ? order by c.sort_order, c.id
                """, bookId);
        return new CategoryList(records.stream().map(record -> summary(record, false, editable)).toList(), editable);
    }

    @Transactional
    public CategoryList replaceBookCategories(UUID bookId, List<UUID> categoryIds, UUID actorId) {
        List<UUID> distinct = categoryIds.stream().distinct().toList();
        if (distinct.size() != categoryIds.size()) {
            throw ApiException.conflict("DUPLICATE_CATEGORY", "同一个分类不能重复选择。");
        }
        if (!distinct.isEmpty()) {
            List<UUID> existing = dsl.fetch("select id from categories where id = any(?::uuid[])",
                            (Object) distinct.toArray(UUID[]::new))
                    .getValues("id", UUID.class);
            if (existing.size() != distinct.size()) {
                throw ApiException.notFound("CATEGORY_NOT_FOUND", "部分分类已不存在，请刷新后重试。");
            }
        }
        dsl.execute("delete from book_categories where book_id = ?", bookId);
        for (UUID categoryId : distinct) {
            dsl.execute("insert into book_categories(book_id, category_id, created_by) values (?, ?, ?)",
                    bookId, categoryId, actorId);
        }
        return assignedToBook(bookId, true);
    }

    private CategorySummary summary(Record record, boolean publicOnly, boolean editable) {
        UUID id = record.get("id", UUID.class);
        return new CategorySummary(id.toString(), record.get("name", String.class), record.get("description", String.class),
                record.get("book_count", Long.class), preview(id, publicOnly), editable);
    }

    private CategoryDetail detail(Record record, boolean publicOnly, boolean editable) {
        UUID id = record.get("id", UUID.class);
        return new CategoryDetail(id.toString(), record.get("name", String.class), record.get("description", String.class),
                record.get("book_count", Long.class), preview(id, publicOnly), editable);
    }

    private List<BrowseBook> preview(UUID categoryId, boolean publicOnly) {
        String publicJoin = publicOnly
                ? " join display_catalog_entries de on de.catalog_id = 1 and de.book_id = b.id "
                : "";
        var records = dsl.fetch("""
                select b.id as book_id, b.title, b.primary_author, b.description, b.created_at, b.updated_at,
                       bf.format, bf.status
                  from book_categories bc join books b on b.id = bc.book_id
                """ + publicJoin + """
                  left join lateral (
                    select f.format, f.status from book_files f where f.book_id = b.id
                     order by case f.status when 'AVAILABLE' then 0 when 'TRASHED' then 1 else 2 end,
                              case f.format when 'EPUB' then 0 else 1 end, f.id limit 1
                  ) bf on true
                 where bc.category_id = ? order by b.created_at desc, b.id desc limit 3
                """, categoryId);
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

    private void ensureExists(UUID id) {
        Record record = dsl.fetchOne("select exists(select 1 from categories where id = ?)", id);
        Boolean exists = record == null ? null : record.get(0, Boolean.class);
        if (!Boolean.TRUE.equals(exists)) throw ApiException.notFound("CATEGORY_NOT_FOUND", "未找到这个分类。");
    }

    private void ensureNameAvailable(String name, UUID excludedId) {
        Record record = dsl.fetchOne("""
                select exists(select 1 from categories where lower(name) = lower(?) and (?::uuid is null or id <> ?))
                """, name, excludedId, excludedId);
        Boolean exists = record == null ? null : record.get(0, Boolean.class);
        if (Boolean.TRUE.equals(exists)) throw ApiException.conflict("CATEGORY_NAME_EXISTS", "已经存在同名分类。");
    }

    private int offset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            int value = Integer.parseInt(cursor);
            if (value < 0) throw new NumberFormatException();
            return value;
        } catch (NumberFormatException exception) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "INVALID_CATEGORY_CURSOR", "分类分页游标无效。");
        }
    }

    public record CategorySummary(String id, String name, String description, long bookCount,
                                  List<BrowseBook> previewBooks, boolean editable) {
    }

    public record CategoryDetail(String id, String name, String description, long bookCount,
                                 List<BrowseBook> previewBooks, boolean editable) {
    }

    public record CategoryList(List<CategorySummary> items, boolean editable) {
    }
}
