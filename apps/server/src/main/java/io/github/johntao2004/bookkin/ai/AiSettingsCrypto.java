package io.github.johntao2004.bookkin.ai;

import io.github.johntao2004.bookkin.config.BookKinProperties;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
public class AiSettingsCrypto {
    private static final String PREFIX = "v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public AiSettingsCrypto(BookKinProperties properties) {
        String configured = properties.ai().settingsEncryptionKey();
        if (configured == null || configured.isBlank()) {
            key = null;
            return;
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(configured.getBytes(StandardCharsets.UTF_8));
            key = new SecretKeySpec(digest, "AES");
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("无法初始化 AI 设置加密器", exception);
        }
    }

    public String encrypt(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, requireKey(), new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(iv) + "."
                    + Base64.getUrlEncoder().withoutPadding().encodeToString(encrypted);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("无法保存 AI 平台密钥", exception);
        }
    }

    public String decrypt(String value) {
        if (value == null || value.isBlank()) return "";
        if (!value.startsWith(PREFIX)) throw new IllegalArgumentException("AI 平台密钥格式无效");
        try {
            String[] parts = value.substring(PREFIX.length()).split("\\.", 2);
            if (parts.length != 2) throw new IllegalArgumentException("AI 平台密钥格式无效");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, requireKey(), new GCMParameterSpec(TAG_BITS,
                    Base64.getUrlDecoder().decode(parts[0])));
            return new String(cipher.doFinal(Base64.getUrlDecoder().decode(parts[1])), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new IllegalArgumentException("无法解密 AI 平台密钥", exception);
        }
    }

    public boolean isConfigured() {
        return key != null;
    }

    private SecretKeySpec requireKey() {
        if (key == null) {
            throw new IllegalStateException("BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY 未配置；启用或保存 AI 设置前请先配置实例专属密钥");
        }
        return key;
    }
}
