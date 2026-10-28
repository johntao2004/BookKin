package com.elexvx.bookkin.ingestion.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataSource;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MetadataProviderSettingsServiceTest {
    private static final Principal OWNER = () -> "owner";

    @Test
    void defaultsFollowDeploymentConfigurationAndWikidataStartsDisabled() {
        var repository = mock(MetadataProviderSettingsRepository.class);
        var permissions = ownerPermissions();
        when(repository.findEnabled()).thenReturn(Map.of());
        var service = service(repository, permissions, "google-key", false);

        var view = service.view(OWNER);

        assertThat(view.providers()).extracting(MetadataProviderSettingsService.MetadataProviderView::id)
                .containsExactly("OPEN_LIBRARY", "WIKIDATA", "GOOGLE_BOOKS");
        assertThat(view.providers()).extracting(MetadataProviderSettingsService.MetadataProviderView::enabled)
                .containsExactly(false, false, true);
        assertThat(view.providers()).extracting(MetadataProviderSettingsService.MetadataProviderView::available)
                .containsExactly(true, true, true);
        assertThat(view.providers().get(2).homepage()).isEqualTo("https://developers.google.com/books");
        verify(permissions).require(OWNER, "settings.ai.view");
        assertThat(service.isEnabled(MetadataSource.OPEN_LIBRARY)).isFalse();
        assertThat(service.isEnabled(MetadataSource.WIKIDATA)).isFalse();
        assertThat(service.isEnabled(MetadataSource.GOOGLE_BOOKS)).isTrue();
    }

    @Test
    void storedSettingsOverrideDefaultsAndMissingGoogleKeySuppressesEffectiveEnablement() {
        var repository = mock(MetadataProviderSettingsRepository.class);
        when(repository.findEnabled()).thenReturn(Map.of("OPEN_LIBRARY", false, "WIKIDATA", true, "GOOGLE_BOOKS", true));
        var service = service(repository, ownerPermissions(), null, true);

        var providers = service.view(OWNER).providers();

        assertThat(providers).extracting(MetadataProviderSettingsService.MetadataProviderView::enabled)
                .containsExactly(false, true, false);
        assertThat(providers.get(2).available()).isFalse();
        assertThat(providers.get(2).description()).contains("Google Books API 密钥");
        assertThat(service.isEnabled(MetadataSource.WIKIDATA)).isTrue();
        assertThat(service.isEnabled(MetadataSource.GOOGLE_BOOKS)).isFalse();
    }

    @Test
    void updatePersistsOnlyFixedProviderSwitchesAndAuditsActor() {
        var repository = mock(MetadataProviderSettingsRepository.class);
        var audit = mock(AuditService.class);
        var permissions = ownerPermissions();
        when(repository.findEnabled()).thenReturn(Map.of("WIKIDATA", true));
        var service = service(repository, permissions, null, false, audit);

        var view = service.update(List.of(new MetadataProviderSettingsService.ProviderSettingInput("WIKIDATA", true)), OWNER);

        verify(repository).save(List.of(new MetadataProviderSettingsRepository.ProviderSetting("WIKIDATA", true)), OWNER_ID);
        verify(permissions).require(OWNER, "settings.ai.edit");
        verify(audit).record(OWNER_ID, "METADATA_PROVIDER_SETTINGS_CHANGED", "METADATA_PROVIDER_SETTINGS", "1",
                null, null, null, null, "SUCCEEDED", "{\"providers\":[{\"id\":\"WIKIDATA\",\"enabled\":true}]}");
        assertThat(view.providers().get(1).enabled()).isTrue();
    }

    @Test
    void rejectsUnknownDuplicateAndUnavailableProviderBeforeWriting() {
        var repository = mock(MetadataProviderSettingsRepository.class);
        var audit = mock(AuditService.class);
        var service = service(repository, ownerPermissions(), null, true, audit);

        assertThatThrownBy(() -> service.update(List.of(new MetadataProviderSettingsService.ProviderSettingInput("CUSTOM", true)), OWNER))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("METADATA_PROVIDER_UNKNOWN"));
        assertThatThrownBy(() -> service.update(List.of(
                new MetadataProviderSettingsService.ProviderSettingInput("WIKIDATA", true),
                new MetadataProviderSettingsService.ProviderSettingInput("WIKIDATA", false)), OWNER))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("METADATA_PROVIDER_DUPLICATE"));
        assertThatThrownBy(() -> service.update(List.of(new MetadataProviderSettingsService.ProviderSettingInput("GOOGLE_BOOKS", true)), OWNER))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("METADATA_PROVIDER_UNAVAILABLE"));
        verify(repository, never()).save(org.mockito.ArgumentMatchers.anyList(), org.mockito.ArgumentMatchers.any());
        verifyNoInteractions(audit);
    }

    @Test
    void memberCannotReadOrWriteEvenIfAServiceCallReachesTheBoundary() {
        var repository = mock(MetadataProviderSettingsRepository.class);
        var permissions = mock(RolePermissionService.class);
        var member = new BookKinUser(UUID.randomUUID(), "member", "成员", "hash", UserRole.MEMBER,
                UserStatus.ACTIVE, false, OffsetDateTime.now(), null);
        when(permissions.actor(OWNER)).thenReturn(member);
        var service = service(repository, permissions, "", true);

        assertThatThrownBy(() -> service.view(OWNER)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.update(List.of(new MetadataProviderSettingsService.ProviderSettingInput("WIKIDATA", true)), OWNER))
                .isInstanceOf(ApiException.class);
        verify(repository, never()).findEnabled();
        verify(repository, never()).save(org.mockito.ArgumentMatchers.anyList(), org.mockito.ArgumentMatchers.any());
    }

    private static final UUID OWNER_ID = UUID.fromString("8148390a-66e5-4eb3-a0fd-71cc0a0111d3");

    private RolePermissionService ownerPermissions() {
        var permissions = mock(RolePermissionService.class);
        var owner = new BookKinUser(OWNER_ID, "owner", "主人", "hash", UserRole.OWNER,
                UserStatus.ACTIVE, false, OffsetDateTime.now(), null);
        when(permissions.actor(OWNER)).thenReturn(owner);
        return permissions;
    }

    private MetadataProviderSettingsService service(MetadataProviderSettingsRepository repository,
            RolePermissionService permissions, String googleKey, boolean openLibraryEnabled) {
        return service(repository, permissions, googleKey, openLibraryEnabled, mock(AuditService.class));
    }

    private MetadataProviderSettingsService service(MetadataProviderSettingsRepository repository,
            RolePermissionService permissions, String googleKey, boolean openLibraryEnabled, AuditService audit) {
        var properties = new BookKinProperties(null, null, null, null, null, null, null, null, null,
                new BookKinProperties.MetadataProviders(openLibraryEnabled, googleKey), null);
        return new MetadataProviderSettingsService(properties, repository, permissions, audit);
    }
}
