package com.elexvx.bookkin.ingestion;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.BookMetadataRepository;
import com.elexvx.bookkin.catalog.BookMetadataRepository.MetadataPatch;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.filemanagement.FileInspector.Inspection;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.flywaydb.core.Flyway;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

class CatalogIntegrityIntegrationTest {
    private static final Inspection READABLE = new Inspection(true, false, false, false);
    private static PostgreSQLContainer<?> postgres;
    private static String jdbcUrl;
    private static String username;
    private static String password;
    private static DSLContext dsl;

    @BeforeAll
    static void migrate() {
        jdbcUrl = System.getenv("BOOKKIN_TEST_JDBC_URL");
        if (jdbcUrl == null || jdbcUrl.isBlank()) {
            Assumptions.assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "PostgreSQL test database unavailable");
            postgres = new PostgreSQLContainer<>("postgres:18-alpine");
            postgres.start();
            jdbcUrl = postgres.getJdbcUrl();
            username = postgres.getUsername();
            password = postgres.getPassword();
        } else {
            username = System.getenv().getOrDefault("BOOKKIN_TEST_DB_USER", System.getProperty("user.name"));
            password = System.getenv().getOrDefault("BOOKKIN_TEST_DB_PASSWORD", "");
        }
        Flyway.configure().dataSource(jdbcUrl, username, password).load().migrate();
        dsl = DSL.using(jdbcUrl, username, password);
    }

    @AfterAll
    static void stop() {
        if (postgres != null) postgres.stop();
    }

    @Test
    void scanRecordsDuplicatePathsAndReusesAReallyMissingFile() throws Exception {
        UUID firstRoot = root();
        UUID secondRoot = root();
        String fingerprint = "sha256:" + UUID.randomUUID();
        BasicFileAttributes attributes = attributes();
        ExtractedBook metadata = metadata("Original", "Series", 1, "Author", "Translator");

        var first = scan(firstRoot, "a.epub", fingerprint, metadata, attributes);
        var duplicate = scan(secondRoot, "b.epub", fingerprint, metadata, attributes);
        assertTrue(first.imported());
        assertFalse(duplicate.imported());
        assertEquals(1L, count("book_files", fingerprint));
        assertEquals(1L, count("catalog_duplicate_candidates", fingerprint));

        UUID originalBook = dsl.fetchOne("select book_id from book_files where fingerprint = ?", fingerprint).get(0, UUID.class);
        dsl.execute("update book_files set status = 'MISSING' where fingerprint = ?", fingerprint);
        var relocated = scan(secondRoot, "c.epub", fingerprint, metadata, attributes);
        assertTrue(relocated.imported());
        assertEquals(originalBook, dsl.fetchOne("select book_id from book_files where fingerprint = ?", fingerprint).get(0, UUID.class));
        assertEquals("c.epub", dsl.fetchOne("select relative_path from book_files where fingerprint = ?", fingerprint).get(0, String.class));
        assertEquals(1L, count("book_files", fingerprint));
    }

    @Test
    void onlyChangedManualFieldsSurviveLaterScans() throws Exception {
        UUID root = root();
        String fingerprint = "sha256:" + UUID.randomUUID();
        BasicFileAttributes attributes = attributes();
        scan(root, "manual.epub", fingerprint, metadata("Original", "Old Series", 1, "Old Author", "Old Translator"), attributes);
        UUID bookId = dsl.fetchOne("select book_id from book_files where fingerprint = ?", fingerprint).get(0, UUID.class);
        BookMetadataRepository repository = new BookMetadataRepository(dsl, new ObjectMapper());

        repository.update(bookId, new MetadataPatch("Manual Title", null, null, List.of("Manual Translator"),
                null, null, null, null, null, null, BigDecimal.valueOf(9), null, null,
                new String[]{"title", "translators", "seriesIndex"}));
        assertEquals(List.of("seriesIndex", "title", "translators"),
                dsl.fetch("select unnest(metadata_overrides) from books where id = ? order by 1", bookId).getValues(0, String.class));

        scan(root, "manual.epub", fingerprint,
                metadata("New Scanned Title", "New Series", 2, "New Author", "New Translator"), attributes);
        var result = repository.find(bookId).orElseThrow();
        assertEquals("Manual Title", result.title());
        assertEquals(List.of("New Author"), result.authors());
        assertEquals(List.of("Manual Translator"), result.translators());
        assertEquals("New Series", result.series());
        assertEquals(0, BigDecimal.valueOf(9).compareTo(result.seriesIndex()));

        repository.update(bookId, new MetadataPatch(null, null, null, null,
                null, null, null, null, null, null, null, null, null, new String[]{"subtitle"}));
        assertEquals(null, repository.find(bookId).orElseThrow().subtitle());
        assertEquals("MANUAL", repository.find(bookId).orElseThrow().sources().get("subtitle"));
        assertThrows(com.elexvx.bookkin.common.ApiException.class,
                () -> repository.update(bookId, new MetadataPatch(null, null, null, null,
                        null, null, null, null, null, null, null, null, null, new String[]{"unknown"})));
    }

    @Test
    void concurrentUploadsClaimOneLogicalBook() throws Exception {
        UUID root = root();
        String fingerprint = "sha256:" + UUID.randomUUID();
        BasicFileAttributes attributes = attributes();
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Future<UUID> first = pool.submit(() -> { start.await(); return upload(root, "one.epub", fingerprint, attributes); });
            Future<UUID> second = pool.submit(() -> { start.await(); return upload(root, "two.epub", fingerprint, attributes); });
            start.countDown();
            int succeeded = 0;
            int duplicate = 0;
            for (Future<UUID> result : List.of(first, second)) {
                try { result.get(); succeeded++; }
                catch (java.util.concurrent.ExecutionException error) {
                    assertTrue(error.getCause() instanceof CatalogIngestionRepository.DuplicateFingerprintException,
                            () -> String.valueOf(error.getCause()));
                    duplicate++;
                }
            }
            assertEquals(1, succeeded);
            assertEquals(1, duplicate);
        }
        assertEquals(1L, count("book_files", fingerprint));
        assertEquals(1L, count("book_content_claims", fingerprint));
    }

    @Test
    void databaseRejectsASecondBookEvenWhenRepositoryChecksAreBypassed() throws Exception {
        UUID root = root();
        String fingerprint = "sha256:" + UUID.randomUUID();
        scan(root, "original.epub", fingerprint, metadata("Original", null, null, "Author", null), attributes());
        UUID anotherBook = UUID.randomUUID();
        dsl.execute("insert into books(id, title, sort_title, primary_author) values (?, 'Other', 'other', 'Author')", anotherBook);

        assertThrows(org.jooq.exception.DataAccessException.class, () -> dsl.execute("""
                insert into book_files(book_id, library_root_id, relative_path, normalized_path,
                  format, size_bytes, modified_at, fingerprint, quick_fingerprint)
                values (?, ?, 'duplicate.epub', 'duplicate.epub', 'EPUB', 12, now(), ?, '12:0')
                """, anotherBook, root, fingerprint));
        assertEquals(1L, count("book_files", fingerprint));
    }

    @Test
    void unchangedScanTouchDoesNotAdvanceCatalogRevision() throws Exception {
        UUID root = root();
        UUID reader = UUID.randomUUID();
        String fingerprint = "sha256:" + UUID.randomUUID();
        BookRepository books = new BookRepository(dsl);
        long before = books.catalogRevision(reader).revision();
        scan(root, "revision.epub", fingerprint, metadata("Revision", null, null, "Author", null), attributes());
        long imported = books.catalogRevision(reader).revision();
        assertTrue(imported > before);
        var ingestion = new CatalogIngestionRepository(dsl);
        assertTrue(ingestion.quickFingerprints(root).containsKey("revision.epub"));
        ingestion.touchBatch(root, List.of("revision.epub"), UUID.randomUUID());
        assertEquals(imported, books.catalogRevision(reader).revision());
    }

    private static CatalogIngestionRepository.UpsertResult scan(UUID root, String path, String fingerprint,
                                                                 ExtractedBook metadata, BasicFileAttributes attributes) {
        return dsl.transactionResult(configuration -> new CatalogIngestionRepository(DSL.using(configuration)).upsert(
                root, path, path, BookFormat.EPUB, attributes, attributes.size() + ":" + attributes.lastModifiedTime().toMillis(),
                fingerprint, READABLE, metadata, UUID.randomUUID()));
    }

    private static UUID upload(UUID root, String path, String fingerprint, BasicFileAttributes attributes) {
        return DSL.using(jdbcUrl, username, password).transactionResult(configuration -> {
            UUID bookId = UUID.randomUUID();
            return new CatalogIngestionRepository(DSL.using(configuration)).createUploaded(bookId, UUID.randomUUID(), root,
                    path, path, BookFormat.EPUB, attributes, fingerprint, READABLE,
                    metadata("Upload", null, null, "Author", null), "{}", new String[0], null);
        });
    }

    private static ExtractedBook metadata(String title, String series, Integer index, String author, String translator) {
        return new ExtractedBook(title, "Subtitle", List.of(author), translator == null ? List.of() : List.of(translator),
                "Description", "zh-CN", "Publisher", "2026", "ISBN", series,
                index == null ? null : BigDecimal.valueOf(index), List.of("Tag"), null, null, null);
    }

    private static UUID root() {
        UUID id = UUID.randomUUID();
        dsl.execute("insert into library_roots(id, name, configured_path) values (?, ?, ?)", id, "root-" + id, "/tmp/" + id);
        return id;
    }

    private static BasicFileAttributes attributes() throws Exception {
        Path file = Files.createTempFile("bookkin-catalog-integrity-", ".epub");
        try {
            Files.writeString(file, "test-content");
            return Files.readAttributes(file, BasicFileAttributes.class);
        } finally { Files.deleteIfExists(file); }
    }

    private static long count(String table, String fingerprint) {
        return dsl.fetchOne("select count(*) from " + table + " where fingerprint = ?", fingerprint).get(0, Long.class);
    }
}
