package com.elexvx.bookkin.ingestion.upload;

import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataSource;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRole;
import java.security.Principal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
// Combines fixed source definitions, deployment availability and persisted enablement.
public class MetadataProviderSettingsService {
    private static final List<ProviderDefinition> PROVIDERS = List.of(
            new ProviderDefinition("OPEN_LIBRARY", "Open Library", "公开书目服务，无需部署密钥。", "https://openlibrary.org/"),
            new ProviderDefinition("WIKIDATA", "Wikidata", "官方书目数据，可补充版本、作者、出版社、ISBN 与语言信息。", "https://www.wikidata.org/"),
            new ProviderDefinition("GOOGLE_BOOKS", "Google Books", "通过 Google Books 检索书目与版本候选。", "https://developers.google.com/books"));
    private static final Set<String> PROVIDER_IDS = PROVIDERS.stream().map(ProviderDefinition::id).collect(java.util.stream.Collectors.toUnmodifiableSet());

    private final BookKinProperties properties;
    private final MetadataProviderSettingsRepository repository;
    private final RolePermissionService permissions;
    private final AuditService audit;

    public MetadataProviderSettingsService(BookKinProperties properties, MetadataProviderSettingsRepository repository,
                                           RolePermissionService permissions, AuditService audit) {
        this.properties = properties;
        this.repository = repository;
        this.permissions = permissions;
        this.audit = audit;
    }

    public MetadataProviderSettingsView view(Principal principal) {
        authorize(principal, "settings.ai.view");
        Map<String, Boolean> stored = repository.findEnabled();
        return view(stored);
    }

    @Transactional
    public MetadataProviderSettingsView update(List<ProviderSettingInput> requested, Principal principal) {
        BookKinUser actor = authorize(principal, "settings.ai.edit");
        if (requested == null || requested.isEmpty() || requested.size() > PROVIDERS.size()) {
            throw ApiException.badRequest("METADATA_PROVIDER_SETTINGS_INVALID", "至少选择一个有效的元数据来源。");
        }

        Map<String, Boolean> seen = new LinkedHashMap<>();
        List<MetadataProviderSettingsRepository.ProviderSetting> changes = new ArrayList<>();
        for (ProviderSettingInput setting : requested) {
            String id = setting == null || setting.id() == null ? "" : setting.id().strip();
            if (!PROVIDER_IDS.contains(id)) {
                throw ApiException.badRequest("METADATA_PROVIDER_UNKNOWN", "元数据来源标识无效。");
            }
            if (setting.enabled() == null || seen.putIfAbsent(id, setting.enabled()) != null) {
                throw ApiException.badRequest("METADATA_PROVIDER_DUPLICATE", "元数据来源必须唯一且包含启用状态。");
            }
            if (setting.enabled() && !available(id)) {
                throw ApiException.conflict("METADATA_PROVIDER_UNAVAILABLE", "Google Books 未配置部署 API 密钥，不能启用。");
            }
            changes.add(new MetadataProviderSettingsRepository.ProviderSetting(id, setting.enabled()));
        }

        repository.save(changes, actor.id());
        audit.record(actor.id(), "METADATA_PROVIDER_SETTINGS_CHANGED", "METADATA_PROVIDER_SETTINGS", "1",
                null, null, null, null, "SUCCEEDED", auditDetail(changes));
        return view(repository.findEnabled());
    }

    /** Returns the effective state used by metadata matching, including live key availability. */
    public boolean isEnabled(MetadataSource source) {
        if (source == null) return false;
        String id = switch (source) {
            case OPEN_LIBRARY -> "OPEN_LIBRARY";
            case WIKIDATA -> "WIKIDATA";
            case GOOGLE_BOOKS -> "GOOGLE_BOOKS";
            default -> null;
        };
        if (id == null || !available(id)) return false;
        return enabled(repository.findEnabled(), id);
    }

    private BookKinUser authorize(Principal principal, String permission) {
        BookKinUser actor = permissions.actor(principal);
        if (actor.role() != UserRole.OWNER && actor.role() != UserRole.ADMIN) {
            throw ApiException.forbidden("ACCESS_DENIED", "只有主人或管理员可以管理元数据来源。");
        }
        permissions.require(principal, permission);
        return actor;
    }

    private MetadataProviderSettingsView view(Map<String, Boolean> stored) {
        List<MetadataProviderView> result = PROVIDERS.stream().map(provider -> {
            boolean available = available(provider.id());
            String description = provider.id().equals("GOOGLE_BOOKS") && !available
                    ? "需要配置 Google Books API 密钥后才能启用。"
                    : provider.description();
            return new MetadataProviderView(provider.id(), provider.label(), enabled(stored, provider.id()) && available,
                    available, description, provider.homepage());
        }).toList();
        return new MetadataProviderSettingsView(result);
    }

    private boolean enabled(Map<String, Boolean> stored, String id) {
        if (stored.containsKey(id)) return Boolean.TRUE.equals(stored.get(id));
        return switch (id) {
            case "OPEN_LIBRARY" -> properties.metadataProviders().openLibraryEnabled();
            case "GOOGLE_BOOKS" -> available(id);
            case "WIKIDATA" -> false;
            default -> false;
        };
    }

    private boolean available(String id) {
        if (!id.equals("GOOGLE_BOOKS")) return true;
        String key = properties.metadataProviders().googleApiKey();
        return key != null && !key.isBlank();
    }

    private String auditDetail(List<MetadataProviderSettingsRepository.ProviderSetting> changes) {
        String entries = changes.stream().map(setting -> "{\"id\":\"" + setting.providerId()
                + "\",\"enabled\":" + setting.enabled() + "}").collect(java.util.stream.Collectors.joining(","));
        return "{\"providers\":[" + entries + "]}";
    }

    public record ProviderSettingInput(String id, Boolean enabled) {}
    public record MetadataProviderView(String id, String label, boolean enabled, boolean available,
                                       String description, String homepage) {}
    public record MetadataProviderSettingsView(List<MetadataProviderView> providers) {}

    private record ProviderDefinition(String id, String label, String description, String homepage) {}
}
