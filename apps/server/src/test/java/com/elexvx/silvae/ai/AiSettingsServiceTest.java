package com.elexvx.silvae.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;

import com.elexvx.silvae.audit.AuditService;
import com.elexvx.silvae.config.SilvaeProperties;
import com.elexvx.silvae.config.SilvaeProperties.AiProvider;
import com.elexvx.silvae.config.SilvaeProperties.AiProviderType;
import com.elexvx.silvae.users.UserRepository;
import com.elexvx.silvae.users.SilvaeUser;
import com.elexvx.silvae.users.UserRole;
import com.elexvx.silvae.users.UserStatus;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;

class AiSettingsServiceTest {
    @Test
    void persistedZhipuProviderOverridesNewApplicationDefaultsWithoutBeingReplaced() {
        var defaults = new AiProvider("zhipu", "智谱", AiProviderType.OPENAI_COMPATIBLE, false,
                "https://open.bigmodel.cn/api/paas/v4/", "", "glm-4.7-flash");
        var properties = new SilvaeProperties(null, null, null, null, null, null, null, null, null, null,
                new SilvaeProperties.Ai(false, true, 4, Duration.ofSeconds(20), List.of(defaults), "test-ai-settings-key"));
        var crypto = new AiSettingsCrypto(properties);
        var repository = mock(AiSettingsRepository.class);
        when(repository.global()).thenReturn(Optional.empty());
        when(repository.providers()).thenReturn(List.of(new AiSettingsRepository.ProviderSettings(
                "zhipu", "已保存的智谱名称", AiProviderType.OPENAI_COMPATIBLE, true,
                "https://custom.example/v1", crypto.encrypt("stored-provider-secret"), "custom-model")));

        var service = new AiSettingsService(properties, repository, crypto, mock(UserRepository.class), mock(AuditService.class));
        var effective = service.effective().providers().getFirst();
        var view = service.view().providers().getFirst();

        assertEquals("zhipu", effective.id());
        assertEquals("已保存的智谱名称", effective.label());
        assertEquals("https://custom.example/v1", effective.baseUrl());
        assertEquals("custom-model", effective.model());
        assertEquals("stored-provider-secret", effective.apiKey());
        assertEquals("custom-model", view.model());
        assertEquals(true, view.enabled());
        assertEquals(true, view.apiKeyConfigured());
        verify(repository, never()).save(any(), anyList(), any());
    }

    @Test
    void savingBlankKeyRetainsAndPersistsOnlyEncryptedProviderSecret() {
        var defaults = new AiProvider("zhipu", "智谱", AiProviderType.OPENAI_COMPATIBLE, false,
                "https://open.bigmodel.cn/api/paas/v4/", "", "glm-4.7-flash");
        var properties = new SilvaeProperties(null, null, null, null, null, null, null, null, null, null,
                new SilvaeProperties.Ai(false, true, 4, Duration.ofSeconds(20), List.of(defaults), "test-ai-settings-key"));
        var crypto = new AiSettingsCrypto(properties);
        var repository = mock(AiSettingsRepository.class);
        var storedCiphertext = crypto.encrypt("stored-provider-secret");
        when(repository.global()).thenReturn(Optional.empty());
        when(repository.providers()).thenReturn(List.of(new AiSettingsRepository.ProviderSettings(
                "zhipu", "智谱", AiProviderType.OPENAI_COMPATIBLE, false, defaults.baseUrl(), storedCiphertext, defaults.model())));
        var users = mock(UserRepository.class);
        var actorId = UUID.randomUUID();
        when(users.findByUsername("owner")).thenReturn(Optional.of(new SilvaeUser(actorId, "owner", "Owner", "hash",
                UserRole.OWNER, UserStatus.ACTIVE, false, OffsetDateTime.now(), null)));
        var service = new AiSettingsService(properties, repository, crypto, users, mock(AuditService.class));

        service.update(new AiSettingsService.AiSettingsInput(false, true, 4, 20, List.of(
                new AiSettingsService.AiProviderInput("zhipu", "智谱", "OPENAI_COMPATIBLE", true,
                        defaults.baseUrl(), "glm-4.7-flash", "", false))), "owner");

        var saved = ArgumentCaptor.forClass(List.class);
        verify(repository).save(any(), saved.capture(), eq(actorId));
        var provider = (AiSettingsRepository.ProviderSettings) saved.getValue().getFirst();
        assertEquals("v1:", provider.apiKeyCiphertext().substring(0, 3));
        assertEquals("stored-provider-secret", crypto.decrypt(provider.apiKeyCiphertext()));
        org.junit.jupiter.api.Assertions.assertFalse(provider.apiKeyCiphertext().contains("stored-provider-secret"));
    }
}
