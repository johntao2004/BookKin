package com.elexvx.bookkin.config;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// 建表和升级由版本化 Flyway 脚本执行；不在业务启动代码中改写已发布迁移。
// Versioned Flyway scripts own schema creation/upgrades; startup code must not rewrite released migrations.
@Configuration
@ConditionalOnProperty(prefix = "spring.flyway", name = "enabled", matchIfMissing = true)
public class DatabaseMigrationConfig {
    @Bean(initMethod = "migrate")
    Flyway flyway(DataSource dataSource) {
        return Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load();
    }
}
