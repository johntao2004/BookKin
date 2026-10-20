// 在配置数据库中验证撤销仅作用于已有会话及策略持久化，不能把后续登录一起撤销。
// Uses the configured database to verify revocation targets existing sessions and policy persists without revoking later logins.
package com.elexvx.bookkin.auth;
import com.elexvx.bookkin.users.*;
import com.elexvx.bookkin.audit.AuditService;
import java.sql.DriverManager;
import java.util.Optional;
import java.util.UUID;
import org.jooq.impl.DSL;
import org.jooq.SQLDialect;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.mock.web.MockHttpSession;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
@EnabledIfEnvironmentVariable(named="BOOKKIN_MAIL_TEST_DATABASE_URL",matches=".+")
class SessionLifecyclePersistenceTest {
 static class Rollback extends RuntimeException {}
 @Test void revocationTargetsOnlyExistingSessionsAndPolicyPersists() throws Exception {
  try(var connection=DriverManager.getConnection(System.getenv("BOOKKIN_MAIL_TEST_DATABASE_URL"),System.getenv().getOrDefault("BOOKKIN_DATABASE_USER","bookkin"),System.getenv().getOrDefault("BOOKKIN_DATABASE_PASSWORD","bookkin-local-dev"))) {
   var db=DSL.using(connection,SQLDialect.POSTGRES);
   assertThrows(Rollback.class,()->db.transaction(config->{
    var sql=DSL.using(config);var users=mock(UserRepository.class);var owner=mock(BookKinUser.class);var member=mock(BookKinUser.class);
    when(owner.role()).thenReturn(UserRole.OWNER);when(owner.id()).thenReturn(UUID.randomUUID());when(users.findByUsername("test-owner")).thenReturn(Optional.of(owner));
    when(member.role()).thenReturn(UserRole.MEMBER);when(member.id()).thenReturn(UUID.randomUUID());when(member.username()).thenReturn("session-test");when(member.displayName()).thenReturn("Session test");when(users.findByUsername("session-test")).thenReturn(Optional.of(member));
    var service=new SessionLifecycleService(sql,users,mock(AuditService.class));assertEquals(60,service.savePolicy("test-owner",60));assertEquals(60,service.maxMinutes());
    long now=System.currentTimeMillis();String oldId=UUID.randomUUID().toString(),newId=UUID.randomUUID().toString();
    sql.execute("insert into spring_session(primary_id,session_id,creation_time,last_access_time,max_inactive_interval,expiry_time,principal_name) values(?,?,?, ?,3600,?,?)",oldId,oldId,now,now,now+3600000,"session-test");
    service.requestRevocation("session-test");
    sql.execute("insert into spring_session(primary_id,session_id,creation_time,last_access_time,max_inactive_interval,expiry_time,principal_name) values(?,?,?, ?,3600,?,?)",newId,newId,now,now,now+3600000,"session-test");
    var old=new MockHttpSession(null,oldId);var fresh=new MockHttpSession(null,newId);
    assertTrue(service.status(old).revocationRequested());assertFalse(service.status(fresh).revocationRequested());
    assertTrue(service.status(old).expiresAt()<=now+31000);assertEquals(2,service.active(oldId).stream().filter(s->s.username().equals("session-test")).count());
    sql.execute("update session_revocation set revoke_at=? where session_primary_id=?",now-1,oldId);
    assertEquals(1,service.active(newId).stream().filter(s->s.username().equals("session-test")).count());
    throw new Rollback();
   }));
  }
 }
}
