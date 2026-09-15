package io.github.johntao2004.bookkin.auth;

import io.github.johntao2004.bookkin.ai.AiSettingsCrypto;
import java.sql.DriverManager;
import org.jooq.impl.DSL;
import org.jooq.SQLDialect;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Explicit local integration check. All configuration changes are rolled back. */
@EnabledIfEnvironmentVariable(named="BOOKKIN_MAIL_TEST_DATABASE_URL", matches=".+")
class MailSettingsPersistenceTest {
    static class Rollback extends RuntimeException {}
    @Test void savesReadsAndPreservesEncryptedPasswordWithoutReturningIt() throws Exception {
        try (var connection=DriverManager.getConnection(System.getenv("BOOKKIN_MAIL_TEST_DATABASE_URL"),
                System.getenv().getOrDefault("BOOKKIN_DATABASE_USER","bookkin"),
                System.getenv().getOrDefault("BOOKKIN_DATABASE_PASSWORD","bookkin-local-dev"))) {
            var db=DSL.using(connection,SQLDialect.POSTGRES);
            assertThrows(Rollback.class,()->db.transaction(config->{
                var transactional=DSL.using(config);
                var crypto=mock(AiSettingsCrypto.class);
                when(crypto.isConfigured()).thenReturn(true);
                when(crypto.encrypt("test-only-password")).thenReturn("encrypted-test-secret");
                var service=new MailService(transactional,crypto);
                var input=new MailService.Settings(true,"smtp.example.com",587,"STARTTLS","library",
                    "test-only-password","library@example.com","https://books.example.com",false);
                var result=service.save(input);
                assertEquals("smtp.example.com",result.host());
                assertTrue(result.passwordConfigured()); assertEquals("",result.password());
                service.save(new MailService.Settings(true,result.host(),465,"TLS",result.username(),"",result.sender(),result.publicUrl(),true));
                assertEquals(465,service.settings().port());
                assertEquals("encrypted-test-secret",transactional.fetchOne("select password_ciphertext from mail_settings where id=1").get(0,String.class));
                verify(crypto,times(1)).encrypt("test-only-password");
                throw new Rollback();
            }));
        }
    }
}
