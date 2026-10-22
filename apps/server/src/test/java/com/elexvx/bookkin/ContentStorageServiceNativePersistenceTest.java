package com.elexvx.bookkin;

import com.elexvx.bookkin.filemanagement.ContentStorageService;
import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import java.nio.file.*;
import java.sql.DriverManager;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="BOOKKIN_NATIVE_TEST_URL", matches=".+")
class ContentStorageServiceNativePersistenceTest {
    @TempDir Path temporary;
    @Test void recordsOnlySuccessfulScansPersistsAcrossReadsAndNeverReturnsPaths() throws Exception {
        String url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        String schema = "bookkin_scans_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(url, user, password); var statement = admin.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").load().migrate();
                try (var connection = DriverManager.getConnection(url, user, password); var setup = connection.createStatement()) {
                    setup.execute("set search_path to " + schema + ",public");
                    var db = DSL.using(connection, SQLDialect.POSTGRES);
                    Path base = temporary.toRealPath();
                    var files = new PrivateContentStore(base.resolve("content").toString(), "", "");
                    files.initialize();
                    var service = new ContentStorageService(files, db);
                    assertThat(service.snapshots()).allMatch(snapshot -> snapshot.lastScanAt() == null);
                    OffsetDateTime before = OffsetDateTime.now();
                    assertThat(service.scanAll()).isTrue();
                    var snapshots = service.snapshots();
                    assertThat(snapshots).allMatch(snapshot -> snapshot.lastScanAt() != null && !snapshot.lastScanAt().isBefore(before));
                    var persisted = snapshots.get(1).lastScanAt();
                    assertThat(new ContentStorageService(files, db).snapshots().get(1).lastScanAt()).isEqualTo(persisted);
                    String json = new ObjectMapper().writeValueAsString(snapshots);
                    assertThat(json).doesNotContain(base.toString(), "configuredPath", "path_hash");
                    Path outside = Files.createDirectory(base.resolve("outside"));
                    Files.createSymbolicLink(base.resolve("content/vault/unsafe"), outside);
                    assertThat(service.scanAll()).isFalse();
                    assertThat(service.snapshots().get(1).lastScanAt()).isEqualTo(persisted);
                    var moved = new PrivateContentStore(base.resolve("different").toString(), "", "");
                    assertThat(new ContentStorageService(moved, db).snapshots()).allMatch(snapshot -> snapshot.lastScanAt() == null);
                }
            } finally { statement.execute("drop schema " + schema + " cascade"); }
        }
    }
}
