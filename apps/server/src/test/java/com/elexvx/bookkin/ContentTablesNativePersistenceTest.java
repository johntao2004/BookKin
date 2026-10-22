package com.elexvx.bookkin;

import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.assertj.core.api.Assertions.*;

/** Uses only a disposable schema; existing book, article and vault rows are untouched. */
@EnabledIfEnvironmentVariable(named="BOOKKIN_NATIVE_TEST_URL", matches=".+")
class ContentTablesNativePersistenceTest {
    @Test void sameIdsAndArticleDeletionRemainIndependentAcrossThreeContentTables() throws Exception {
        String url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        String schema = "bookkin_storage_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(url, user, password); var statement = admin.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").load().migrate();
                try (var connection = DriverManager.getConnection(url, user, password); var setup = connection.createStatement()) {
                    setup.execute("set search_path to " + schema + ",public");
                    var db = DSL.using(connection, SQLDialect.POSTGRES);
                    for (String table : new String[]{"app_users", "books", "articles", "annotations", "reading_positions", "reading_time_daily", "vault_objects"}) {
                        assertThat(db.fetchCount(DSL.table(table))).as("empty initialization: " + table).isZero();
                    }
                    assertThat(db.fetchCount(DSL.table("flyway_schema_history"))).isEqualTo(1);
                    UUID owner = UUID.randomUUID(), id = UUID.randomUUID();
                    db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?, 'storage-owner', '存储测试', 'test-only', 'OWNER')", owner);
                    db.execute("insert into books(id,title,sort_title) values (?, '书籍', '书籍')", id);
                    db.execute("insert into articles(id,owner_id,title,visibility,html) values (?, ?, '文章', 'PRIVATE', '<p>正文</p>')", id, owner);
                    db.execute("insert into personal_vault(user_id,envelope) values (?, '{}'::jsonb)", owner);
                    db.execute("insert into vault_objects(id,user_id,manifest,state) values (?, ?, 'encrypted-manifest', 'encrypted-state')", id, owner);
                    db.execute("delete from articles where id=?", id);
                    assertThat(db.fetchOne("select count(*) from books where id=?", id).get(0, Long.class)).isEqualTo(1L);
                    assertThat(db.fetchValue("select count(*) from vault_objects where id=? and user_id=?", id, owner)).isEqualTo(1L);
                    assertThat(db.fetchValue("select count(*) from articles where id=?", id)).isEqualTo(0L);
                }
            } finally { statement.execute("drop schema " + schema + " cascade"); }
        }
    }
}
