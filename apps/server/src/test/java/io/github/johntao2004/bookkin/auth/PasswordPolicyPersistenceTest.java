package io.github.johntao2004.bookkin.auth;
import io.github.johntao2004.bookkin.users.*;
import io.github.johntao2004.bookkin.audit.AuditService;
import java.sql.DriverManager;
import java.util.Optional;
import java.util.UUID;
import org.jooq.impl.DSL;
import org.jooq.SQLDialect;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
@EnabledIfEnvironmentVariable(named="BOOKKIN_MAIL_TEST_DATABASE_URL", matches=".+")
class PasswordPolicyPersistenceTest {
 static class Rollback extends RuntimeException {}
 @Test void persistsRulesAndValidatesReloadedPolicyWithoutChangingLiveConfiguration() throws Exception {
  try(var connection=DriverManager.getConnection(System.getenv("BOOKKIN_MAIL_TEST_DATABASE_URL"),System.getenv().getOrDefault("BOOKKIN_DATABASE_USER","bookkin"),System.getenv().getOrDefault("BOOKKIN_DATABASE_PASSWORD","bookkin-local-dev"))) {
   var db=DSL.using(connection,SQLDialect.POSTGRES);
   assertThrows(Rollback.class,()->db.transaction(config->{
    var users=mock(UserRepository.class);var actor=mock(BookKinUser.class);
    when(actor.role()).thenReturn(UserRole.OWNER);when(actor.id()).thenReturn(UUID.randomUUID());when(users.findByUsername("owner")).thenReturn(Optional.of(actor));
    var service=new PasswordPolicyService(DSL.using(config),users,mock(AuditService.class));
    var strict=new PasswordPolicyService.Policy(16,true,true,true,true);
    assertEquals(strict,service.save("owner",strict));
    assertEquals(strict,service.policy());
    assertThrows(RuntimeException.class,()->service.validate("abcdefghijklmnop"));
    assertDoesNotThrow(()->service.validate("Strong-password1!"));
    throw new Rollback();
   }));
  }
 }
}
