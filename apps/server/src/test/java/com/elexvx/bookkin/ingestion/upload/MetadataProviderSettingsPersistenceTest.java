package com.elexvx.bookkin.ingestion.upload;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** Uses a unique schema on the isolated native-test database; never targets the application database. */
@EnabledIfEnvironmentVariable(named = "BOOKKIN_NATIVE_TEST_URL", matches = ".+")
class MetadataProviderSettingsPersistenceTest {
    @Test
    void providerSwitchesPersistWithActorAndCanBeUpdated() throws Exception {
        String url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        String schema = "bookkin_metadata_provider_" + UUID.randomUUID().toString().replace("-", "");
        UUID ownerId = UUID.randomUUID();

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
                    db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,'metadata-owner','测试主人','test','OWNER')", ownerId);

                    var repository = new MetadataProviderSettingsRepository(db);
                    assertThat(repository.findEnabled()).isEmpty();
                    repository.save(List.of(
                            new MetadataProviderSettingsRepository.ProviderSetting("OPEN_LIBRARY", false),
                            new MetadataProviderSettingsRepository.ProviderSetting("WIKIDATA", true)), ownerId);
                    assertThat(repository.findEnabled()).containsEntry("OPEN_LIBRARY", false).containsEntry("WIKIDATA", true);
                    var row = db.fetchOne("select updated_by, updated_at from metadata_provider_settings where provider_id = 'WIKIDATA'");
                    assertThat(row.get("updated_by", UUID.class)).isEqualTo(ownerId);
                    assertThat(row.get("updated_at", java.time.OffsetDateTime.class)).isNotNull();

                    repository.save(List.of(new MetadataProviderSettingsRepository.ProviderSetting("WIKIDATA", false)), ownerId);
                    assertThat(repository.findEnabled()).containsEntry("WIKIDATA", false);
                }
            } finally {
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }
}
