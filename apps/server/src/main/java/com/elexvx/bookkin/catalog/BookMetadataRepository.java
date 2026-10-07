package com.elexvx.bookkin.catalog;

import com.elexvx.bookkin.common.ApiException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class BookMetadataRepository {
    private static final Set<String> EDITABLE_FIELDS = Set.of("title", "subtitle", "authors", "translators",
            "language", "publisher", "publishedDate", "isbn", "description", "series", "seriesIndex",
            "tags", "subjectCodes");
    private final DSLContext dsl;
    private final ObjectMapper json;

    public BookMetadataRepository(DSLContext dsl, ObjectMapper json) {
        this.dsl = dsl;
        this.json = json;
    }

    public Optional<BookMetadata> find(UUID bookId) {
        return dsl.fetchOptional("""
                select b.*, s.name as series_name,
                       coalesce(array(select t.name from book_tags bt join tags t on t.id = bt.tag_id where bt.book_id = b.id order by t.name), array[]::text[]) as tags,
                       coalesce(array(select a.name from book_authors ba join authors a on a.id = ba.author_id
                         where ba.book_id = b.id and ba.contributor_role = 'AUTHOR' order by ba.position), array[]::text[]) as authors,
                       coalesce(array(select a.name from book_authors ba join authors a on a.id = ba.author_id
                         where ba.book_id = b.id and ba.contributor_role = 'TRANSLATOR' order by ba.position), array[]::text[]) as translators,
                       b.metadata_sources::text as metadata_sources_text
                  from books b left join series s on s.id = b.series_id where b.id = ?
                """, bookId).map(record -> {
            String[] tags = record.get("tags", String[].class);
            String[] authors = record.get("authors", String[].class);
            String[] translators = record.get("translators", String[].class);
            String[] subjectCodes = record.get("subject_codes", String[].class);
            return new BookMetadata(bookId, record.get("title", String.class), record.get("subtitle", String.class),
                    list(authors, record.get("primary_author", String.class)), list(translators, null),
                    record.get("language", String.class), record.get("publisher", String.class),
                    record.get("published_date", String.class), record.get("isbn", String.class),
                    record.get("description", String.class), record.get("series_name", String.class),
                    record.get("series_index", BigDecimal.class), tags == null ? List.of() : Arrays.asList(tags),
                    subjectCodes == null ? List.of() : Arrays.asList(subjectCodes),
                    record.get("cover_cache_key", String.class), "/api/v1/books/" + bookId + "/cover?v="
                            + record.get("updated_at", java.time.OffsetDateTime.class).toInstant().toEpochMilli(),
                    sources(record.get("metadata_sources_text", String.class)));
        });
    }

    @Transactional
    public void update(UUID bookId, MetadataPatch patch) {
        String[] requested = patch.manualFields() == null ? new String[0] : patch.manualFields();
        for (String field : requested) {
            if (!EDITABLE_FIELDS.contains(field)) throw ApiException.badRequest("INVALID_METADATA_FIELD", "元信息字段无效：" + field);
        }
        if (Arrays.asList(requested).contains("title") && (patch.title() == null || patch.title().isBlank())) {
            throw ApiException.badRequest("INVALID_BOOK_TITLE", "书名不能为空。");
        }
        if (Arrays.asList(requested).contains("authors") && clean(patch.authors()).isEmpty()) {
            throw ApiException.badRequest("INVALID_BOOK_AUTHORS", "作者不能为空。");
        }
        dsl.fetchOne("select id from books where id = ? for update", bookId);
        BookMetadata current = find(bookId).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。"));
        List<String> changed = Arrays.stream(requested).distinct().filter(field -> differs(field, current, patch)).toList();
        if (changed.isEmpty()) return;

        Map<String, Object> columns = new LinkedHashMap<>();
        if (changed.contains("title")) {
            columns.put("title", patch.title().strip());
            columns.put("sort_title", patch.title().strip().toLowerCase(java.util.Locale.ROOT));
        }
        if (changed.contains("subtitle")) columns.put("subtitle", optionalText(patch.subtitle()));
        if (changed.contains("authors")) columns.put("primary_author", String.join(" / ", clean(patch.authors())));
        if (changed.contains("language")) columns.put("language", optionalText(patch.language()));
        if (changed.contains("publisher")) columns.put("publisher", optionalText(patch.publisher()));
        if (changed.contains("publishedDate")) columns.put("published_date", optionalText(patch.publishedDate()));
        if (changed.contains("isbn")) columns.put("isbn", optionalText(patch.isbn()));
        if (changed.contains("description")) columns.put("description", optionalText(patch.description()));
        if (changed.contains("seriesIndex")) columns.put("series_index", patch.seriesIndex());

        StringBuilder sql = new StringBuilder("update books set ");
        List<Object> values = new ArrayList<>();
        for (var entry : columns.entrySet()) {
            sql.append(entry.getKey()).append(" = ?, ");
            values.add(entry.getValue());
        }
        if (changed.contains("subjectCodes")) {
            sql.append("subject_codes = ?::text[], ");
            values.add((patch.subjectCodes() == null ? List.<String>of() : patch.subjectCodes()).toArray(String[]::new));
        }
        String[] changedFields = changed.toArray(String[]::new);
        sql.append("metadata_overrides = (select array_agg(distinct field) from unnest(metadata_overrides || ?::text[]) field), ")
                .append("metadata_sources = metadata_sources || ?::jsonb, updated_at = now() where id = ?");
        values.add(changedFields);
        values.add(manualSources(changedFields));
        values.add(bookId);
        dsl.execute(sql.toString(), values.toArray());

        if (changed.contains("authors")) replaceContributors(bookId, clean(patch.authors()), "AUTHOR");
        if (changed.contains("translators")) replaceContributors(bookId, clean(patch.translators()), "TRANSLATOR");
        if (changed.contains("series")) setSeries(bookId, patch.series());
        if (changed.contains("tags")) replaceTags(bookId, patch.tags());
    }

    private boolean differs(String field, BookMetadata current, MetadataPatch patch) {
        return switch (field) {
            case "title" -> !Objects.equals(patch.title() == null ? null : patch.title().strip(), current.title());
            case "subtitle" -> !Objects.equals(optionalText(patch.subtitle()), optionalText(current.subtitle()));
            case "authors" -> !clean(patch.authors()).equals(current.authors());
            case "translators" -> !clean(patch.translators()).equals(current.translators());
            case "language" -> !Objects.equals(optionalText(patch.language()), optionalText(current.language()));
            case "publisher" -> !Objects.equals(optionalText(patch.publisher()), optionalText(current.publisher()));
            case "publishedDate" -> !Objects.equals(optionalText(patch.publishedDate()), optionalText(current.publishedDate()));
            case "isbn" -> !Objects.equals(optionalText(patch.isbn()), optionalText(current.isbn()));
            case "description" -> !Objects.equals(optionalText(patch.description()), optionalText(current.description()));
            case "series" -> !Objects.equals(optionalText(patch.series()), optionalText(current.series()));
            case "seriesIndex" -> patch.seriesIndex() == null ? current.seriesIndex() != null
                    : current.seriesIndex() == null || patch.seriesIndex().compareTo(current.seriesIndex()) != 0;
            case "tags" -> !new HashSet<>(clean(patch.tags())).equals(new HashSet<>(current.tags()));
            case "subjectCodes" -> !Objects.equals(patch.subjectCodes() == null ? List.of() : patch.subjectCodes(), current.subjectCodes());
            default -> false;
        };
    }

    private static String optionalText(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private void replaceContributors(UUID bookId, List<String> contributors, String role) {
        dsl.execute("delete from book_authors where book_id = ? and contributor_role = ?", bookId, role);
        int position = 0;
        for (String contributor : contributors) insertContributor(bookId, contributor, role, position++);
    }

    private void insertContributor(UUID bookId, String name, String role, int position) {
        dsl.execute("insert into authors(id, name, sort_name) select gen_random_uuid(), ?, lower(?) where not exists (select 1 from authors where lower(name) = lower(?))", name, name, name);
        UUID authorId = dsl.fetchOne("select id from authors where lower(name) = lower(?) order by id limit 1", name).get(0, UUID.class);
        dsl.execute("insert into book_authors(book_id, author_id, position, contributor_role) values (?, ?, ?, ?) on conflict do nothing", bookId, authorId, position, role);
    }

    private void setSeries(UUID bookId, String raw) {
        String name = raw == null ? "" : raw.strip();
        if (name.isBlank()) {
            dsl.execute("update books set series_id = null where id = ?", bookId);
            return;
        }
        dsl.execute("insert into series(id, name, sort_name) values (gen_random_uuid(), ?, lower(?)) on conflict do nothing", name, name);
        UUID id = dsl.fetchOne("select id from series where lower(name) = lower(?)", name).get(0, UUID.class);
        dsl.execute("update books set series_id = ? where id = ?", id, bookId);
    }

    private void replaceTags(UUID bookId, List<String> values) {
        dsl.execute("delete from book_tags where book_id = ?", bookId);
        for (String name : clean(values)) {
            dsl.execute("insert into tags(id, name) values (gen_random_uuid(), ?) on conflict do nothing", name);
            UUID id = dsl.fetchOne("select id from tags where lower(name) = lower(?)", name).get(0, UUID.class);
            dsl.execute("insert into book_tags(book_id, tag_id) values (?, ?) on conflict do nothing", bookId, id);
        }
    }

    private String manualSources(String[] fields) {
        Map<String, String> result = new LinkedHashMap<>();
        for (String field : fields == null ? new String[0] : fields) result.put(field, "MANUAL");
        try { return json.writeValueAsString(result); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    private Map<String, String> sources(String raw) {
        if (raw == null || raw.isBlank()) return Map.of();
        try { return json.readValue(raw, new TypeReference<>() {}); }
        catch (Exception ignored) { return Map.of(); }
    }

    private static List<String> list(String[] values, String fallback) {
        if (values != null && values.length > 0) return Arrays.asList(values);
        return fallback == null || fallback.isBlank() ? List.of() : List.of(fallback);
    }

    private static List<String> clean(List<String> values) {
        return values == null ? List.of() : values.stream().filter(value -> value != null && !value.isBlank()).map(String::strip).distinct().toList();
    }

    public record BookMetadata(UUID id, String title, String subtitle, List<String> authors, List<String> translators,
                               String language, String publisher, String publishedDate, String isbn, String description,
                               String series, BigDecimal seriesIndex, List<String> tags, List<String> subjectCodes, String coverCacheKey,
                               String coverUrl, Map<String, String> sources) {
        public BookMetadata(UUID id, String title, String subtitle, List<String> authors, List<String> translators,
                            String language, String publisher, String publishedDate, String isbn, String description,
                            String series, BigDecimal seriesIndex, List<String> tags, String coverCacheKey,
                            String coverUrl, Map<String, String> sources) {
            this(id, title, subtitle, authors, translators, language, publisher, publishedDate, isbn, description,
                    series, seriesIndex, tags, List.of(), coverCacheKey, coverUrl, sources);
        }

        public String author() { return String.join(" / ", authors); }
    }

    public record MetadataPatch(String title, String subtitle, List<String> authors, List<String> translators,
                                String language, String publisher, String publishedDate, String isbn, String description,
                                String series, BigDecimal seriesIndex, List<String> tags, List<String> subjectCodes,
                                String[] manualFields) {}
}
