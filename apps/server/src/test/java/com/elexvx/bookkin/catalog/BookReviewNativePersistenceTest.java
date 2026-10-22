package com.elexvx.bookkin.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.elexvx.bookkin.articles.ArticleNotesService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import tools.jackson.databind.ObjectMapper;

@EnabledIfEnvironmentVariable(named = "BOOKKIN_NATIVE_TEST_URL", matches = ".+")
class BookReviewNativePersistenceTest {
    @Test
    void articlesStayUserScopedAndBookReviewsPersistWithVisibilityAndRevisions() throws Exception {
        String url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        String schema = "bookkin_notes_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(url, user, password); var statement = admin.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
                        .locations("classpath:db/migration").load().migrate();
                try (var connection = DriverManager.getConnection(url, user, password); var setup = connection.createStatement()) {
                    setup.execute("set search_path to " + schema + ",public");
                    DSLContext db = DSL.using(connection, SQLDialect.POSTGRES);
                    UUID alice = UUID.randomUUID(), bob = UUID.randomUUID(), owner = UUID.randomUUID();
                    UUID book = UUID.randomUUID(), publicArticle = UUID.randomUUID(), privateAlice = UUID.randomUUID();
                    UUID privateBob = UUID.randomUUID();
                    insertUser(db, alice, "alice", "Alice");
                    insertUser(db, bob, "bob", "Bob");
                    insertUser(db, owner, "owner", "Owner", "OWNER");
                    db.execute("insert into books(id,title,sort_title,primary_author) values (?,?,?,?)", book, "测试书", "测试书", "作者");
                    insertArticle(db, publicArticle, bob, "PUBLIC", "公开文章");
                    insertArticle(db, privateAlice, alice, "PRIVATE", "Alice 私有文章");
                    insertArticle(db, privateBob, bob, "PRIVATE", "Bob 私有文章");
                    db.execute("insert into article_reading(article_id,user_id,state) values (?,?,?::jsonb)",
                            publicArticle, alice, state("Alice 公开文章笔记"));
                    db.execute("insert into article_reading(article_id,user_id,state) values (?,?,?::jsonb)",
                            publicArticle, bob, state("Bob 公开文章笔记"));
                    db.execute("insert into article_reading(article_id,user_id,state) values (?,?,?::jsonb)",
                            privateAlice, alice, state("Alice 私有文章笔记"));
                    db.execute("insert into article_reading(article_id,user_id,state) values (?,?,?::jsonb)",
                            privateBob, bob, state("Bob 私有文章笔记"));

                    var articleNotes = new ArticleNotesService(db, new UserRepository(db), new ObjectMapper());
                    var aliceNotes = articleNotes.notes(() -> "alice");
                    assertThat(aliceNotes).extracting(ArticleNotesService.ArticleNotes::articleId)
                            .containsExactlyInAnyOrder(publicArticle, privateAlice);
                    assertThat(aliceNotes).flatExtracting(ArticleNotesService.ArticleNotes::annotations)
                            .extracting(ArticleNotesService.Entry::note)
                            .containsExactlyInAnyOrder("Alice 公开文章笔记", "Alice 私有文章笔记");
                    assertThat(articleNotes.notes(() -> "bob")).flatExtracting(ArticleNotesService.ArticleNotes::annotations)
                            .extracting(ArticleNotesService.Entry::note)
                            .containsExactlyInAnyOrder("Bob 公开文章笔记", "Bob 私有文章笔记");

                    var reviewRepository = new BookReviewRepository(db);
                    var bookReviews = new BookReviewService(reviewRepository, new BookRepository(db), new UserRepository(db));
                    var alicePrivate = bookReviews.create(book, "私人长文", "# Alice 私人想法", null, () -> "alice");
                    var aliceShared = bookReviews.create(book, "书库分享", "读后整理", ReviewVisibility.LIBRARY, () -> "alice");
                    var bobPrivate = bookReviews.create(book, "Bob 私人长文", "只属于 Bob", ReviewVisibility.PRIVATE, () -> "bob");
                    assertEquals(1, alicePrivate.revision());
                    assertThat(bookReviews.list(book, () -> "alice")).extracting(BookReviewRepository.BookReview::id)
                            .containsExactlyInAnyOrder(alicePrivate.id(), aliceShared.id());
                    assertThat(bookReviews.list(book, () -> "bob")).extracting(BookReviewRepository.BookReview::id)
                            .containsExactlyInAnyOrder(aliceShared.id(), bobPrivate.id());
                    assertThat(bookReviews.list(book, () -> "owner")).extracting(BookReviewRepository.BookReview::id)
                            .containsExactly(aliceShared.id());

                    var updated = bookReviews.update(alicePrivate.id(), "修订标题", "修订正文", null, 1, () -> "alice");
                    assertEquals(2, updated.revision());
                    ApiException conflict = assertThrows(ApiException.class, () -> bookReviews.update(
                            alicePrivate.id(), "过期覆盖", "旧正文", null, 1, () -> "alice"));
                    assertEquals(409, conflict.status().value());
                    ApiException hidden = assertThrows(ApiException.class, () -> bookReviews.update(
                            alicePrivate.id(), "越权", "不应保存", ReviewVisibility.LIBRARY, 2, () -> "owner"));
                    assertEquals(404, hidden.status().value());
                }
            } finally {
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }

    private static void insertUser(DSLContext db, UUID id, String username, String name) {
        insertUser(db, id, username, name, "MEMBER");
    }

    private static void insertUser(DSLContext db, UUID id, String username, String name, String role) {
        db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,?,?,'native-test',?)",
                id, username, name, role);
    }

    private static void insertArticle(DSLContext db, UUID id, UUID ownerId, String visibility, String title) {
        db.execute("insert into articles(id,owner_id,title,author,visibility,html) values (?,?,?,? ,?,'<p>test</p>')",
                id, ownerId, title, "作者", visibility);
    }

    private static String state(String note) {
        return "{\"annotations\":[{\"id\":\"" + UUID.randomUUID()
                + "\",\"type\":\"NOTE\",\"quote\":\"摘录\",\"note\":\"" + note
                + "\",\"locator\":\"p-1\",\"createdAt\":\"2026-10-22T10:00:00Z\"}]}";
    }
}
