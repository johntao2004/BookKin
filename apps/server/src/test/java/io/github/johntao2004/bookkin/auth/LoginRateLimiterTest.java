package io.github.johntao2004.bookkin.auth;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.johntao2004.bookkin.common.ApiException;
import org.junit.jupiter.api.Test;

class LoginRateLimiterTest {
    @Test
    void blocksAfterEightFailuresAndIsolatedByKey() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        for (int attempt = 0; attempt < 8; attempt++) {
            assertDoesNotThrow(() -> limiter.check("one"));
            limiter.failure("one");
        }
        assertThrows(ApiException.class, () -> limiter.check("one"));
        assertDoesNotThrow(() -> limiter.check("two"));
        limiter.success("one");
        assertDoesNotThrow(() -> limiter.check("one"));
    }
}
