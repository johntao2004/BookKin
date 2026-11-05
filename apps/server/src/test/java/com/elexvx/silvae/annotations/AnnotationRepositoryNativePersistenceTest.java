package com.elexvx.silvae.annotations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.elexvx.silvae.annotations.AnnotationRepository.AnnotationStyle;
import com.elexvx.silvae.annotations.AnnotationRepository.AnnotationType;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.flywaydb.core.Flyway;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@EnabledIfEnvironmentVariable(named = "SILVAE_NATIVE_TEST_URL", matches = ".+")
class AnnotationRepositoryNativePersistenceTest {
    private DSLContext dsl;

    @Test
    void notesUpsertByLocatedSelectionWithoutCrossingUsersBooksRangesOrBookmarks() throws Exception {
        String url = System.getenv("SILVAE_NATIVE_TEST_URL");
        String username = System.getenv().getOrDefault("SILVAE_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("SILVAE_NATIVE_TEST_PASSWORD", "");
        String schema = "silvae_annotations_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection admin = DriverManager.getConnection(url, username, password);
             var setup = admin.createStatement()) {
            setup.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(url, username, password).schemas(schema).defaultSchema(schema)
                        .locations("classpath:db/migration").load().migrate();
                try (Connection connection = DriverManager.getConnection(url, username, password);
                     var command = connection.createStatement()) {
                    command.execute("set search_path to " + schema + ",public");
                    dsl = DSL.using(connection, SQLDialect.POSTGRES);
                    verifyNotesAreScopedAndUpserted(schema, url, username, password);
                }
            } finally {
                setup.execute("drop schema if exists " + schema + " cascade");
            }
        }
    }

    private void verifyNotesAreScopedAndUpserted(String schema, String url, String username, String password)
            throws Exception {
        UUID alice = insertUser("annotation-alice");
        UUID bob = insertUser("annotation-bob");
        UUID firstBook = insertBook("批注书一");
        UUID secondBook = insertBook("批注书二");
        String quote = "同一处原文";
        String rangeEndOne = "epubcfi(/6/2[chapter^,one]!/4/2/6[p-2],/2/2/1:0,/38/2/1:1)";
        String rangeEndTwo = "epubcfi(/6/2[chapter^,one]!/4/2/6[p-2],/2/2/1:0,/38/2/1:2)";
        String differentStart = "epubcfi(/6/2[chapter^,one]!/4/2/6[p-2],/2/2/2:0,/38/2/1:2)";

        UUID oldHighlightId = UUID.randomUUID();
        UUID oldNoteId = UUID.randomUUID();
        UUID newestNoteId = UUID.randomUUID();
        insertAnnotation(oldHighlightId, alice, firstBook, AnnotationType.HIGHLIGHT, rangeEndOne, quote, null, 4);
        insertAnnotation(oldNoteId, alice, firstBook, AnnotationType.NOTE, rangeEndTwo, quote, "旧笔记一", 3);
        insertAnnotation(newestNoteId, alice, firstBook, AnnotationType.NOTE, rangeEndTwo, quote, "旧笔记二", 1);
        var originalCreatedAt = dsl.fetchOne("select created_at from annotations where id = ?", newestNoteId)
                .get("created_at", java.time.OffsetDateTime.class);

        var replaced = create(alice, firstBook, AnnotationType.NOTE, rangeEndTwo, quote, "显式替换的笔记",
                AnnotationStyle.HIGHLIGHT, "AMBER");
        assertEquals(newestNoteId, replaced.id());
        assertEquals(originalCreatedAt, replaced.createdAt());
        assertEquals("显式替换的笔记", replaced.note());
        assertEquals(1, count(alice, firstBook, quote));
        assertEquals(0, countById(oldHighlightId) + countById(oldNoteId));

        var highlightedAgain = create(alice, firstBook, AnnotationType.HIGHLIGHT, rangeEndOne, quote, null,
                AnnotationStyle.BOLD, "TEAL");
        assertEquals(newestNoteId, highlightedAgain.id());
        assertEquals(AnnotationType.NOTE, highlightedAgain.type());
        assertEquals("显式替换的笔记", highlightedAgain.note());
        assertEquals(AnnotationStyle.BOLD, highlightedAgain.style());
        assertEquals(1, count(alice, firstBook, quote));

        String newQuote = "原先只有划线的段落";
        var highlightOnly = create(alice, firstBook, AnnotationType.HIGHLIGHT, differentStart, newQuote, null,
                AnnotationStyle.UNDERLINE, "BLUE");
        var firstNote = create(alice, firstBook, AnnotationType.NOTE, differentStart, newQuote, "第一版笔记",
                AnnotationStyle.HIGHLIGHT, "AMBER");
        var editedNote = create(alice, firstBook, AnnotationType.NOTE, differentStart, newQuote, "第二版笔记",
                AnnotationStyle.HIGHLIGHT, "AMBER");
        assertEquals(highlightOnly.id(), firstNote.id());
        assertEquals(highlightOnly.id(), editedNote.id());
        assertEquals(AnnotationType.NOTE, editedNote.type());
        assertEquals("第二版笔记", editedNote.note());
        assertEquals(highlightOnly.createdAt(), editedNote.createdAt());

        var bobNote = create(bob, firstBook, AnnotationType.NOTE, rangeEndOne, quote, "Bob 的私人笔记",
                AnnotationStyle.HIGHLIGHT, "AMBER");
        var aliceOtherBook = create(alice, secondBook, AnnotationType.NOTE, rangeEndOne, quote, "另一本书",
                AnnotationStyle.HIGHLIGHT, "AMBER");
        var aliceDifferentStart = create(alice, firstBook, AnnotationType.NOTE, differentStart, quote, "另一处相同文字",
                AnnotationStyle.HIGHLIGHT, "AMBER");
        assertNotEquals(newestNoteId, bobNote.id());
        assertNotEquals(newestNoteId, aliceOtherBook.id());
        assertNotEquals(newestNoteId, aliceDifferentStart.id());

        var bookmarkOne = create(alice, firstBook, AnnotationType.BOOKMARK, rangeEndOne, quote, null,
                AnnotationStyle.HIGHLIGHT, "AMBER");
        var bookmarkTwo = create(alice, firstBook, AnnotationType.BOOKMARK, rangeEndTwo, quote, null,
                AnnotationStyle.HIGHLIGHT, "AMBER");
        assertNotEquals(newestNoteId, bookmarkOne.id());
        assertNotEquals(bookmarkOne.id(), bookmarkTwo.id());
        assertEquals(2, countByType(alice, firstBook, AnnotationType.BOOKMARK));

        String pdfLocator = "pdfjs:page=3&rect=20,30,80,90";
        var pdfHighlight = create(alice, firstBook, AnnotationType.HIGHLIGHT, pdfLocator, quote, null,
                AnnotationStyle.UNDERLINE, "BLUE");
        var pdfNote = create(alice, firstBook, AnnotationType.NOTE, pdfLocator, quote, "PDF 批注",
                AnnotationStyle.HIGHLIGHT, "AMBER");
        var anotherPdfLocator = create(alice, firstBook, AnnotationType.NOTE, pdfLocator + "&text=other", quote,
                "另一个 PDF 位置", AnnotationStyle.HIGHLIGHT, "AMBER");
        assertEquals(pdfHighlight.id(), pdfNote.id());
        assertNotEquals(pdfNote.id(), anotherPdfLocator.id());

        verifyConcurrentNotesUseTheSameSelectionLock(schema, url, username, password, alice, firstBook);
    }

    private void verifyConcurrentNotesUseTheSameSelectionLock(String schema, String url, String username,
                                                               String password, UUID userId, UUID bookId)
            throws Exception {
        String quote = "并发选区";
        String locator = "epubcfi(/6/4!/4/2,/2/2/1:0,/28/2/1:1)";
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var createAttempt = (java.util.concurrent.Callable<AnnotationRepository.Annotation>) () -> {
                try (Connection connection = DriverManager.getConnection(url, username, password);
                     var command = connection.createStatement()) {
                    command.execute("set search_path to " + schema + ",public");
                    DSLContext connectionDsl = DSL.using(connection, SQLDialect.POSTGRES);
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("parallel start timed out");
                    return connectionDsl.transactionResult(configuration -> new AnnotationRepository(DSL.using(configuration))
                            .create(userId, bookId, AnnotationType.NOTE, locator, quote, "并发笔记",
                                    AnnotationStyle.HIGHLIGHT, "AMBER"));
                }
            };
            var first = executor.submit(createAttempt);
            var second = executor.submit(createAttempt);
            assertTrue(ready.await(10, TimeUnit.SECONDS), "both PostgreSQL sessions should be ready before releasing the race");
            start.countDown();
            var firstResult = first.get(20, TimeUnit.SECONDS);
            var secondResult = second.get(20, TimeUnit.SECONDS);
            assertEquals(firstResult.id(), secondResult.id());
            assertEquals(1, count(userId, bookId, quote));
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    private UUID insertUser(String username) {
        UUID id = UUID.randomUUID();
        dsl.execute("insert into app_users(id, username, display_name, password_hash, role) values (?, ?, ?, 'test', 'MEMBER')",
                id, username, username);
        return id;
    }

    private UUID insertBook(String title) {
        UUID id = UUID.randomUUID();
        dsl.execute("insert into books(id, title, sort_title, primary_author) values (?, ?, ?, '作者')", id, title, title);
        return id;
    }

    private void insertAnnotation(UUID id, UUID userId, UUID bookId, AnnotationType type, String locator,
                                  String quote, String note, int ageHours) {
        dsl.execute("""
                insert into annotations(id, user_id, book_id, annotation_type, locator, quote, note, annotation_style, color, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, 'HIGHLIGHT', 'AMBER', now() - (? * interval '1 hour'), now() - (? * interval '1 hour'))
                """, id, userId, bookId, type.name(), locator, quote, note, ageHours, ageHours);
    }

    private AnnotationRepository.Annotation create(UUID userId, UUID bookId, AnnotationType type, String locator,
                                                   String quote, String note, AnnotationStyle style, String color) {
        return dsl.transactionResult(configuration -> new AnnotationRepository(DSL.using(configuration))
                .create(userId, bookId, type, locator, quote, note, style, color));
    }

    private int count(UUID userId, UUID bookId, String quote) {
        return dsl.fetchOne("select count(*)::int from annotations where user_id = ? and book_id = ? and quote = ?",
                userId, bookId, quote).get(0, Integer.class);
    }

    private int countById(UUID id) {
        return dsl.fetchOne("select count(*)::int from annotations where id = ?", id).get(0, Integer.class);
    }

    private int countByType(UUID userId, UUID bookId, AnnotationType type) {
        return dsl.fetchOne("select count(*)::int from annotations where user_id = ? and book_id = ? and annotation_type = ?",
                userId, bookId, type.name()).get(0, Integer.class);
    }
}
