// 以真实容器数据库验证迁移能创建目录与文件日志；容器不可用时不能把跳过当作通过。
// Verifies catalog/file-journal migrations against a real container database; unavailable containers mean skipped coverage, not a pass.
package com.elexvx.bookkin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.elexvx.bookkin.catalog.BookMetadataRepository;
import java.sql.DriverManager;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.ObjectMapper;

@Testcontainers(disabledWithoutDocker = true)
class DatabaseMigrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18-alpine");

    @Test
    void migrationCreatesCatalogAndFileJournal() throws Exception {
        var flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).load();
        assertTrue(flyway.migrate().migrationsExecuted >= 2);
        try (var connection = POSTGRES.createConnection("");
             var statement = connection.createStatement();
             var result = statement.executeQuery("select count(*) from information_schema.tables where table_name in ('books','book_files','file_operations','recycle_bin_entries','annotations','book_uploads','book_cover_assets','metadata_lookup_cache','categories','book_categories','booklists','booklist_entries','book_reviews','article_posts','article_collections','article_collection_articles')")) {
            assertTrue(result.next());
            assertEquals(16, result.getInt(1));
        }
    }

    @Test
    void languageExpansionPreservesLegacyValueAndPersistsMultipleLanguages() throws Exception {
        String schema = "bookkin_language_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
                var statement = admin.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                        .schemas(schema).defaultSchema(schema).target("1").load().migrate();
                UUID bookId = UUID.randomUUID();
                try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
                        var setup = connection.createStatement()) {
                    setup.execute("set search_path to " + schema + ",public");
                    var db = DSL.using(connection, SQLDialect.POSTGRES);
                    db.execute("insert into books(id,title,sort_title,language) values (?,?,?,?)", bookId, "旧书", "旧书", "zh-CN");
                }

                var upgraded = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                        .schemas(schema).defaultSchema(schema).target("2").load();
                assertEquals(1, upgraded.migrate().migrationsExecuted);

                Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                        .schemas(schema).defaultSchema(schema).load().migrate();
                try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
                        var setup = connection.createStatement()) {
                    setup.execute("set search_path to " + schema + ",public");
                    var db = DSL.using(connection, SQLDialect.POSTGRES);
                    var repository = new BookMetadataRepository(db, new ObjectMapper());
                    assertEquals("zh-CN", repository.find(bookId).orElseThrow().language());

                    String languages = String.join(",", java.util.Collections.nCopies(340, "en")) + ",abcd";
                    assertEquals(1024, languages.length());
                    repository.update(bookId, new BookMetadataRepository.MetadataPatch(null, null, null, null,
                            languages, null, null, null, null, null, null, null, List.of(), new String[]{"language"}, null, null));
                    assertEquals(languages, repository.find(bookId).orElseThrow().language());
                    assertEquals(1024, db.fetchValue("select character_maximum_length from information_schema.columns where table_schema = ? and table_name = 'books' and column_name = 'language'", Integer.class, schema));
                }
            } finally {
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }
}
