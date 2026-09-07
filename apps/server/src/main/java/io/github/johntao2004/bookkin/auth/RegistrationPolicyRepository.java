package io.github.johntao2004.bookkin.auth;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
@Repository
public class RegistrationPolicyRepository {
 private final DSLContext dsl;
 public RegistrationPolicyRepository(DSLContext dsl) { this.dsl = dsl; }
 public boolean enabled() { return Boolean.TRUE.equals(dsl.fetchOne("select registration_enabled from security_settings where id=1").get(0, Boolean.class)); }
 public boolean lock() { return Boolean.TRUE.equals(dsl.fetchOne("select registration_enabled from security_settings where id=1 for update").get(0, Boolean.class)); }
 public void update(boolean enabled) { dsl.execute("update security_settings set registration_enabled=?, updated_at=now() where id=1",enabled); }
}
