package com.elexvx.bookkin.ingestion.upload;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
// Persists only the fixed metadata-source switches; credentials stay in deployment configuration.
public class MetadataProviderSettingsRepository {
    private final DSLContext dsl;

    public MetadataProviderSettingsRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Map<String, Boolean> findEnabled() {
        Map<String, Boolean> result = new LinkedHashMap<>();
        dsl.fetch("select provider_id, enabled from metadata_provider_settings order by provider_id")
                .forEach(row -> result.put(row.get("provider_id", String.class),
                        Boolean.TRUE.equals(row.get("enabled", Boolean.class))));
        return Map.copyOf(result);
    }

    @Transactional
    public void save(List<ProviderSetting> settings, UUID actorId) {
        for (ProviderSetting setting : settings) {
            dsl.execute("""
                    insert into metadata_provider_settings(provider_id, enabled, updated_by, updated_at)
                    values (?, ?, ?, now())
                    on conflict (provider_id) do update set enabled = excluded.enabled,
                      updated_by = excluded.updated_by, updated_at = now()
                    """, setting.providerId(), setting.enabled(), actorId);
        }
    }

    public record ProviderSetting(String providerId, boolean enabled) {}
}
