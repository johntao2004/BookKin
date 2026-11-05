// 覆盖禁用 AI 时无密钥启动及配置密钥后的密文往返，避免测试暗示可以明文降级。
// Covers keyless startup with AI disabled and encrypted round trips with a configured key, without implying plaintext fallback.
package com.elexvx.silvae.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.elexvx.silvae.config.SilvaeProperties;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class AiSettingsCryptoTest {
    @Test
    void allowsApplicationToStartWithoutAKeyWhileAiIsDisabled() {
        var crypto = new AiSettingsCrypto(properties(""));

        assertFalse(crypto.isConfigured());
        assertNull(crypto.encrypt(""));
        assertThrows(IllegalStateException.class, () -> crypto.encrypt("provider-secret"));
    }

    @Test
    void roundTripsProviderSecretWithConfiguredInstanceKey() {
        var crypto = new AiSettingsCrypto(properties("instance-specific-test-key"));

        var ciphertext = crypto.encrypt("provider-secret");

        assertFalse(ciphertext.contains("provider-secret"));
        assertTrue(ciphertext.startsWith("v1:"));
        assertEquals("provider-secret", crypto.decrypt(ciphertext));
    }

    private SilvaeProperties properties(String key) {
        return new SilvaeProperties(null, null, null, null, null, null, null, null, null, null,
                new SilvaeProperties.Ai(false, true, 4, Duration.ofSeconds(20), List.of(), key));
    }
}
