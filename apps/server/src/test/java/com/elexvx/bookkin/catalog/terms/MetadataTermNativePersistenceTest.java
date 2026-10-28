package com.elexvx.bookkin.catalog.terms;

import static org.assertj.core.api.Assertions.assertThat;
import java.sql.DriverManager;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@EnabledIfEnvironmentVariable(named = "BOOKKIN_NATIVE_TEST_URL", matches = ".+")
class MetadataTermNativePersistenceTest {
    @Test void createsCanonicalSearchableTermsAndBookLinksWithoutInventingGraphEvidence() throws Exception {
        String url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        String schema = "bookkin_terms_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(url, user, password); var statement = connection.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
                        .locations("classpath:db/migration").load().migrate();
                statement.execute("set search_path to " + schema + ",public");
                var db = DSL.using(connection, SQLDialect.POSTGRES);
                var repository = new MetadataTermRepository(db);
                db.transaction(configuration -> {
                    var terms = new MetadataTermRepository(DSL.using(configuration));
                    var tag = terms.ensure(MetadataTermKind.TAG, "全 角", "全 角");
                    assertThat(terms.ensure(MetadataTermKind.TAG, "全　角", "全　角").id()).isEqualTo(tag.id());
                    var language = MetadataTermText.language("挪威语", "挪威语");
                    assertThat(language.value()).isEqualTo("no");
                    terms.ensure(MetadataTermKind.LANGUAGE, language.value(), language.label());
                    terms.ensure(MetadataTermKind.LANGUAGE, "新方言", "新方言");
                    terms.ensure(MetadataTermKind.SERIES, "测试丛书", "测试丛书");
                    var point = terms.ensure(MetadataTermKind.KNOWLEDGE, "手动知识点", "手动知识点");
                    UUID book = UUID.randomUUID();
                    db.execute("insert into books(id,title,sort_title,primary_author) values (?, '词库书籍', '词库书籍', '作者')", book);
                    terms.replaceBookKnowledgeTerms(book, List.of(point));
                    assertThat(terms.knowledgeTermsForBook(book)).containsExactly("手动知识点");
                    assertThat(db.fetchCount(DSL.table("book_knowledge"))).isZero();
                    terms.replaceBookKnowledgeTerms(book, List.of());
                    assertThat(terms.knowledgeTermsForBook(book)).isEmpty();
                });
                var reopened = new MetadataTermRepository(db);
                assertThat(reopened.search(MetadataTermKind.LANGUAGE, "新方", 30)).extracting(MetadataTerm::value).containsExactly("新方言");
                assertThat(reopened.search(MetadataTermKind.LANGUAGE, "挪威", 30)).extracting(MetadataTerm::value).containsExactly("no");
                assertThat(reopened.search(MetadataTermKind.SERIES, "丛书", 30)).hasSize(1);
                assertThat(reopened.search(MetadataTermKind.TAG, "%", 30)).isEmpty();
                assertThat(repository.search(MetadataTermKind.KNOWLEDGE, "知识", 30)).hasSize(1);
            } finally { statement.execute("drop schema " + schema + " cascade"); }
        }
    }
}
