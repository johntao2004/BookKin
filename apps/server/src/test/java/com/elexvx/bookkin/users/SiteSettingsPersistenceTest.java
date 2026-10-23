package com.elexvx.bookkin.users;

import com.elexvx.bookkin.audit.AuditService;
import java.sql.DriverManager;
import java.util.Optional;
import java.util.UUID;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 临时表验证开关持久化；Verify persistence with connection-local temporary tables. */
@EnabledIfEnvironmentVariable(named="BOOKKIN_SITE_SETTINGS_TEST_DATABASE_URL", matches=".+")
class SiteSettingsPersistenceTest {
    @Test void legacySettingsDefaultsAndOwnerTogglesPersistAcrossServiceInstances() throws Exception {
        try (var connection=DriverManager.getConnection(System.getenv("BOOKKIN_SITE_SETTINGS_TEST_DATABASE_URL"),
                System.getenv().getOrDefault("BOOKKIN_DATABASE_USER","agent"),
                System.getenv().getOrDefault("BOOKKIN_DATABASE_PASSWORD",""))) {
            var db=DSL.using(connection,SQLDialect.POSTGRES);
            db.execute("create temporary table site_settings (id integer primary key, settings jsonb not null, updated_at timestamptz default now())");
            var json=new ObjectMapper();
            var enabled=new SiteSettingsService.Settings("BookKin","电子图书馆","说明","","",false,true,"","","","");
            db.execute("insert into site_settings(id,settings) values (1,?::jsonb - 'virtualLibraryEnabled')",json.writeValueAsString(enabled));
            var users=mock(UserRepository.class);
            var owner=mock(BookKinUser.class);
            when(owner.role()).thenReturn(UserRole.OWNER);
            when(owner.id()).thenReturn(UUID.randomUUID());
            when(users.findByUsername("owner")).thenReturn(Optional.of(owner));
            var audit=mock(AuditService.class);
            var service=new SiteSettingsService(db,json,users,audit);
            assertThat(service.current().virtualLibraryEnabled()).isTrue();
            var disabled=new SiteSettingsService.Settings("BookKin","电子图书馆","说明","","",false,false,"","","","");
            assertThat(service.save("owner",disabled).virtualLibraryEnabled()).isFalse();
            assertThat(new SiteSettingsService(db,json,users,audit).current().virtualLibraryEnabled()).isFalse();
            assertThat(service.save("owner",enabled).virtualLibraryEnabled()).isTrue();
        }
    }
}
