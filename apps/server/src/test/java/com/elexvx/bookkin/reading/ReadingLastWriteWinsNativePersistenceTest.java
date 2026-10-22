package com.elexvx.bookkin.reading;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.elexvx.bookkin.articles.ArticleService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.vault.VaultService;
import java.math.BigDecimal;
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

/** Separate transactions model two tabs with stale revisions, without touching real reading data. */
@EnabledIfEnvironmentVariable(named = "BOOKKIN_NATIVE_TEST_URL", matches = ".+")
class ReadingLastWriteWinsNativePersistenceTest {
    @Test
    void laterArticleVaultAndBookSubmissionsWinWithoutCrossingUserBoundaries() throws Exception {
        String url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        String schema = "bookkin_reading_last_write_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(url, user, password); var statement = admin.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
                        .locations("classpath:db/migration").load().migrate();
                try (var first = connect(url, user, password, schema); var second = connect(url, user, password, schema)) {
                    var db = DSL.using(first, SQLDialect.POSTGRES);
                    var other = DSL.using(second, SQLDialect.POSTGRES);
                    UUID alice = addUser(db, "alice"), bob = addUser(db, "bob");
                    UUID article = UUID.randomUUID(), privateArticle = UUID.randomUUID(), object = UUID.randomUUID();
                    UUID book = UUID.randomUUID();
                    db.execute("insert into articles(id,owner_id,title,visibility,html) values (?,?,'公开文章','PUBLIC','<p>正文</p>'),(?,?,'私有文章','PRIVATE','<p>私有</p>')",
                            article, alice, privateArticle, alice);
                    db.execute("insert into personal_vault(user_id,envelope) values (?,'{}')", alice);
                    db.execute("insert into vault_objects(id,user_id,manifest,state) values (?,?,'manifest','initial')", object, alice);
                    db.execute("insert into books(id,title,sort_title) values (?,'阅读测试','阅读测试')", book);
                    first.commit();

                    var tabA = articles(db);
                    var tabB = articles(other);
                    assertThat(tabA.reading(article, () -> "alice").get("revision")).isEqualTo(0);
                    assertThat(tabB.reading(article, () -> "alice").get("revision")).isEqualTo(0);
                    tabA.reading(article, "{\"locator\":\"p-2\",\"progress\":0.8}", 0, () -> "alice");
                    first.commit();
                    // A later deliberate backward move must win too; do not take maximum progress.
                    tabB.reading(article, "{\"locator\":\"p-1\",\"progress\":0.1}", 0, () -> "alice");
                    second.commit();
                    assertThat(tabA.reading(article, () -> "alice").get("revision")).isEqualTo(2L);
                    assertThat(tabA.reading(article, () -> "alice").get("state").toString()).contains("p-1");
                    tabA.reading(article, "{\"locator\":\"p-3\"}", 0, () -> "alice");
                    // Submit while A still holds the row lock. The later transaction must also save.
                    try (var executor = Executors.newSingleThreadExecutor()) {
                        var submitted = new CountDownLatch(1);
                        var later = executor.submit(() -> {
                            submitted.countDown();
                            tabB.reading(article, "{\"locator\":\"p-4\"}", 0, () -> "alice");
                            second.commit();
                            return true;
                        });
                        assertThat(submitted.await(5, TimeUnit.SECONDS)).isTrue();
                        first.commit();
                        assertThat(later.get(10, TimeUnit.SECONDS)).isTrue();
                    }
                    assertThat(tabA.reading(article, () -> "alice").get("revision")).isEqualTo(4L);
                    assertThat(tabA.reading(article, () -> "alice").get("state").toString()).contains("p-4");
                    tabB.reading(article, "{\"locator\":\"bob-position\"}", 0, () -> "bob");
                    second.commit();
                    assertThat(tabA.reading(article, () -> "alice").get("state").toString()).contains("p-4");
                    assertThatThrownBy(() -> tabB.reading(privateArticle, "{}", 0, () -> "bob"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(404));
                    assertThatThrownBy(() -> tabA.reading(article, "x".repeat(1_000_001), 0, () -> "alice"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("STATE_SIZE"));

                    var vaultA = new VaultService(db, new UserRepository(db), null);
                    var vaultB = new VaultService(other, new UserRepository(other), null);
                    vaultA.state(object, "encrypted-position-A", 1, () -> "alice");
                    first.commit();
                    vaultB.state(object, "encrypted-position-B", 1, () -> "alice");
                    second.commit();
                    vaultA.state(object, "encrypted-position-C", 1, () -> "alice");
                    first.commit();
                    assertThat(vaultA.get(object, () -> "alice")).containsEntry("state", "encrypted-position-C").containsEntry("revision", 4L);
                    assertThatThrownBy(() -> vaultB.state(object, "unauthorized", 1, () -> "bob"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status().value()).isEqualTo(404));
                    assertThat(vaultA.get(object, () -> "alice")).containsEntry("state", "encrypted-position-C");
                    assertThatThrownBy(() -> vaultA.config("{}", 999, () -> "alice"))
                            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("REVISION_CONFLICT"));

                    var booksA = new ReadingRepository(db);
                    var booksB = new ReadingRepository(other);
                    booksA.save(alice, book, "page=9", new BigDecimal("0.9"), "tab-A");
                    first.commit();
                    booksB.save(alice, book, "page=2", new BigDecimal("0.2"), "tab-B");
                    second.commit();
                    assertThat(booksA.find(alice, book).orElseThrow().locator()).isEqualTo("page=2");
                    assertThat(booksA.find(bob, book)).isEmpty();
                }
            } finally {
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }

    private static ArticleService articles(DSLContext db) {
        return new ArticleService(db, new UserRepository(db), null, null, null, null);
    }

    private static UUID addUser(DSLContext db, String name) {
        UUID id = UUID.randomUUID();
        db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,?,?,'test-only','MEMBER')", id, name, name);
        return id;
    }

    private static Connection connect(String url, String user, String password, String schema) throws Exception {
        var connection = DriverManager.getConnection(url, user, password);
        try (var statement = connection.createStatement()) { statement.execute("set search_path to " + schema + ",public"); }
        connection.setAutoCommit(false);
        return connection;
    }
}
