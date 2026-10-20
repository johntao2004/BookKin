package com.elexvx.bookkin.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.session.jdbc.config.annotation.web.http.EnableJdbcHttpSession;

// JDBC 保存跨重启会话；此处是空闲超时，绝对有效期另由 SessionLifecycleService 计算。
// JDBC persists sessions across restarts; this is the idle timeout, while SessionLifecycleService computes absolute lifetime.
@Configuration
@Profile("api")
@EnableJdbcHttpSession(maxInactiveIntervalInSeconds = 2_592_000, cleanupCron = "0 */15 * * * *")
public class SessionPersistenceConfig {
}
