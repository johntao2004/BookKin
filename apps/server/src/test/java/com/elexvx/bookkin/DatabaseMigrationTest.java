// 以真实容器数据库验证迁移能创建目录与文件日志；容器不可用时不能把跳过当作通过。
// Verifies catalog/file-journal migrations against a real container database; unavailable containers mean skipped coverage, not a pass.
package com.elexvx.bookkin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
}
