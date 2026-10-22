package com.elexvx.bookkin.reading;

import static org.assertj.core.api.Assertions.assertThat;
import com.elexvx.bookkin.catalog.BookRepository;
import java.sql.DriverManager;
import java.time.*;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** Opt-in real PostgreSQL verification in an isolated disposable schema, never the running library. */
@EnabledIfEnvironmentVariable(named = "BOOKKIN_NATIVE_TEST_URL", matches = ".+")
class ReadingOverviewNativePersistenceTest {
    @Test void ordersOwnHistoryBeforeLimitingAndFiltersNewBooksByTheActualWeek() throws Exception {
        var url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        var user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        var password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        var schema = "bookkin_overview_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(url, user, password); var statement = admin.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").load().migrate();
                try (var connection = DriverManager.getConnection(url, user, password); var setup = connection.createStatement()) {
                    setup.execute("set search_path to " + schema + ",public");
                    var db = DSL.using(connection, SQLDialect.POSTGRES);
                    var one = UUID.randomUUID(); var two = UUID.randomUUID(); var root = UUID.randomUUID();
                    for (var id : new UUID[]{one, two}) db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,?,?,'test-only','MEMBER')", id, id.toString(), "测试");
                    db.execute("insert into library_roots(id,name,configured_path) values (?,'test','/test-only')", root);
                    var a = book(db, root, "新入库但较早阅读", "2026-10-21T10:00:00+08:00", "AVAILABLE");
                    var b = book(db, root, "去年入库但最近阅读", "2025-01-01T10:00:00+08:00", "AVAILABLE");
                    var c = book(db, root, "零进度也有真实位置", "2024-01-01T10:00:00+08:00", "AVAILABLE");
                    var d = book(db, root, "更早阅读", "2026-01-01T10:00:00+08:00", "AVAILABLE");
                    var hidden = book(db, root, "已回收", "2026-10-22T12:00:00+08:00", "TRASHED");
                    var other = book(db, root, "另一用户的阅读", "2026-01-01T10:00:00+08:00", "AVAILABLE");
                    var oldSunday = book(db, root, "上周末", "2026-10-18T23:59:59+08:00", "AVAILABLE");
                    var nextMonday = book(db, root, "下周一", "2026-10-26T00:00:00+08:00", "AVAILABLE");
                    var thisMonday = book(db, root, "本周一边界", "2026-10-19T00:00:00+08:00", "AVAILABLE");
                    position(db, one, d, "2026-10-22T06:00:00+08:00");
                    position(db, one, a, "2026-10-22T07:00:00+08:00");
                    position(db, one, b, "2026-10-22T08:00:00+08:00");
                    position(db, one, c, "2026-10-22T09:00:00+08:00");
                    position(db, one, hidden, "2026-10-22T11:00:00+08:00");
                    position(db, two, other, "2026-10-22T12:00:00+08:00");
                    var service = new ReadingOverviewService(new ReadingRepository(db), new BookRepository(db),
                            Clock.fixed(Instant.parse("2026-10-22T06:00:00Z"), ZoneId.of("Asia/Shanghai")));
                    var overview = service.current(one);
                    assertThat(overview.recentReading()).extracting(item -> item.book().id()).containsExactly(c.toString(), b.toString(), a.toString());
                    assertThat(overview.featuredBook().id()).isEqualTo(a.toString());
                    assertThat(service.current(two).recentReading()).extracting(item -> item.book().id()).containsExactly(other.toString());
                    var gateway = new BookRepository(db);
                    var start = OffsetDateTime.parse("2026-10-19T00:00:00+08:00");
                    var end = OffsetDateTime.parse("2026-10-26T00:00:00+08:00");
                    db.execute("update book_files set status='MISSING' where book_id=?", a);
                    assertThat(gateway.newestAddedBetween(one, start, end).orElseThrow().id()).isEqualTo(thisMonday.toString());
                    db.execute("update book_files set status='MISSING' where book_id=?", thisMonday);
                    assertThat(gateway.newestAddedBetween(one, start, end)).isEmpty();
                    assertThat(gateway.findSummary(one, oldSunday)).isPresent();
                    assertThat(gateway.findSummary(one, nextMonday)).isPresent();
                }
            } finally { statement.execute("drop schema " + schema + " cascade"); }
        }
    }

    private UUID book(DSLContext db, UUID root, String title, String added, String status) {
        var id = UUID.randomUUID();
        db.execute("insert into books(id,title,sort_title,created_at) values (?,?,?,?::timestamptz)", id, title, title, added);
        db.execute("insert into book_files(book_id,library_root_id,relative_path,normalized_path,format,status,size_bytes,modified_at,fingerprint,quick_fingerprint) values (?,?,?,?,'PDF',?,1,now(),?,?)", id, root, id+".pdf", id+".pdf", status, id.toString(), id.toString());
        return id;
    }

    private void position(DSLContext db, UUID user, UUID book, String updated) {
        db.execute("insert into reading_positions(user_id,book_id,locator,progress,updated_at) values (?,?,'pdf:page=12',0,?::timestamptz)", user, book, updated);
    }
}
