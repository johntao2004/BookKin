package io.github.johntao2004.bookkin.catalog;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class BookMetadataRepository {
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
            return new BookMetadata(bookId, record.get("title", String.class), record.get("subtitle", String.class),
                    list(authors, record.get("primary_author", String.class)), list(translators, null),
                    record.get("language", String.class), record.get("publisher", String.class),
                    record.get("published_date", String.class), record.get("isbn", String.class),
                    record.get("description", String.class), record.get("series_name", String.class),
                    record.get("series_index", BigDecimal.class), tags == null ? List.of() : Arrays.asList(tags),
                    record.get("cover_cache_key", String.class), "/api/v1/books/" + bookId + "/cover?v="
                            + record.get("updated_at", java.time.OffsetDateTime.class).toInstant().toEpochMilli(),
                    sources(record.get("metadata_sources_text", String.class)));
        });
    }

    @Transactional
    public void update(UUID bookId, MetadataPatch patch) {
        String authorSummary = patch.authors() == null ? null : patch.authors().stream().filter(value -> value != null && !value.isBlank())
                .map(String::strip).distinct().reduce((left, right) -> left + " / " + right).orElse("未知作者");
        dsl.execute("""
                update books set title = coalesce(?, title), sort_title = coalesce(lower(?), sort_title),
                  subtitle = ?, primary_author = coalesce(?, primary_author), language = ?, publisher = ?,
                  published_date = ?, isbn = ?, description = ?, series_index = ?,
                  metadata_overrides = (select array_agg(distinct field) from unnest(metadata_overrides || ?::text[]) field),
                  metadata_sources = metadata_sources || ?::jsonb, updated_at = now() where id = ?
                """, patch.title(), patch.title(), patch.subtitle(), authorSummary, patch.language(), patch.publisher(),
                patch.publishedDate(), patch.isbn(), patch.description(), patch.seriesIndex(), patch.manualFields(),
                manualSources(patch.manualFields()), bookId);
        if (patch.authors() != null || patch.translators() != null) replaceContributors(bookId,
                patch.authors() == null ? List.of() : patch.authors(), patch.translators() == null ? List.of() : patch.translators());
        if (patch.series() != null) setSeries(bookId, patch.series());
        if (patch.tags() != null) replaceTags(bookId, patch.tags());
    }

    private void replaceContributors(UUID bookId, List<String> authors, List<String> translators) {
        dsl.execute("delete from book_authors where book_id = ?", bookId);
        int position = 0;
        for (String author : clean(authors)) insertContributor(bookId, author, "AUTHOR", position++);
        position = 0;
        for (String translator : clean(translators)) insertContributor(bookId, translator, "TRANSLATOR", position++);
    }

    private void insertContributor(UUID bookId, String name, String role, int position) {
        dsl.execute("insert into authors(id, name, sort_name) select gen_random_uuid(), ?, lower(?) where not exists (select 1 from authors where lower(name) = lower(?))", name, name, name);
        UUID authorId = dsl.fetchOne("select id from authors where lower(name) = lower(?) order by id limit 1", name).get(0, UUID.class);
        dsl.execute("insert into book_authors(book_id, author_id, position, contributor_role) values (?, ?, ?, ?) on conflict do nothing", bookId, authorId, position, role);
    }

    private void setSeries(UUID bookId, String raw) {
        String name = raw.strip();
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
                               String series, BigDecimal seriesIndex, List<String> tags, String coverCacheKey,
                               String coverUrl, Map<String, String> sources) {
        public String author() { return String.join(" / ", authors); }
    }

    public record MetadataPatch(String title, String subtitle, List<String> authors, List<String> translators,
                                String language, String publisher, String publishedDate, String isbn, String description,
                                String series, BigDecimal seriesIndex, List<String> tags, String[] manualFields) {}
}
