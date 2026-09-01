package io.github.johntao2004.bookkin.reading;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class ReaderFontRepositoryIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18-alpine");

    static DSLContext dsl;

    @BeforeAll
    static void migrate() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .load()
                .migrate();
        dsl = DSL.using(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    @Test
    void findsOnlyExpiredPendingUploadsUsingATimestamptzCutoff() {
        UUID userId = UUID.randomUUID();
        UUID expiredId = UUID.randomUUID();
        UUID recentId = UUID.randomUUID();
        dsl.execute("""
                insert into app_users(id, username, display_name, password_hash, role, must_change_password)
                values (?, ?, '字体管理员', 'test-password-hash', 'ADMIN', false)
                """, userId, "font-admin-" + userId);
        insertPendingFont(expiredId, userId, "pending:expired", OffsetDateTime.now().minusHours(25));
        insertPendingFont(recentId, userId, "pending:recent", OffsetDateTime.now());

        var expired = new ReaderFontRepository(dsl).findStagingBefore(OffsetDateTime.now().minusHours(24));

        assertEquals(1, expired.size());
        assertEquals(expiredId, expired.getFirst().id());
    }

    private static void insertPendingFont(UUID id, UUID userId, String fingerprint, OffsetDateTime createdAt) {
        dsl.execute("""
                insert into reader_fonts(id, display_name, family_name, font_kind, source, status, format,
                  mime_type, size_bytes, fingerprint, staging_path, uploaded_by, created_at)
                values (?, '测试字体', 'Test Font', 'SERIF', 'CUSTOM', 'DISABLED', 'TTF',
                  'font/ttf', 1024, ?, '.bookkin-staging/fonts/test.ttf', ?, ?::timestamptz)
                """, id, fingerprint, userId, createdAt);
    }
}
