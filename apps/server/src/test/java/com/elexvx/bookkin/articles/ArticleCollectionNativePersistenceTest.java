package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import java.security.Principal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** PostgreSQL persistence checks run in an isolated schema when BOOKKIN_NATIVE_TEST_URL is configured. */
@EnabledIfEnvironmentVariable(named = "BOOKKIN_NATIVE_TEST_URL", matches = ".+")
class ArticleCollectionNativePersistenceTest {
    @Test
    void permissionsFilteringRevisionAtomicBatchesOrderingAndRelationshipDeletionPersistCorrectly() throws Exception {
        String url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        String schema = "bookkin_article_collections_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(url, user, password); var statement = admin.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                migrate(url, user, password, schema);
                try (var connection = connect(url, user, password, schema)) {
                    var db = DSL.using(connection, SQLDialect.POSTGRES);
                    UUID aliceId = addUser(db, "alice", "Alice", "MEMBER");
                    UUID bobId = addUser(db, "bob", "Bob", "MEMBER");
                    UUID adminId = addUser(db, "admin", "管理员", "ADMIN");
                    UUID publicOne = addArticle(db, aliceId, "公开一", "PUBLIC");
                    UUID publicTwo = addArticle(db, aliceId, "公开二", "PUBLIC");
                    UUID privateAlice = addArticle(db, aliceId, "Alice 私有", "PRIVATE");
                    UUID privateBob = addArticle(db, bobId, "Bob 私有", "PRIVATE");
                    db.execute("insert into article_reading(article_id,user_id,state,revision) values (?,?,'{\"position\":4}'::jsonb,3)", publicOne, bobId);
                    connection.commit();

                    var articleRepo = new ArticleCollectionRepository(db);
                    var service = new ArticleCollectionService(articleRepo, new UserRepository(db));
                    Principal alice = () -> "alice";
                    Principal bob = () -> "bob";
                    Principal administrator = () -> "admin";

                    var created = service.create("我的选集", "说明", "PRIVATE", alice);
                    UUID privateCollection = created.id();
                    var withPrivate = service.addArticles(privateCollection.toString(), List.of(publicOne, privateAlice), 1, alice);
                    assertThat(withPrivate.articleCount()).isEqualTo(2);
                    assertThat(withPrivate.articles()).extracting(article -> article.get("id")).containsExactly(publicOne, privateAlice);
                    assertApi("COLLECTION_NOT_FOUND", () -> service.get(privateCollection.toString(), bob));
                    assertApi("COLLECTION_NOT_FOUND", () -> service.get(privateCollection.toString(), administrator));
                    assertApi("ARTICLE_NOT_FOUND", () -> service.addArticles(privateCollection.toString(), List.of(privateBob), 2, alice));

                    assertApi("COLLECTION_PRIVATE_ARTICLES", () -> service.update(privateCollection.toString(), "我的选集", "说明", "MEMBERS", 2, alice));
                    assertThat(db.fetchOne("select visibility from article_collections where id=?", privateCollection).get("visibility", String.class)).isEqualTo("PRIVATE");
                    assertThat(db.fetchOne("select revision from article_collections where id=?", privateCollection).get("revision", Long.class)).isEqualTo(2L);
                    var noPrivate = service.removeArticle(privateCollection.toString(), privateAlice.toString(), 2, alice);
                    assertThat(noPrivate.revision()).isEqualTo(3);
                    var shared = service.update(privateCollection.toString(), "成员选集", "说明", "MEMBERS", 3, alice);
                    assertThat(shared.revision()).isEqualTo(4);

                    assertApi("COLLECTION_ARTICLE_NOT_PUBLIC", () -> service.addArticles(privateCollection.toString(), List.of(publicTwo, privateAlice), 4, alice));
                    assertThat(db.fetchOne("select revision from article_collections where id=?", privateCollection).get("revision", Long.class)).isEqualTo(4L);
                    assertThat(count(db, "select count(*) from article_collection_articles where collection_id=? and article_id=?", privateCollection, publicTwo)).isZero();
                    assertApi("DUPLICATE_ARTICLE_ID", () -> service.addArticles(privateCollection.toString(), List.of(publicOne, publicOne), 4, alice));
                    assertApi("ARTICLE_ALREADY_IN_COLLECTION", () -> service.addArticles(privateCollection.toString(), List.of(publicOne), 4, alice));
                    assertThat(db.fetchOne("select revision from article_collections where id=?", privateCollection).get("revision", Long.class)).isEqualTo(4L);

                    var withTwo = service.addArticles(privateCollection.toString(), List.of(publicTwo), 4, alice);
                    assertThat(withTwo.articleCount()).isEqualTo(2);
                    assertThat(withTwo.revision()).isEqualTo(5);
                    assertApi("REVISION_CONFLICT", () -> service.addArticles(privateCollection.toString(), List.of(publicOne), 4, alice));
                    assertApi("COLLECTION_ORDER_CHANGED", () -> service.reorder(privateCollection.toString(), List.of(publicOne), 5, alice));
                    var ordered = service.reorder(privateCollection.toString(), List.of(publicTwo, publicOne), 5, alice);
                    assertThat(ordered.articles()).extracting(article -> article.get("id")).containsExactly(publicTwo, publicOne);

                    db.execute("update articles set visibility='PRIVATE', updated_at=now() where id=?", publicTwo);
                    var filtered = service.get(privateCollection.toString(), bob);
                    assertThat(filtered.articleCount()).isEqualTo(1);
                    assertThat(filtered.previewArticles()).extracting(article -> article.get("id")).containsExactly(publicOne);
                    assertThat(filtered.articles()).extracting(article -> article.get("id")).containsExactly(publicOne);
                    var ownerView = service.get(privateCollection.toString(), alice);
                    assertThat(ownerView.articleCount()).isEqualTo(2);
                    assertThat(ownerView.articles()).extracting(article -> article.get("id")).contains(publicTwo);
                    assertThat(service.list(null, bob).items()).extracting(ArticleCollectionService.Summary::id).contains(privateCollection);
                    assertThat(service.list(null, administrator).items()).extracting(ArticleCollectionService.Summary::id).contains(privateCollection);
                    assertApi("COLLECTION_EDIT_FORBIDDEN", () -> service.update(privateCollection.toString(), "改名", "", "MEMBERS", 6, bob));

                    var afterRemove = service.removeArticle(privateCollection.toString(), publicOne.toString(), 6, alice);
                    assertThat(afterRemove.articleCount()).isEqualTo(1);
                    assertThat(afterRemove.articles()).extracting(article -> article.get("id")).containsExactly(publicTwo);
                    assertThat(count(db, "select count(*) from articles where id=?", publicOne)).isEqualTo(1);
                    assertThat(db.fetchOne("select state::text,revision from article_reading where article_id=? and user_id=?", publicOne, bobId)
                            .get("revision", Integer.class)).isEqualTo(3);
                    service.delete(privateCollection.toString(), 7, alice);
                    assertThat(count(db, "select count(*) from article_collection_articles where collection_id=?", privateCollection)).isZero();
                    assertThat(count(db, "select count(*) from articles where id=?", publicOne)).isEqualTo(1);
                    assertThat(count(db, "select count(*) from article_reading where article_id=? and user_id=?", publicOne, bobId)).isEqualTo(1);

                    var cascadeCollection = service.create("级联选集", "", "PRIVATE", alice);
                    service.addArticles(cascadeCollection.id().toString(), List.of(publicOne), 1, alice);
                    db.execute("delete from articles where id=?", publicOne);
                    assertThat(count(db, "select count(*) from article_collection_articles where collection_id=?", cascadeCollection.id())).isZero();
                    assertThat(count(db, "select count(*) from article_collections where id=?", cascadeCollection.id())).isEqualTo(1);
                    connection.commit();
                }
            } finally {
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }

    private static UUID addUser(DSLContext db, String username, String displayName, String role) {
        UUID id = UUID.randomUUID();
        db.execute("insert into app_users(id,username,display_name,password_hash,role,must_change_password) values (?,?,?,?,?,false)",
                id, username, displayName, "test-only", role);
        return id;
    }

    private static UUID addArticle(DSLContext db, UUID ownerId, String title, String visibility) {
        UUID id = UUID.randomUUID();
        db.execute("insert into articles(id,owner_id,title,visibility,html) values (?,?,?,?,'<p>test</p>')", id, ownerId, title, visibility);
        return id;
    }

    private static int count(DSLContext db, String sql, Object... bindings) {
        return db.fetchOne(sql, bindings).get(0, Integer.class);
    }

    private static Connection connect(String url, String user, String password, String schema) throws Exception {
        var connection = DriverManager.getConnection(url, user, password);
        try (var statement = connection.createStatement()) { statement.execute("set search_path to " + schema + ",public"); }
        connection.setAutoCommit(false);
        return connection;
    }

    private static void migrate(String url, String user, String password, String schema) {
        Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").load().migrate();
    }

    private static void assertApi(String code, org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action).isInstanceOfSatisfying(ApiException.class, error -> {
            assertThat(error.code()).isEqualTo(code);
            int expectedStatus = switch (code) {
                case "COLLECTION_NOT_FOUND", "ARTICLE_NOT_FOUND" -> 404;
                case "COLLECTION_EDIT_FORBIDDEN" -> 403;
                default -> 409;
            };
            assertThat(error.status().value()).isEqualTo(expectedStatus);
        });
    }
}
