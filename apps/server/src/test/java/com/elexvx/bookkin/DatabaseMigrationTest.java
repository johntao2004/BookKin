// 以真实容器数据库验证迁移能创建目录与文件日志；容器不可用时不能把跳过当作通过。
// Verifies catalog/file-journal migrations against a real container database; unavailable containers mean skipped coverage, not a pass.
package com.elexvx.bookkin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class DatabaseMigrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18-alpine");

    @Test
    void migrationCreatesCatalogAndFileJournal() throws Exception {
        var flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        try (var connection = POSTGRES.createConnection("");
             var statement = connection.createStatement();
             var result = statement.executeQuery("select count(*) from information_schema.tables where table_name in ('books','book_files','file_operations','recycle_bin_entries','annotations','book_uploads','book_cover_assets','metadata_lookup_cache','categories','book_categories','booklists','booklist_entries','book_reviews','article_posts','article_collections','article_collection_articles')")) {
            assertTrue(result.next());
            assertEquals(16, result.getInt(1));
        }
    }

    @Test
    void singleBaselineIncludesExpandedLanguageAndMetadataVocabularies() throws Exception {
        String schema = "bookkin_baseline_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
                var statement = admin.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                var migrated = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                        .schemas(schema).defaultSchema(schema).load().migrate();
                assertEquals(1, migrated.migrationsExecuted);
                try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
                        var setup = connection.createStatement()) {
                    setup.execute("set search_path to " + schema + ",public");
                    try (var language = connection.prepareStatement("select character_maximum_length from information_schema.columns where table_schema = ? and table_name = 'books' and column_name = 'language'")) {
                        language.setString(1, schema);
                        try (var result = language.executeQuery()) {
                            assertTrue(result.next());
                            assertEquals(1024, result.getInt(1));
                        }
                    }
                    try (var metadata = connection.prepareStatement("select count(*) from information_schema.tables where table_schema = ? and table_name in ('metadata_lookup_cache','metadata_provider_settings','language_terms')")) {
                        metadata.setString(1, schema);
                        try (var result = metadata.executeQuery()) {
                            assertTrue(result.next());
                            assertEquals(3, result.getInt(1));
                        }
                    }
                }
            } finally {
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }
}
