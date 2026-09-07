package io.github.johntao2004.bookkin.ai;

import io.github.johntao2004.bookkin.config.BookKinProperties.AiProviderType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class AiSettingsRepository {
    private final DSLContext dsl;

    public AiSettingsRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<GlobalSettings> global() {
        return dsl.fetchOptional("select * from ai_settings where id = 1").map(this::mapGlobal);
    }

    public List<ProviderSettings> providers() {
        return dsl.fetch("select * from ai_provider_settings order by provider_id").map(this::mapProvider);
    }

    @Transactional
    public void save(GlobalSettings global, List<ProviderSettings> providers, UUID actor) {
        dsl.execute("""
                insert into ai_settings(id, enabled, auto_match, max_candidates, timeout_seconds, updated_by, updated_at)
                values (1, ?, ?, ?, ?, ?, now())
                on conflict (id) do update set enabled = excluded.enabled, auto_match = excluded.auto_match,
                  max_candidates = excluded.max_candidates, timeout_seconds = excluded.timeout_seconds,
                  updated_by = excluded.updated_by, updated_at = now()
                """, global.enabled(), global.autoMatch(), global.maxCandidates(), global.timeoutSeconds(), actor);
        for (ProviderSettings provider : providers) {
            dsl.execute("""
                    insert into ai_provider_settings(provider_id, label, provider_type, enabled, base_url,
                      api_key_ciphertext, model, updated_by, updated_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?, now())
                    on conflict (provider_id) do update set label = excluded.label, provider_type = excluded.provider_type,
                      enabled = excluded.enabled, base_url = excluded.base_url, api_key_ciphertext = excluded.api_key_ciphertext,
                      model = excluded.model, updated_by = excluded.updated_by, updated_at = now()
                    """, provider.id(), provider.label(), provider.type().name(), provider.enabled(), provider.baseUrl(),
                    provider.apiKeyCiphertext(), provider.model(), actor);
        }
    }

    private GlobalSettings mapGlobal(Record row) {
        return new GlobalSettings(
                Boolean.TRUE.equals(row.get("enabled", Boolean.class)),
                Boolean.TRUE.equals(row.get("auto_match", Boolean.class)),
                row.get("max_candidates", Integer.class),
                row.get("timeout_seconds", Integer.class),
                row.get("updated_at", OffsetDateTime.class));
    }

    private ProviderSettings mapProvider(Record row) {
        return new ProviderSettings(
                row.get("provider_id", String.class),
                row.get("label", String.class),
                AiProviderType.valueOf(row.get("provider_type", String.class)),
                Boolean.TRUE.equals(row.get("enabled", Boolean.class)),
                row.get("base_url", String.class),
                row.get("api_key_ciphertext", String.class),
                row.get("model", String.class));
    }

    public record GlobalSettings(boolean enabled, boolean autoMatch, int maxCandidates, int timeoutSeconds,
                                 OffsetDateTime updatedAt) {}

    public record ProviderSettings(String id, String label, AiProviderType type, boolean enabled, String baseUrl,
                                   String apiKeyCiphertext, String model) {}
}
