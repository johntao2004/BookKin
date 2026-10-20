// 覆盖禁用 AI 时无密钥启动及配置密钥后的密文往返，避免测试暗示可以明文降级。
// Covers keyless startup with AI disabled and encrypted round trips with a configured key, without implying plaintext fallback.
package com.elexvx.bookkin.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.elexvx.bookkin.config.BookKinProperties;
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

        assertEquals("provider-secret", crypto.decrypt(ciphertext));
    }

    private BookKinProperties properties(String key) {
        return new BookKinProperties(null, null, null, null, null, null, null, null, null, null,
                new BookKinProperties.Ai(false, true, 4, Duration.ofSeconds(20), List.of(), key));
    }
}
