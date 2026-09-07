package io.github.johntao2004.bookkin.ai;

import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.config.BookKinProperties;
import io.github.johntao2004.bookkin.config.BookKinProperties.AiProvider;
import io.github.johntao2004.bookkin.config.BookKinProperties.AiProviderType;
import io.github.johntao2004.bookkin.users.BookKinUser;
import io.github.johntao2004.bookkin.users.UserRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AiSettingsService {
    private final BookKinProperties properties;
    private final AiSettingsRepository repository;
    private final AiSettingsCrypto crypto;
    private final UserRepository users;
    private final AuditService audit;

    public AiSettingsService(BookKinProperties properties, AiSettingsRepository repository, AiSettingsCrypto crypto,
                             UserRepository users, AuditService audit) {
        this.properties = properties;
        this.repository = repository;
        this.crypto = crypto;
        this.users = users;
        this.audit = audit;
    }

    public BookKinProperties.Ai effective() {
        BookKinProperties.Ai defaults = properties.ai();
        AiSettingsRepository.GlobalSettings global = repository.global().orElse(null);
        Map<String, EffectiveProvider> providers = new LinkedHashMap<>();
        for (AiProvider provider : defaults.providers()) {
            providers.put(provider.id(), new EffectiveProvider(provider.id(), provider.label(), provider.type(), provider.enabled(),
                    provider.baseUrl(), provider.apiKey(), provider.model()));
        }
        for (AiSettingsRepository.ProviderSettings stored : repository.providers()) {
            String key = decrypt(stored.apiKeyCiphertext());
            providers.put(stored.id(), new EffectiveProvider(stored.id(), stored.label(), stored.type(), stored.enabled(),
                    stored.baseUrl(), key, stored.model()));
        }
        int maxCandidates = global == null ? defaults.maxCandidates() : global.maxCandidates();
        int timeoutSeconds = global == null ? Math.toIntExact(defaults.timeout().toSeconds()) : global.timeoutSeconds();
        return new BookKinProperties.Ai(global == null ? defaults.enabled() : global.enabled(),
                global == null ? defaults.autoMatch() : global.autoMatch(), maxCandidates,
                java.time.Duration.ofSeconds(timeoutSeconds), providers.values().stream().map(EffectiveProvider::toConfig).toList(),
                defaults.settingsEncryptionKey());
    }

    public AiSettingsView view() {
        BookKinProperties.Ai current = effective();
        OffsetDateTime updatedAt = repository.global().map(AiSettingsRepository.GlobalSettings::updatedAt).orElse(null);
        return new AiSettingsView(current.enabled(), current.autoMatch(), current.maxCandidates(), Math.toIntExact(current.timeout().toSeconds()),
                current.providers().stream().map(provider -> new AiProviderView(provider.id(), provider.label(), provider.type().name(),
                        provider.enabled(), provider.baseUrl(), provider.model(), configured(provider),
                        current.enabled() && provider.enabled() && configured(provider), !provider.apiKey().isBlank(), updatedAt)).toList(), updatedAt);
    }

    @Transactional
    public AiSettingsView update(AiSettingsInput input, String username) {
        BookKinUser actor = users.findByUsername(username)
                .orElseThrow(() -> ApiException.forbidden("OWNER_REQUIRED", "仅主人或管理员可以修改 AI 设置。"));
        List<AiProviderInput> requestedProviders = input.providers() == null ? List.of() : input.providers();
        if (requestedProviders.size() > 20) throw ApiException.badRequest("AI_PROVIDER_LIMIT", "AI 平台最多配置 20 个。");
        Map<String, AiProvider> existing = effective().providers().stream().collect(java.util.stream.Collectors.toMap(AiProvider::id, value -> value, (left, right) -> left, LinkedHashMap::new));
        Map<String, AiSettingsRepository.ProviderSettings> stored = repository.providers().stream()
                .collect(java.util.stream.Collectors.toMap(AiSettingsRepository.ProviderSettings::id, value -> value, (left, right) -> left));
        List<AiSettingsRepository.ProviderSettings> providers = new ArrayList<>();
        Map<String, Boolean> seen = new LinkedHashMap<>();
        for (AiProviderInput requested : requestedProviders) {
            String id = clean(requested.id());
            if (id.isBlank() || id.length() > 80 || seen.put(id, true) != null) {
                throw ApiException.badRequest("AI_PROVIDER_INVALID", "AI 平台标识必须唯一且有效。");
            }
            AiProvider fallback = existing.get(id);
            String label = clean(requested.label());
            if (label.isBlank() && fallback != null) label = fallback.label();
            AiProviderType type;
            try {
                type = requested.type() == null ? fallback == null ? AiProviderType.OPENAI_COMPATIBLE : fallback.type() : AiProviderType.valueOf(requested.type());
            } catch (IllegalArgumentException exception) {
                throw ApiException.badRequest("AI_PROVIDER_TYPE_INVALID", "AI 平台类型无效。");
            }
            String previousKey = fallback == null ? "" : fallback.apiKey();
            if (stored.containsKey(id)) previousKey = decrypt(stored.get(id).apiKeyCiphertext());
            String apiKey = requested.clearApiKey() ? "" : requested.apiKey() == null || requested.apiKey().isBlank() ? previousKey : requested.apiKey().strip();
            if (!apiKey.isBlank() && !crypto.isConfigured()) {
                throw ApiException.conflict("AI_SETTINGS_KEY_MISSING", "保存 AI 平台密钥前必须配置 BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY。");
            }
            providers.add(new AiSettingsRepository.ProviderSettings(id, label.isBlank() ? id : label,
                    type, requested.enabled(), bounded(requested.baseUrl(), 500), crypto.encrypt(apiKey), bounded(requested.model(), 200)));
        }
        int maxCandidates = Math.max(1, Math.min(10, input.maxCandidates()));
        int timeoutSeconds = Math.max(5, Math.min(120, input.timeoutSeconds()));
        repository.save(new AiSettingsRepository.GlobalSettings(input.enabled(), input.autoMatch(), maxCandidates, timeoutSeconds, OffsetDateTime.now()), providers, actor.id());
        audit.record(actor.id(), "AI_SETTINGS_CHANGED", "AI_SETTINGS", "1", null, null, null, null, "SUCCEEDED",
                "{\"enabled\":" + input.enabled() + ",\"autoMatch\":" + input.autoMatch() + ",\"providers\":" + providers.size() + "}");
        return view();
    }

    private String decrypt(String ciphertext) {
        if (ciphertext == null || ciphertext.isBlank()) return "";
        try {
            return crypto.decrypt(ciphertext);
        } catch (IllegalArgumentException exception) {
            return "";
        }
    }

    private boolean configured(AiProvider provider) {
        if (provider.id().isBlank() || provider.model().isBlank()) return false;
        return switch (provider.type()) {
            case OPENAI_COMPATIBLE -> !provider.apiKey().isBlank() || isLocal(provider.baseUrl());
            case ANTHROPIC, GEMINI -> !provider.apiKey().isBlank();
        };
    }

    private boolean isLocal(String baseUrl) {
        return baseUrl != null && (baseUrl.contains("localhost") || baseUrl.contains("127.0.0.1") || baseUrl.contains("::1"));
    }

    private String clean(String value) { return value == null ? "" : value.strip(); }

    private String bounded(String value, int max) {
        String clean = clean(value);
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    private record EffectiveProvider(String id, String label, AiProviderType type, boolean enabled, String baseUrl,
                                     String apiKey, String model) {
        AiProvider toConfig() { return new AiProvider(id, label, type, enabled, baseUrl, apiKey, model); }
    }

    public record AiSettingsInput(boolean enabled, boolean autoMatch, int maxCandidates, int timeoutSeconds,
                                  List<AiProviderInput> providers) {}

    public record AiProviderInput(String id, String label, String type, boolean enabled, String baseUrl, String model,
                                  String apiKey, boolean clearApiKey) {}

    public record AiSettingsView(boolean enabled, boolean autoMatch, int maxCandidates, int timeoutSeconds,
                                 List<AiProviderView> providers, OffsetDateTime updatedAt) {}

    public record AiProviderView(String id, String label, String type, boolean enabled, String baseUrl, String model,
                                 boolean configured, boolean available, boolean apiKeyConfigured, OffsetDateTime updatedAt) {}
}
