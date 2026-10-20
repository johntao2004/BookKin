package com.elexvx.bookkin.auth;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
@Repository
// 注册开关的持久化与行锁入口，供配置修改和注册检查使用。
// Persists and locks the signup policy for configuration changes and registration checks.
public class RegistrationPolicyRepository {
 private final DSLContext dsl;
 public RegistrationPolicyRepository(DSLContext dsl) { this.dsl = dsl; }
 public boolean enabled() { return Boolean.TRUE.equals(dsl.fetchOne("select registration_enabled from security_settings where id=1").get(0, Boolean.class)); }
 public boolean lock() { return Boolean.TRUE.equals(dsl.fetchOne("select registration_enabled from security_settings where id=1 for update").get(0, Boolean.class)); }
 public void update(boolean enabled) { dsl.execute("update security_settings set registration_enabled=?, updated_at=now() where id=1",enabled); }
}
