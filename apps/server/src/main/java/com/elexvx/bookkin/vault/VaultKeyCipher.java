package com.elexvx.bookkin.vault;

import com.elexvx.bookkin.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Domain-separated instance key; ciphertext is bound to both user and canonical envelope. */
@Component
public class VaultKeyCipher {
    private final SecretKeySpec key;
    public VaultKeyCipher(@Value("${bookkin.two-factor-encryption-key:}") String configured) {
        try {
            key = configured == null || configured.isBlank() ? null : new SecretKeySpec(
                MessageDigest.getInstance("SHA-256").digest(("bookkin:vault:content-key:v1\0" + configured).getBytes(StandardCharsets.UTF_8)), "AES");
        } catch (GeneralSecurityException e) { throw new IllegalStateException(e); }
    }
    private byte[] aad(UUID user, String envelope) {
        return ("bookkin:vault:content-key:v1:" + user + ":" + envelope).getBytes(StandardCharsets.UTF_8);
    }
    private void requireKey() {
        if (key == null) throw ApiException.conflict("VAULT_KEY_UNAVAILABLE", "服务器加密密钥不可用，请联系主人检查配置。");
    }
    public String encrypt(UUID user, String envelope, byte[] master) {
        requireKey();
        try {
            byte[] iv = new byte[12]; new SecureRandom().nextBytes(iv);
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            cipher.updateAAD(aad(user, envelope));
            return Base64.getEncoder().encodeToString(iv) + "." + Base64.getEncoder().encodeToString(cipher.doFinal(master));
        } catch (GeneralSecurityException e) { throw new IllegalStateException(e); }
    }
    public byte[] decrypt(UUID user, String envelope, String encrypted) {
        requireKey();
        try {
            var parts = encrypted.split("\\.", 2);
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.getDecoder().decode(parts[0])));
            cipher.updateAAD(aad(user, envelope));
            byte[] master = cipher.doFinal(Base64.getDecoder().decode(parts[1]));
            if (master.length != 32) { Arrays.fill(master, (byte) 0); throw new GeneralSecurityException(); }
            return master;
        } catch (GeneralSecurityException | IllegalArgumentException | IndexOutOfBoundsException e) {
            throw ApiException.conflict("VAULT_KEY_UNAVAILABLE", "无法读取加密内容密钥，请联系主人检查服务器密钥；原有书籍未被改动。");
        }
    }
}
