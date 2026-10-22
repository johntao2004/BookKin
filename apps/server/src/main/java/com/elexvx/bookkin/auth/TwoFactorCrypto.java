package com.elexvx.bookkin.auth;

import com.elexvx.bookkin.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Instance key stays outside the database; each encrypted secret is bound to its user. */
@Component
public class TwoFactorCrypto {
    private final SecretKeySpec key;
    public TwoFactorCrypto(@Value("${bookkin.two-factor-encryption-key:}") String configured) {
        try { key=configured==null || configured.isBlank()?null:new SecretKeySpec(MessageDigest.getInstance("SHA-256").digest(configured.getBytes(StandardCharsets.UTF_8)),"AES"); }
        catch(GeneralSecurityException e) { throw new IllegalStateException(e); }
    }
    public boolean configured() { return key!=null; }
    public String encrypt(UUID user, String secret) {
        if(key==null) throw ApiException.conflict("TWO_FACTOR_UNCONFIGURED","请先为服务器配置身份验证器加密密钥。");
        try {
            byte[] iv=new byte[12]; new SecureRandom().nextBytes(iv);
            var cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE,key,new GCMParameterSpec(128,iv));
            cipher.updateAAD(user.toString().getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(iv)+"."+Base64.getEncoder().encodeToString(cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8)));
        } catch(GeneralSecurityException e) { throw new IllegalStateException(e); }
    }
    public String decrypt(UUID user, String encrypted) {
        if(key==null) throw ApiException.conflict("TWO_FACTOR_UNCONFIGURED","身份验证器服务尚未配置。");
        try {
            var parts=encrypted.split("\\.",2); var cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,Base64.getDecoder().decode(parts[0])));
            cipher.updateAAD(user.toString().getBytes(StandardCharsets.UTF_8));
            return new String(cipher.doFinal(Base64.getDecoder().decode(parts[1])),StandardCharsets.UTF_8);
        } catch(GeneralSecurityException | IllegalArgumentException | IndexOutOfBoundsException e) {
            throw ApiException.conflict("TWO_FACTOR_KEY_UNAVAILABLE","无法读取身份验证器设置，请检查服务器加密密钥。");
        }
    }
}
