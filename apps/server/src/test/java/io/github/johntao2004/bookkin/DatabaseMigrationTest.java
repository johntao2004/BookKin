package io.github.johntao2004.bookkin;

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
        assertEquals(7, flyway.migrate().migrationsExecuted);
        try (var connection = POSTGRES.createConnection("");
             var statement = connection.createStatement();
             var result = statement.executeQuery("select count(*) from information_schema.tables where table_name in ('books','book_files','file_operations','recycle_bin_entries','annotations','book_uploads','book_cover_assets','metadata_lookup_cache','categories','book_categories','booklists','booklist_entries')")) {
            assertTrue(result.next());
            assertEquals(12, result.getInt(1));
        }
    }
}
