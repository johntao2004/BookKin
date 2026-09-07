package io.github.johntao2004.bookkin.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.johntao2004.bookkin.config.BookKinProperties;
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
