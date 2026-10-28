package com.elexvx.bookkin.ingestion.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.DisplayCatalogService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.FileFingerprints;
import com.elexvx.bookkin.filemanagement.FileInspector;
import com.elexvx.bookkin.filemanagement.PathPolicy;
import com.elexvx.bookkin.ingestion.CatalogIngestionRepository;
import com.elexvx.bookkin.ingestion.LibraryRoot;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataDraft;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;

@EnabledIfEnvironmentVariable(named = "BOOKKIN_NATIVE_TEST_URL", matches = ".+")
class BookUploadDraftNativePersistenceTest {
    @Test
    void partialDraftsPersistAcrossExpiryUntilOwnerConfirmsOrCancels(@TempDir Path rootPath) throws Exception {
        String url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        String schema = "bookkin_upload_draft_" + UUID.randomUUID().toString().replace("-", "");

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
                    UUID stranger = UUID.randomUUID();
                    UUID rootId = UUID.randomUUID();
                    insertUser(db, owner, "draft-owner", "OWNER");
                    insertUser(db, stranger, "draft-stranger", "MEMBER");
                    db.execute("insert into library_roots(id,name,configured_path) values (?,?,?)",
                            rootId, "upload-draft-root", rootPath.toRealPath().toString());

                    var uploads = new BookUploadRepository(db, new ObjectMapper());
                    var roots = mock(LibraryRootRepository.class);
                    when(roots.findById(rootId)).thenReturn(java.util.Optional.of(onlineRoot(rootId, rootPath)));
                    var users = mock(UserRepository.class);
                    BookKinUser ownerUser = user(owner);
                    BookKinUser strangerUser = user(stranger);
                    when(users.findByUsername("draft-owner")).thenReturn(java.util.Optional.of(ownerUser));
                    when(users.findByUsername("draft-stranger")).thenReturn(java.util.Optional.of(strangerUser));
                    var catalog = new CatalogIngestionRepository(db);
                    var fingerprints = new FileFingerprints();
                    var inspector = mock(FileInspector.class);
                    var service = service(uploads, roots, catalog, users, inspector, fingerprints);

                    long booksBefore = count(db, "books");
                    long publicBefore = count(db, "display_catalog_entries");
                    UUID titlelessId = UUID.randomUUID();
                    ready(uploads, titlelessId, owner, rootId, draft(null, List.of(), "Unknown/Untitled.epub"), OffsetDateTime.now().plusDays(1));
                    assertThat(uploads.findOwned(titlelessId, owner).orElseThrow().draftMetadata().title()).isEmpty();
                    db.execute("update book_uploads set detected_metadata = jsonb_set(detected_metadata, '{title}', 'null'::jsonb), draft_metadata = jsonb_set(draft_metadata, '{title}', 'null'::jsonb) where id = ?", titlelessId);
                    var legacyTitleless = uploads.findOwned(titlelessId, owner).orElseThrow();
                    assertThat(legacyTitleless.detectedMetadata().title()).isEmpty();
                    assertThat(legacyTitleless.draftMetadata().title()).isEmpty();
                    service.cancel(titlelessId, () -> "draft-owner");

                    UUID matchId = UUID.randomUUID();
                    MetadataDraft beforeMatch = draft("Version review", List.of("Author"), "Author/Version review.epub",
                            Map.of("title", BookUploadModels.MetadataSource.MANUAL));
                    ready(uploads, matchId, owner, rootId, beforeMatch, OffsetDateTime.now().plusDays(1));
                    var edition = new BookUploadModels.MetadataCandidate("wikidata:Q123", BookUploadModels.MetadataSource.WIKIDATA,
                            "Wikidata", "Version review", null, List.of("Author"), "Publisher", "2021", "9780000000000",
                            null, List.of(), null, null, "Compare editions", true, "第二版", "en", "https://www.wikidata.org/wiki/Q123");
                    assertThat(uploads.matchCompleted(matchId, List.of(edition), null, null)).isFalse();
                    assertThat(uploads.processing(matchId, BookUploadModels.BookUploadStatus.ENRICHING)).isTrue();
                    assertThat(uploads.matchCompleted(matchId, List.of(edition), "MATCH_PARTIAL", "另一来源暂时不可用")).isTrue();
                    var reopenedMatch = uploads.findOwned(matchId, owner).orElseThrow();
                    assertThat(reopenedMatch.status()).isEqualTo(BookUploadModels.BookUploadStatus.READY_FOR_REVIEW);
                    assertThat(reopenedMatch.metadataCandidates()).containsExactly(edition);
                    assertThat(reopenedMatch.draftMetadata()).isEqualTo(beforeMatch);
                    assertThat(reopenedMatch.errorCode()).isEqualTo("MATCH_PARTIAL");
                    assertThat(reopenedMatch.errorDetail()).isEqualTo("另一来源暂时不可用");
                    assertThat(uploads.findOwned(matchId, stranger)).isEmpty();
                    service.cancel(matchId, () -> "draft-owner");
                    assertThat(uploads.matchCompleted(matchId, List.of(edition), null, null)).isFalse();

                    UUID partialId = UUID.randomUUID();
                    MetadataDraft initial = draft("Detected title", List.of("Detected Author"), "Detected Author/Detected title.epub");
                    ready(uploads, partialId, owner, rootId, initial, OffsetDateTime.now().minusDays(8));
                    db.execute("update book_uploads set created_at = now() - interval '8 days', expires_at = now() - interval '8 days' where id = ?", partialId);

                    MetadataDraft incomplete = draft(null, List.of(), "Detected Author/Detected title.epub",
                            Map.of("title", BookUploadModels.MetadataSource.GOOGLE_BOOKS,
                                    "authors", BookUploadModels.MetadataSource.AI));
                    var saved = service.updateDraft(partialId, incomplete, () -> "draft-owner");
                    assertThat(saved.status()).isEqualTo(BookUploadModels.BookUploadStatus.READY_FOR_REVIEW);
                    assertThat(saved.draftMetadata().title()).isEmpty();
                    assertThat(saved.draftMetadata().authors()).isEmpty();
                    assertThat(saved.draftMetadata().sources())
                            .containsEntry("title", BookUploadModels.MetadataSource.MANUAL)
                            .containsEntry("authors", BookUploadModels.MetadataSource.MANUAL);
                    String languages = String.join(",", java.util.Collections.nCopies(340, "en")) + ",abcd";
                    var multilingual = service.updateDraft(partialId, withLanguage(incomplete, languages), () -> "draft-owner");
                    assertThat(multilingual.draftMetadata().language()).isEqualTo(languages);
                    assertThat(uploads.findOwned(partialId, owner).orElseThrow().draftMetadata().language()).isEqualTo(languages);
                    assertThat(count(db, "books")).isEqualTo(booksBefore);
                    assertThat(count(db, "display_catalog_entries")).isEqualTo(publicBefore);
                    assertThat(service.list(() -> "draft-owner")).extracting(BookUploadModels.BookUpload::id).contains(partialId);
                    assertThat(uploads.findOwned(partialId, stranger)).isEmpty();
                    assertThatThrownBy(() -> service.get(partialId, () -> "draft-stranger"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(404));

                    assertThat(uploads.expired()).noneMatch(upload -> upload.id().equals(partialId));
                    assertThatThrownBy(() -> service.commit(partialId, "incomplete-confirm", false, () -> "draft-owner"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(400));
                    assertThat(uploads.findOwned(partialId, owner).orElseThrow().status())
                            .isEqualTo(BookUploadModels.BookUploadStatus.READY_FOR_REVIEW);
                    var authorless = draft("Draft title", List.of(), "Detected Author/Detected title.epub");
                    service.updateDraft(partialId, authorless, () -> "draft-owner");
                    assertThatThrownBy(() -> service.commit(partialId, "authorless-confirm", false, () -> "draft-owner"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(400));
                    assertThat(uploads.findOwned(partialId, owner).orElseThrow().status())
                            .isEqualTo(BookUploadModels.BookUploadStatus.READY_FOR_REVIEW);

                    MetadataDraft invalidThema = new MetadataDraft("Draft title", null, List.of(), List.of(), "en", null,
                            null, null, null, null, null, List.of(), 10, 100L, Map.of(),
                            "Detected Author/Detected title.epub", false, List.of("NOT_A_THEMA_CODE"), null, null);
                    assertThatThrownBy(() -> service.updateDraft(partialId, invalidThema, () -> "draft-owner"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(400));
                    MetadataDraft unsafePath = draft("Draft title", List.of(), "../escape.epub");
                    assertThatThrownBy(() -> service.updateDraft(partialId, unsafePath, () -> "draft-owner"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(400));
                    MetadataDraft wrongFormat = draft("Draft title", List.of(), "Author/Book.pdf");
                    assertThatThrownBy(() -> service.updateDraft(partialId, wrongFormat, () -> "draft-owner"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(400));
                    MetadataDraft tooLong = draft("x".repeat(501), List.of(), "Author/Book.epub");
                    assertThatThrownBy(() -> service.updateDraft(partialId, tooLong, () -> "draft-owner"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(400));
                    MetadataDraft unknownSource = draft("Draft title", List.of(), "Author/Book.epub",
                            Map.of("not-a-metadata-field", BookUploadModels.MetadataSource.MANUAL));
                    assertThatThrownBy(() -> service.updateDraft(partialId, unknownSource, () -> "draft-owner"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(400));
                    assertThat(uploads.processing(partialId, BookUploadModels.BookUploadStatus.ENRICHING)).isTrue();
                    var enriching = uploads.findOwned(partialId, owner).orElseThrow();
                    assertThat(enriching.status()).isEqualTo(BookUploadModels.BookUploadStatus.ENRICHING);
                    assertThat(enriching.expiresAt()).isAfter(OffsetDateTime.now().plusHours(23));
                    assertThat(service.list(() -> "draft-owner")).extracting(BookUploadModels.BookUpload::id).contains(partialId);
                    assertThat(uploads.expired()).noneMatch(upload -> upload.id().equals(partialId));
                    service.cleanupExpired();
                    assertThat(uploads.findOwned(partialId, owner).orElseThrow().status())
                            .isEqualTo(BookUploadModels.BookUploadStatus.ENRICHING);
                    db.execute("update book_uploads set expires_at = now() - interval '1 second' where id = ?", partialId);
                    service.cleanupExpired();
                    assertThat(uploads.findOwned(partialId, owner).orElseThrow().status())
                            .isEqualTo(BookUploadModels.BookUploadStatus.EXPIRED);
                    uploads.resetReady(partialId, "ENRICHMENT_FAILED", "timeout test");
                    assertThat(uploads.findOwned(partialId, owner).orElseThrow().status())
                            .isEqualTo(BookUploadModels.BookUploadStatus.EXPIRED);
                    assertThat(service.list(() -> "draft-owner")).extracting(BookUploadModels.BookUpload::id)
                            .doesNotContain(partialId);

                    UUID failedId = UUID.randomUUID();
                    var failed = uploads.create(failedId, owner, rootId, "interrupted.epub",
                            ".bookkin-staging/uploads/" + failedId + "/book.part", BookFormat.EPUB, 4,
                            OffsetDateTime.now().minusDays(8));
                    uploads.failed(failedId, "INSPECTION_FAILED", "interrupted");
                    db.execute("update book_uploads set created_at = now() - interval '8 days' where id = ?", failedId);
                    Path interrupted = rootPath.resolve(failed.stagingPath());
                    Files.createDirectories(interrupted.getParent());
                    Files.writeString(interrupted, "data");
                    service.cleanupExpired();
                    assertThat(uploads.findOwned(failedId, owner).orElseThrow().status())
                            .isEqualTo(BookUploadModels.BookUploadStatus.EXPIRED);
                    assertThat(Files.exists(interrupted)).isFalse();
                    assertThat(service.list(() -> "draft-owner")).extracting(BookUploadModels.BookUpload::id)
                            .doesNotContain(failedId);

                    UUID cancelId = UUID.randomUUID();
                    ready(uploads, cancelId, owner, rootId, initial, OffsetDateTime.now().plusDays(1));
                    Path staged = rootPath.resolve(".bookkin-staging/uploads/").resolve(cancelId.toString()).resolve("book.part");
                    Files.createDirectories(staged.getParent());
                    Files.writeString(staged, "data");
                    service.cancel(cancelId, () -> "draft-owner");
                    assertThat(uploads.findOwned(cancelId, owner).orElseThrow().status())
                            .isEqualTo(BookUploadModels.BookUploadStatus.CANCELLED);
                    assertThat(Files.exists(staged)).isFalse();

                    UUID racedId = UUID.randomUUID();
                    MetadataDraft completeBeforeRace = draft("Race title", List.of("Race Author"), "Race Author/Race title.epub");
                    var racingUploads = new RacingBookUploadRepository(db, new ObjectMapper());
                    ready(racingUploads, racedId, owner, rootId, completeBeforeRace, OffsetDateTime.now().plusDays(1));
                    racingUploads.replaceDraftOnNextCommit(draft(null, List.of(), "Race Author/Race title.epub"));
                    var racingService = service(racingUploads, roots, catalog, users, inspector, fingerprints);
                    assertThatThrownBy(() -> racingService.commit(racedId, "raced-confirm", false, () -> "draft-owner"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(400));
                    var raced = racingUploads.findOwned(racedId, owner).orElseThrow();
                    assertThat(raced.status()).isEqualTo(BookUploadModels.BookUploadStatus.READY_FOR_REVIEW);
                    assertThat(raced.idempotencyKey()).isNull();
                    assertThat(count(db, "books")).isEqualTo(booksBefore);

                    UUID confirmedId = UUID.randomUUID();
                    MetadataDraft complete = draft("Confirmed title", List.of("Confirmed Author"), "Confirmed Author/Confirmed title.epub");
                    Path confirmedStaged = rootPath.resolve(".bookkin-staging/uploads/").resolve(confirmedId.toString()).resolve("book.part");
                    Files.createDirectories(confirmedStaged.getParent());
                    Files.writeString(confirmedStaged, "confirmed bytes");
                    String fingerprint = fingerprints.sha256(confirmedStaged);
                    uploads.create(confirmedId, owner, rootId, "confirmed.epub",
                            ".bookkin-staging/uploads/" + confirmedId + "/book.part", BookFormat.EPUB,
                            Files.size(confirmedStaged), OffsetDateTime.now().plusDays(1));
                    uploads.received(confirmedId, Files.size(confirmedStaged), fingerprint);
                    uploads.ready(confirmedId, false, false, false, complete, complete, List.of(), null, null, new UUID[0]);
                    when(inspector.inspect(org.mockito.ArgumentMatchers.any(Path.class), org.mockito.ArgumentMatchers.eq(BookFormat.EPUB)))
                            .thenReturn(new FileInspector.Inspection(true, false, false, false));
                    // Stale/custom draft basenames must never decide the final filename.
                    db.execute("update book_uploads set draft_metadata = jsonb_set(draft_metadata, '{targetPath}', '\"Confirmed Author/旧文件名.epub\"'::jsonb) where id = ?", confirmedId);
                    Path collision = rootPath.resolve("Confirmed Author/Confirmed title.epub");
                    Files.createDirectories(collision.getParent());
                    Files.writeString(collision, "occupied bytes");
                    assertThatThrownBy(() -> service.commit(confirmedId, "confirmed-key", false, () -> "draft-owner"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("UPLOAD_COMMIT_FAILED"));
                    assertThat(Files.readString(collision)).isEqualTo("occupied bytes");
                    assertThat(Files.readString(confirmedStaged)).isEqualTo("confirmed bytes");
                    assertThat(uploads.findOwned(confirmedId, owner).orElseThrow().status()).isEqualTo(BookUploadModels.BookUploadStatus.READY_FOR_REVIEW);
                    Files.delete(collision);
                    var confirmed = service.commit(confirmedId, "confirmed-key", false, () -> "draft-owner");
                    assertThat(confirmed.status()).isEqualTo(BookUploadModels.BookUploadStatus.SUCCEEDED);
                    assertThat(confirmed.committedBookId()).isNotNull();
                    String committedPath = db.fetchOne("select relative_path from book_files where book_id = ?", confirmed.committedBookId()).get(0, String.class);
                    assertThat(committedPath).isEqualTo("Confirmed Author/Confirmed title.epub");
                    assertThat(Files.readString(rootPath.resolve(committedPath))).isEqualTo("confirmed bytes");
                    assertThat(service.commit(confirmedId, "confirmed-key", false, () -> "draft-owner").committedBookId()).isEqualTo(confirmed.committedBookId());
                    assertThat(count(db, "books")).isEqualTo(booksBefore + 1);
                    assertThat(count(db, "display_catalog_entries")).isEqualTo(publicBefore);
                }
            } finally {
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }

    private static BookUploadService service(BookUploadRepository uploads, LibraryRootRepository roots,
            CatalogIngestionRepository catalog, UserRepository users, FileInspector inspector, FileFingerprints fingerprints) {
        return new BookUploadService(uploads, null, null, null, null, roots, catalog, users, inspector, fingerprints,
                new PathPolicy(), null, mock(AuditService.class), new ObjectMapper(), mock(DisplayCatalogService.class));
    }

    private static void ready(BookUploadRepository uploads, UUID id, UUID owner, UUID rootId,
            MetadataDraft draft, OffsetDateTime expiresAt) {
        uploads.create(id, owner, rootId, "upload.epub", ".bookkin-staging/uploads/" + id + "/book.part",
                BookFormat.EPUB, 4, expiresAt);
        uploads.received(id, 4, "sha256:" + id.toString().replace("-", ""));
        uploads.ready(id, false, false, false, draft, draft, List.of(), null, null, new UUID[0]);
    }

    private static MetadataDraft draft(String title, List<String> authors, String targetPath) {
        return draft(title, authors, targetPath, Map.of("title", BookUploadModels.MetadataSource.FILE));
    }

    private static MetadataDraft draft(String title, List<String> authors, String targetPath,
            Map<String, BookUploadModels.MetadataSource> sources) {
        return new MetadataDraft(title, null, authors, List.of(), "en", "Publisher", "2026", "1234567890",
                null, null, null, List.of(), 10, 100L, sources,
                targetPath, false, List.of(), null, null);
    }

    private static MetadataDraft withLanguage(MetadataDraft draft, String language) {
        return new MetadataDraft(draft.title(), draft.subtitle(), draft.authors(), draft.translators(), language,
                draft.publisher(), draft.publishedDate(), draft.isbn(), draft.description(), draft.series(),
                draft.seriesIndex(), draft.tags(), draft.pageCount(), draft.wordCount(), draft.sources(),
                draft.targetPath(), draft.publiclyVisible(), draft.subjectCodes(), draft.authorBiography(), draft.tableOfContents());
    }

    private static void insertUser(org.jooq.DSLContext db, UUID id, String username, String role) {
        db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,?,?,'native-test',?)",
                id, username, username, role);
    }

    private static BookKinUser user(UUID id) {
        var user = mock(BookKinUser.class);
        when(user.id()).thenReturn(id);
        return user;
    }

    private static LibraryRoot onlineRoot(UUID id, Path path) {
        return new LibraryRoot(id, "upload-draft-root", path.toString(), path.toString(), LibraryRoot.RootStatus.ONLINE,
                true, true, true, true, null, null, null);
    }

    private static long count(org.jooq.DSLContext db, String table) {
        return db.fetchOne("select count(*) from " + table).get(0, Long.class);
    }

    private static final class RacingBookUploadRepository extends BookUploadRepository {
        private MetadataDraft concurrentDraft;

        private RacingBookUploadRepository(org.jooq.DSLContext db, ObjectMapper json) {
            super(db, json);
        }

        private void replaceDraftOnNextCommit(MetadataDraft draft) {
            concurrentDraft = draft;
        }

        @Override
        public BookUploadModels.UploadEntity beginCommit(UUID id, UUID actorId, String idempotencyKey) {
            if (concurrentDraft != null) {
                super.updateDraft(id, concurrentDraft);
                concurrentDraft = null;
            }
            return super.beginCommit(id, actorId, idempotencyKey);
        }
    }
}
