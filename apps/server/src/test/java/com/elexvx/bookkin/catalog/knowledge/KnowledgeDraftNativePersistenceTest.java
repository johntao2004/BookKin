package com.elexvx.bookkin.catalog.knowledge;

import static org.assertj.core.api.Assertions.assertThat;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.catalog.BookFileStatus;
import com.elexvx.bookkin.catalog.BookFormat;
import java.sql.DriverManager;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import tools.jackson.databind.ObjectMapper;

/** Exercises selected knowledge persistence only in an isolated disposable PostgreSQL schema. */
@EnabledIfEnvironmentVariable(named = "BOOKKIN_NATIVE_TEST_URL", matches = ".+")
class KnowledgeDraftNativePersistenceTest {
    @Test
    void savesSelectedPointsCoverageAndHidesRowsForAnOlderFileFingerprint() throws Exception {
        String url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        String schema = "bookkin_knowledge_" + UUID.randomUUID().toString().replace("-", "");
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
                    UUID bookId = UUID.randomUUID();
                    UUID fileId = UUID.randomUUID();
                    UUID rootId = UUID.randomUUID();
                    String fingerprint = "sha256:knowledge-current";
                    db.execute("insert into books(id,title,sort_title,primary_author) values (?,?,?,?)",
                            bookId, "知识测试", "知识测试", "测试作者");
                    db.execute("insert into library_roots(id,name,configured_path) values (?,?,?)",
                            rootId, "knowledge-test", "/tmp/bookkin-knowledge-test");
                    db.execute("""
                            insert into book_files(id,book_id,library_root_id,relative_path,normalized_path,format,status,
                              size_bytes,modified_at,fingerprint,quick_fingerprint)
                            values (?,?,?,?,?,'EPUB','AVAILABLE',100,now(),?,?)
                            """, fileId, bookId, rootId, "测试作者/知识测试.epub", "测试作者/知识测试.epub",
                            fingerprint, "quick-knowledge-current");

                    BookFile file = new BookFile(fileId, bookId, rootId, "测试作者/知识测试.epub", BookFormat.EPUB,
                            BookFileStatus.AVAILABLE, 100, OffsetDateTime.now(), fingerprint, false, false, false);
                    var repository = new KnowledgeRepository(db, new ObjectMapper());
                    var points = List.of(new AiMetadataService.KnowledgePoint("认知偏差",
                            "认知偏差会影响人们处理信息时的判断和决策。", "chapter:1"));

                    repository.saveSelected(file, points, 2, 9);

                    var stored = repository.current(file).orElseThrow();
                    assertThat(stored.status()).isEqualTo("READY");
                    assertThat(stored.points()).isEqualTo(points);
                    assertThat(stored.sampledSections()).isEqualTo(2);
                    assertThat(stored.totalSections()).isEqualTo(9);
                    assertThat(stored.providerId()).isNull();

                    String changedFingerprint = "sha256:knowledge-next";
                    db.execute("update book_files set fingerprint = ? where id = ?", changedFingerprint, fileId);
                    BookFile changed = new BookFile(fileId, bookId, rootId, "测试作者/知识测试.epub", BookFormat.EPUB,
                            BookFileStatus.AVAILABLE, 100, OffsetDateTime.now(), changedFingerprint, false, false, false);
                    assertThat(repository.current(changed)).isEmpty();

                    repository.saveSelected(changed, List.of(), 0, 0);
                    assertThat(repository.current(changed).orElseThrow().points()).isEmpty();
                }
            } finally {
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }
}
