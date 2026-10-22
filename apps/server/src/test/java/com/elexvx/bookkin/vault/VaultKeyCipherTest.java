package com.elexvx.bookkin.vault;

import static org.assertj.core.api.Assertions.*;
import com.elexvx.bookkin.common.ApiException;
import java.util.*;
import org.junit.jupiter.api.Test;

class VaultKeyCipherTest {
    @Test void ciphertextIsRandomizedAndBoundToInstanceUserAndEnvelope() {
        var cipher = new VaultKeyCipher("isolated-test-key");
        var owner = UUID.randomUUID(); byte[] master = new byte[32]; new Random(31).nextBytes(master);
        String encrypted = cipher.encrypt(owner, "canonical-envelope", master);
        assertThat(encrypted).isNotEqualTo(cipher.encrypt(owner, "canonical-envelope", master));
        assertThat(encrypted).doesNotContain(Base64.getEncoder().encodeToString(master));
        assertThat(cipher.decrypt(owner, "canonical-envelope", encrypted)).isEqualTo(master);
        assertThatThrownBy(() -> cipher.decrypt(UUID.randomUUID(), "canonical-envelope", encrypted)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> cipher.decrypt(owner, "changed-envelope", encrypted)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> new VaultKeyCipher("different-instance").decrypt(owner, "canonical-envelope", encrypted)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> new VaultKeyCipher("").encrypt(owner, "canonical-envelope", master)).isInstanceOf(ApiException.class);
        assertThat(new VaultKeyService.Access("SECRET", "envelope", 1).toString()).doesNotContain("SECRET");
        assertThat(new VaultController.KeyMigration("SECRET", 1).toString()).doesNotContain("SECRET");
    }
}
