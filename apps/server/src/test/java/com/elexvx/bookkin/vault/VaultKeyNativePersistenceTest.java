package com.elexvx.bookkin.vault;

import static org.assertj.core.api.Assertions.*;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.flywaydb.core.Flyway;
import org.jooq.impl.DSL;
import org.jooq.SQLDialect;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@EnabledIfEnvironmentVariable(named="BOOKKIN_NATIVE_TEST_URL", matches=".+")
class VaultKeyNativePersistenceTest {
    @Test void emptyUpgradeCrossBrowserReadsAndLegacyMigrationPreserveRealCiphertext() throws Exception {
        String url=System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user=System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER",System.getProperty("user.name"));
        String password=System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD","");
        String schema="bookkin_vault_keys_"+UUID.randomUUID().toString().replace("-","");
        try(var admin=DriverManager.getConnection(url,user,password);var statement=admin.createStatement()) {
            statement.execute("create schema "+schema);
            try {
                Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").load().migrate();
                try(var connection=DriverManager.getConnection(url,user,password)) {
                    connection.createStatement().execute("set search_path to "+schema+",public");
                    var db=DSL.using(connection,SQLDialect.POSTGRES);
                    UUID alice=UUID.randomUUID(),bob=UUID.randomUUID();
                    db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,'alice','Alice','test-only','MEMBER'),(?,'bob','Bob','test-only','MEMBER')",alice,bob);
                    db.execute("insert into personal_vault(user_id,envelope) values (?,'{\"version\":1,\"passwordBox\":\"legacy\"}')",alice);
                    var cipher=new VaultKeyCipher("test-only-instance-key");
                    var keys=new VaultKeyService(db,new UserRepository(db),cipher);
                    var opened=keys.open(()->"alice");
                    assertThat(opened.envelope()).contains("two-factor");
                    assertThat(keys.open(()->"alice")).isEqualTo(opened);
                    assertThat(new VaultKeyService(db,new UserRepository(db),new VaultKeyCipher("test-only-instance-key")).open(()->"alice")).isEqualTo(opened);
                    String stored=db.fetchOne("select access_key_ciphertext from personal_vault where user_id=?",alice).get(0,String.class);
                    assertThat(stored).doesNotContain(opened.key());
                    assertThat(new VaultKeyCipher("test-only-instance-key").decrypt(alice,opened.envelope(),stored)).isEqualTo(Base64.getDecoder().decode(opened.key()));
                    assertThatThrownBy(()->cipher.decrypt(bob,opened.envelope(),stored)).isInstanceOf(ApiException.class);
                    assertThat(keys.open(()->"bob").key()).isNotEqualTo(opened.key());

                    // A nonempty legacy vault must keep its actual key; no replacement or content deletion.
                    db.execute("update personal_vault set envelope='{\"version\":1}',access_key_ciphertext=null,revision=7 where user_id=?",bob);
                    byte[] oldMaster=new byte[32];new Random(53).nextBytes(oldMaster);
                    UUID object=UUID.randomUUID();String manifest=manifest(oldMaster,object);
                    db.execute("insert into vault_objects(id,user_id,manifest,state) values (?,?,?,'encrypted-reading-state')",object,bob,manifest);
                    assertThatThrownBy(()->keys.open(()->"bob")).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.code()).isEqualTo("VAULT_LEGACY_KEY_REQUIRED"));
                    assertThatThrownBy(()->keys.migrate(Base64.getEncoder().encodeToString(new byte[32]),7,()->"bob")).isInstanceOf(ApiException.class);
                    assertThatThrownBy(()->keys.migrate(Base64.getEncoder().encodeToString(oldMaster),6,()->"bob")).isInstanceOf(ApiException.class);
                    assertThat(db.fetchOne("select access_key_ciphertext from personal_vault where user_id=?",bob).get(0)).isNull();
                    var migrated=keys.migrate(Base64.getEncoder().encodeToString(oldMaster),7,()->"bob");
                    assertThat(keys.migrate(Base64.getEncoder().encodeToString(oldMaster),7,()->"bob")).isEqualTo(migrated);
                    assertThat(keys.open(()->"bob").key()).isEqualTo(Base64.getEncoder().encodeToString(oldMaster));
                    var content=db.fetchOne("select manifest,state from vault_objects where id=? and user_id=?",object,bob);
                    assertThat(content.get("manifest")).isEqualTo(manifest);
                    assertThat(content.get("state")).isEqualTo("encrypted-reading-state");
                    assertThatThrownBy(()->new VaultService(db,new UserRepository(db),null).config("{}",migrated.revision(),()->"bob")).isInstanceOf(ApiException.class);
                }
            } finally { statement.execute("drop schema "+schema+" cascade"); }
        }
    }
    private static String manifest(byte[] master,UUID id) throws Exception {
        byte[] iv=new byte[12];new Random(4).nextBytes(iv);
        var cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(master,"AES"),new GCMParameterSpec(128,iv));
        cipher.updateAAD(("manifest:"+id).getBytes(StandardCharsets.UTF_8));
        byte[] encrypted=cipher.doFinal("{\"title\":\"Existing encrypted book\"}".getBytes(StandardCharsets.UTF_8));
        byte[] all=Arrays.copyOf(iv,iv.length+encrypted.length);System.arraycopy(encrypted,0,all,iv.length,encrypted.length);
        return Base64.getEncoder().encodeToString(all);
    }
}
