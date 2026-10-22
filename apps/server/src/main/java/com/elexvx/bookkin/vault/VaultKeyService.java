package com.elexvx.bookkin.vault;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;

/** Called only behind VaultAccessConfiguration's fresh, user/session-bound 2FA gate. */
@Service
public class VaultKeyService {
    private static final String ENVELOPE = "{\"version\":3,\"kind\":\"two-factor\"}";
    private final DSLContext db;
    private final UserRepository users;
    private final VaultKeyCipher cipher;
    public VaultKeyService(DSLContext db, UserRepository users, VaultKeyCipher cipher) { this.db=db; this.users=users; this.cipher=cipher; }
    public record Access(String key, String envelope, long revision) {
        @Override public String toString() { return "VaultKeyAccess[redacted]"; }
    }
    private UUID owner(Principal principal) {
        if (principal == null) throw ApiException.forbidden("AUTH_REQUIRED", "请先登录。");
        return users.findByUsername(principal.getName()).orElseThrow().id();
    }
    public Access open(Principal principal) {
        UUID owner = owner(principal);
        return db.transactionResult(configuration -> {
            var tx = DSL.using(configuration);
            tx.execute("insert into personal_vault(user_id,envelope) values (?,?::jsonb) on conflict do nothing", owner, ENVELOPE);
            var row = tx.fetchOne("select envelope::text,revision,access_key_ciphertext from personal_vault where user_id=? for update", owner);
            String envelope = row.get("envelope", String.class), encrypted = row.get("access_key_ciphertext", String.class);
            byte[] master = null;
            try {
                if (encrypted == null) {
                    if (tx.fetchExists(DSL.selectOne().from("vault_objects").where("user_id=?", owner)))
                        throw ApiException.conflict("VAULT_LEGACY_KEY_REQUIRED", "旧版密文需要从原先可阅读的浏览器迁移密钥，现有书籍未被改动。");
                    master = new byte[32]; new SecureRandom().nextBytes(master);
                    // Empty legacy vaults can be upgraded without replacing any content key in use.
                    tx.execute("update personal_vault set envelope=?::jsonb,revision=revision+1 where user_id=?", ENVELOPE, owner);
                    row = tx.fetchOne("select envelope::text,revision from personal_vault where user_id=?", owner);
                    envelope = row.get("envelope", String.class);
                    tx.execute("update personal_vault set access_key_ciphertext=? where user_id=?", cipher.encrypt(owner, envelope, master), owner);
                } else master = cipher.decrypt(owner, envelope, encrypted);
                return new Access(Base64.getEncoder().encodeToString(master), envelope, row.get("revision", Long.class));
            } finally { if (master != null) Arrays.fill(master, (byte) 0); }
        });
    }
    public Access migrate(String encoded, long revision, Principal principal) {
        if (encoded == null || encoded.length() > 64) throw ApiException.badRequest("VAULT_KEY_INVALID", "内容密钥格式无效。");
        byte[] master;
        try { master = Base64.getDecoder().decode(encoded == null ? "" : encoded); }
        catch (IllegalArgumentException e) { throw ApiException.badRequest("VAULT_KEY_INVALID", "内容密钥格式无效。"); }
        if (master.length != 32) { Arrays.fill(master, (byte) 0); throw ApiException.badRequest("VAULT_KEY_INVALID", "内容密钥格式无效。"); }
        try {
            UUID owner = owner(principal);
            return db.transactionResult(configuration -> {
                var tx = DSL.using(configuration);
                var row = tx.fetchOne("select envelope::text,revision,access_key_ciphertext from personal_vault where user_id=? for update", owner);
                if (row == null) throw ApiException.conflict("REVISION_CONFLICT", "书库设置已更新，请重试。");
                String envelope = row.get("envelope", String.class), encrypted = row.get("access_key_ciphertext", String.class);
                if (encrypted != null) {
                    byte[] existing = cipher.decrypt(owner, envelope, encrypted);
                    try { if (!MessageDigest.isEqual(existing, master)) throw ApiException.conflict("REVISION_CONFLICT", "书库密钥已迁移，请重试。"); }
                    finally { Arrays.fill(existing, (byte) 0); }
                } else {
                    if (row.get("revision", Long.class) != revision) throw ApiException.conflict("REVISION_CONFLICT", "书库设置已更新，请重试。");
                    var sample = tx.fetchOne("select id,manifest from vault_objects where user_id=? limit 1", owner);
                    if (sample != null) verifyManifest(master, sample.get("id", UUID.class), sample.get("manifest", String.class));
                    tx.execute("update personal_vault set access_key_ciphertext=?,revision=revision+1 where user_id=?", cipher.encrypt(owner, envelope, master), owner);
                    row = tx.fetchOne("select revision from personal_vault where user_id=?", owner);
                }
                return new Access(encoded, envelope, row.get("revision", Long.class));
            });
        } finally { Arrays.fill(master, (byte) 0); }
    }
    private void verifyManifest(byte[] master, UUID id, String manifest) {
        try {
            byte[] data = Base64.getDecoder().decode(manifest);
            if (data.length < 28) throw new GeneralSecurityException();
            var aes = Cipher.getInstance("AES/GCM/NoPadding");
            aes.init(Cipher.DECRYPT_MODE, new SecretKeySpec(master, "AES"), new GCMParameterSpec(128, Arrays.copyOf(data, 12)));
            aes.updateAAD(("manifest:" + id).getBytes(StandardCharsets.UTF_8));
            byte[] plain = aes.doFinal(data, 12, data.length - 12); Arrays.fill(plain, (byte) 0);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw ApiException.conflict("VAULT_KEY_INVALID", "原书库密钥无法验证，现有书籍未被改动。");
        }
    }
}
