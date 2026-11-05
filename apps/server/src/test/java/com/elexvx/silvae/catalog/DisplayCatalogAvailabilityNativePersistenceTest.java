package com.elexvx.silvae.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.elexvx.silvae.common.ApiException;
import java.sql.DriverManager;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@EnabledIfEnvironmentVariable(named = "SILVAE_NATIVE_TEST_URL", matches = ".+")
class DisplayCatalogAvailabilityNativePersistenceTest {
    @Test
    void publicMembershipTracksReadableFilesWithoutLosingHiddenMemberships() throws Exception {
        String url = System.getenv("SILVAE_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("SILVAE_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("SILVAE_NATIVE_TEST_PASSWORD", "");
        String schema = "silvae_display_availability_" + UUID.randomUUID().toString().replace("-", "");

        try (var admin = DriverManager.getConnection(url, user, password);
                var statement = admin.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
                        .locations("classpath:db/migration").load().migrate();

                try (var connection = DriverManager.getConnection(url, user, password);
                        var setup = connection.createStatement()) {
                    setup.execute("set search_path to " + schema + ",public");
                    var db = DSL.using(connection, SQLDialect.POSTGRES);
                    UUID owner = UUID.randomUUID();
                    UUID root = UUID.randomUUID();
                    insertUser(db, owner);
                    db.execute("insert into library_roots(id,name,configured_path) values (?,?,?)",
                            root, "display-test-root", "/tmp/" + root);

                    UUID available = insertBook(db, root, "A Public", "EPUB", "AVAILABLE");
                    UUID trashed = insertBook(db, root, "B Trashed", "EPUB", "TRASHED");
                    UUID deleted = insertBook(db, root, "C Deleted", "PDF", "DELETED");
                    UUID missing = insertBook(db, root, "D Missing", "PDF", "MISSING");
                    UUID noFile = insertBookWithoutFile(db, "E No File");
                    UUID multipleFiles = insertBookWithFiles(db, root, "F Multiple", List.of(
                            new BookFile("EPUB", "TRASHED"), new BookFile("EPUB", "AVAILABLE")));
                    UUID operating = insertBook(db, root, "G Operating", "PDF", "OPERATING");
                    UUID pdfAvailable = insertBook(db, root, "H PDF Public", "PDF", "AVAILABLE");

                    List<UUID> members = List.of(available, trashed, deleted, missing, noFile,
                            multipleFiles, operating, pdfAvailable);
                    for (int i = 0; i < members.size(); i++) {
                        insertMembership(db, members.get(i), i + 1L);
                    }

                    DisplayCatalogRepository catalog = new DisplayCatalogRepository(db);
                    assertThat(ids(catalog.list(null, null, null, BookSort.TITLE, null, 20)))
                            .containsExactly(available.toString(), missing.toString(), multipleFiles.toString(),
                                    operating.toString(), pdfAvailable.toString());

                    assertThat(ids(catalog.list("Trashed", null, null, BookSort.TITLE, null, 20))).isEmpty();
                    assertThat(ids(catalog.list("Deleted", null, null, BookSort.TITLE, null, 20))).isEmpty();
                    assertThat(ids(catalog.list("No File", null, null, BookSort.TITLE, null, 20))).isEmpty();

                    assertThat(ids(catalog.list(null, null, BookFormat.EPUB, BookSort.TITLE, null, 20)))
                            .containsExactly(available.toString(), multipleFiles.toString());
                    assertThat(ids(catalog.list(null, null, BookFormat.PDF, BookSort.TITLE, null, 20)))
                            .containsExactly(missing.toString(), operating.toString(), pdfAvailable.toString());

                    var firstPage = catalog.list(null, null, null, BookSort.TITLE, null, 2);
                    var secondPage = catalog.list(null, null, null, BookSort.TITLE, firstPage.nextCursor(), 2);
                    var thirdPage = catalog.list(null, null, null, BookSort.TITLE, secondPage.nextCursor(), 2);
                    assertThat(ids(firstPage)).containsExactly(available.toString(), missing.toString());
                    assertThat(firstPage.nextCursor()).isNotNull();
                    assertThat(ids(secondPage)).containsExactly(multipleFiles.toString(), operating.toString());
                    assertThat(secondPage.nextCursor()).isNotNull();
                    assertThat(ids(thirdPage)).containsExactly(pdfAvailable.toString());
                    assertThat(thirdPage.nextCursor()).isNull();

                    for (UUID hidden : List.of(trashed, deleted, noFile)) {
                        assertThat(catalog.contains(hidden)).isFalse();
                        assertThatThrownBy(() -> catalog.find(hidden))
                                .isInstanceOfSatisfying(ApiException.class,
                                        error -> assertThat(error.status().value()).isEqualTo(404));
                    }
                    assertThat(catalog.find(multipleFiles).available()).isTrue();
                    assertThat(catalog.contains(multipleFiles)).isTrue();
                    assertThat(catalog.find(missing).available()).isFalse();
                    assertThat(catalog.find(operating).available()).isFalse();
                    assertThat(catalog.contains(missing)).isTrue();
                    assertThat(catalog.contains(operating)).isTrue();

                    long revision = catalog.revision();
                    assertThatThrownBy(() -> catalog.add(trashed, owner, revision))
                            .isInstanceOfSatisfying(ApiException.class,
                                    error -> assertThat(error.status().value()).isEqualTo(404));
                    assertThatThrownBy(() -> catalog.publish(trashed, owner))
                            .isInstanceOfSatisfying(ApiException.class,
                                    error -> assertThat(error.status().value()).isEqualTo(404));
                    assertThat(membershipCount(db, trashed)).isEqualTo(1);

                    db.execute("update book_files set status='AVAILABLE' where book_id=? and status='TRASHED'", trashed);
                    var restored = catalog.list(null, null, null, BookSort.TITLE, null, 20);
                    assertThat(ids(restored)).containsExactly(available.toString(), trashed.toString(),
                            missing.toString(), multipleFiles.toString(), operating.toString(), pdfAvailable.toString());
                    assertThat(catalog.find(trashed).available()).isTrue();
                    assertThat(catalog.contains(trashed)).isTrue();
                    assertThat(membershipCount(db, trashed)).isEqualTo(1);
                }
            } finally {
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }

    private static void insertUser(org.jooq.DSLContext db, UUID id) {
        db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,?,?,'native-test','OWNER')",
                id, "display-owner-" + id, "展示目录测试主人");
    }

    private static UUID insertBook(org.jooq.DSLContext db, UUID root, String title, String format, String status) {
        UUID id = insertBookWithoutFile(db, title);
        insertFiles(db, root, id, List.of(new BookFile(format, status)));
        return id;
    }

    private static UUID insertBookWithoutFile(org.jooq.DSLContext db, String title) {
        UUID id = UUID.randomUUID();
        db.execute("insert into books(id,title,sort_title,primary_author) values (?,?,?,?)",
                id, title, title.toLowerCase(java.util.Locale.ROOT), "回归测试作者");
        return id;
    }

    private static UUID insertBookWithFiles(org.jooq.DSLContext db, UUID root, String title, List<BookFile> files) {
        UUID id = insertBookWithoutFile(db, title);
        insertFiles(db, root, id, files);
        return id;
    }

    private static void insertFiles(org.jooq.DSLContext db, UUID root, UUID bookId, List<BookFile> files) {
        for (BookFile file : files) {
            UUID fileId = UUID.randomUUID();
            String path = fileId + "." + file.format().toLowerCase(java.util.Locale.ROOT);
            db.execute("""
                    insert into book_files(id,book_id,library_root_id,relative_path,normalized_path,format,status,
                      size_bytes,modified_at,fingerprint,quick_fingerprint)
                    values (?,?,?,?,?,?,?,1024,?::timestamptz,?,?)
                    """, fileId, bookId, root, path, path, file.format(), file.status(), OffsetDateTime.now(),
                    "sha256:" + fileId, "quick:" + fileId);
        }
    }

    private static void insertMembership(org.jooq.DSLContext db, UUID bookId, long order) {
        db.execute("insert into display_catalog_entries(catalog_id,book_id,sort_order) values (1,?,?)", bookId, order);
    }

    private static long membershipCount(org.jooq.DSLContext db, UUID bookId) {
        return db.fetchOne("select count(*) from display_catalog_entries where catalog_id=1 and book_id=?", bookId)
                .get(0, Long.class);
    }

    private static List<String> ids(DisplayCatalogRepository.DisplayBookPage page) {
        return page.items().stream().map(DisplayCatalogRepository.DisplayBook::id).toList();
    }

    private record BookFile(String format, String status) {}
}
