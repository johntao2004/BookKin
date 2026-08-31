package io.github.johntao2004.bookkin.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.session.jdbc.config.annotation.web.http.EnableJdbcHttpSession;

@Configuration
@Profile("api")
@EnableJdbcHttpSession(maxInactiveIntervalInSeconds = 2_592_000, cleanupCron = "0 */15 * * * *")
public class SessionPersistenceConfig {
}
