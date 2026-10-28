package com.elexvx.bookkin.catalog.terms;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** Persistence gateway over shared tags/series and versioned language/knowledge vocabulary tables. */
@Repository
public class MetadataTermRepository {
    private final DSLContext dsl;

    public MetadataTermRepository(DSLContext dsl) { this.dsl = dsl; }

    public List<MetadataTerm> search(MetadataTermKind kind, String query, int limit) {
        String pattern = "%" + escapeLike(query) + "%";
        int scanLimit = Math.min(120, Math.max(limit, limit * 4));
        List<MetadataTerm> candidates = switch (kind) {
            case LANGUAGE -> dsl.fetch("""
                    select id, value, label from language_terms
                     where lower(value) like lower(?) escape chr(92) or lower(label) like lower(?) escape chr(92)
                     order by lower(label), id limit ?
                    """, pattern, pattern, scanLimit).map(row -> languageTerm(row.get("id", UUID.class),
                    row.get("value", String.class), row.get("label", String.class)));
            case SERIES -> dsl.fetch("""
                    select id, name as value from series
                     where lower(name) like lower(?) escape chr(92)
                     order by lower(name), id limit ?
                    """, pattern, scanLimit).map(row -> new MetadataTerm(row.get("id", UUID.class).toString(), kind,
                    row.get("value", String.class), row.get("value", String.class)));
            case TAG -> dsl.fetch("""
                    select id, name as value from tags
                     where lower(name) like lower(?) escape chr(92)
                     order by lower(name), id limit ?
                    """, pattern, scanLimit).map(row -> new MetadataTerm(row.get("id", UUID.class).toString(), kind,
                    row.get("value", String.class), row.get("value", String.class)));
            case KNOWLEDGE -> dsl.fetch("""
                    select id, value, label from knowledge_terms
                     where lower(value) like lower(?) escape chr(92) or lower(label) like lower(?) escape chr(92)
                     order by lower(label), id limit ?
                    """, pattern, pattern, scanLimit).map(row -> new MetadataTerm(row.get("id", UUID.class).toString(), kind,
                    row.get("value", String.class), row.get("label", String.class)));
        };
        var unique = new LinkedHashMap<String, MetadataTerm>();
        for (MetadataTerm term : candidates) {
            unique.putIfAbsent(termKey(kind, term), term);
            if (unique.size() >= limit) break;
        }
        return List.copyOf(unique.values());
    }

    public MetadataTerm ensure(MetadataTermKind kind, String value, String label) {
        String key = MetadataTermText.normalizedKey(kind == MetadataTermKind.LANGUAGE
                ? MetadataTermText.canonicalLanguageValue(value) : value);
        dsl.execute("select pg_advisory_xact_lock(hashtextextended(?, 0))", "metadata-term:" + kind + ":" + key);
        Optional<MetadataTerm> existing = findEquivalent(kind, key);
        if (existing.isPresent()) return existing.get();

        UUID id = UUID.randomUUID();
        switch (kind) {
            case LANGUAGE -> dsl.execute("""
                    insert into language_terms(id, normalized_value, value, label) values (?, ?, ?, ?)
                    on conflict (normalized_value) do nothing
                    """, id, key, value, label);
            case KNOWLEDGE -> dsl.execute("""
                    insert into knowledge_terms(id, normalized_value, value, label) values (?, ?, ?, ?)
                    on conflict (normalized_value) do nothing
                    """, id, key, value, label);
            case SERIES -> dsl.execute("insert into series(id, name, sort_name) values (?, ?, lower(?)) on conflict do nothing",
                    id, value, value);
            case TAG -> dsl.execute("insert into tags(id, name) values (?, ?) on conflict do nothing", id, value);
        }
        return findEquivalent(kind, key).orElseThrow(() -> new IllegalStateException("无法保存元数据词条。"));
    }

    public void replaceBookKnowledgeTerms(UUID bookId, List<MetadataTerm> terms) {
        dsl.fetchOne("select id from books where id = ? for update", bookId);
        dsl.execute("delete from book_knowledge_terms where book_id = ?", bookId);
        for (MetadataTerm term : terms) {
            dsl.execute("insert into book_knowledge_terms(book_id, term_id) values (?, ?) on conflict do nothing",
                    bookId, UUID.fromString(term.id()));
        }
    }

    public List<String> knowledgeTermsForBook(UUID bookId) {
        return dsl.fetch("""
                select t.value from book_knowledge_terms bt
                join knowledge_terms t on t.id = bt.term_id
                where bt.book_id = ? order by lower(t.label), t.id
                """, bookId).getValues("value", String.class);
    }

    private Optional<MetadataTerm> findEquivalent(MetadataTermKind kind, String key) {
        return all(kind).stream().filter(term -> termKey(kind, term).equals(key)).findFirst();
    }

    private List<MetadataTerm> all(MetadataTermKind kind) {
        return switch (kind) {
            case LANGUAGE -> dsl.fetch("select id, value, label from language_terms order by id")
                    .map(row -> languageTerm(row.get("id", UUID.class), row.get("value", String.class), row.get("label", String.class)));
            case KNOWLEDGE -> dsl.fetch("select id, value, label from knowledge_terms order by id")
                    .map(row -> new MetadataTerm(row.get("id", UUID.class).toString(), kind,
                            row.get("value", String.class), row.get("label", String.class)));
            case SERIES -> dsl.fetch("select id, name as value from series order by id")
                    .map(row -> new MetadataTerm(row.get("id", UUID.class).toString(), kind,
                            row.get("value", String.class), row.get("value", String.class)));
            case TAG -> dsl.fetch("select id, name as value from tags order by id")
                    .map(row -> new MetadataTerm(row.get("id", UUID.class).toString(), kind,
                            row.get("value", String.class), row.get("value", String.class)));
        };
    }

    private MetadataTerm languageTerm(UUID id, String value, String label) {
        MetadataTermText.LanguageValue language = MetadataTermText.language(value, label);
        return new MetadataTerm(id.toString(), MetadataTermKind.LANGUAGE, language.value(), language.label());
    }

    private String termKey(MetadataTermKind kind, MetadataTerm term) {
        String value = kind == MetadataTermKind.LANGUAGE ? MetadataTermText.canonicalLanguageValue(term.value()) : term.value();
        return MetadataTermText.normalizedKey(value);
    }

    private String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
