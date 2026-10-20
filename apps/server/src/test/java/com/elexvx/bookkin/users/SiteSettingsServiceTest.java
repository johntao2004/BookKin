package com.elexvx.bookkin.users;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.common.ApiException;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.Optional;
import tools.jackson.databind.ObjectMapper;

class SiteSettingsServiceTest {
    private SiteSettingsService.Settings settings(String url) {return new SiteSettingsService.Settings("  我的书库  "," 简介 ","说明","关键词",url,false,"","","","");}
    @Test void normalizesOriginWithoutRedirectingOrFetchingIt() {
        var value=SiteSettingsService.normalize(settings("https://books.example.com/"));
        assertThat(value.name()).isEqualTo("我的书库");
        assertThat(value.publicUrl()).isEqualTo("https://books.example.com");
        assertThat(SiteSettingsService.normalize(settings("")).publicUrl()).isEmpty();
    }
    @Test void rejectsNonWebOriginsCredentialsAndInjectedUrls() {
        for(var url:new String[]{"javascript:alert(1)","https://user:secret@example.com","https://example.com/path","https://example.com/?q=1","https://example.com/#x","//example.com"}) {
            assertThatThrownBy(()->SiteSettingsService.normalize(settings(url))).isInstanceOf(ApiException.class);
        }
    }
    @Test void deniesAdministratorWritesBeforeAnyDatabaseMutation() {
        var users=mock(UserRepository.class);var actor=mock(BookKinUser.class);var db=mock(DSLContext.class);
        when(actor.role()).thenReturn(UserRole.ADMIN);when(users.findByUsername("admin")).thenReturn(Optional.of(actor));
        var service=new SiteSettingsService(db,mock(ObjectMapper.class),users,mock(AuditService.class));
        assertThatThrownBy(()->service.save("admin",settings(""))).isInstanceOf(ApiException.class);
        verifyNoInteractions(db);
    }
    @Test void robotsDeniesAllByDefaultAndNeverAdvertisesPrivateRoutes() {
        var service=spy(new SiteSettingsService(mock(DSLContext.class),mock(ObjectMapper.class),mock(UserRepository.class),mock(AuditService.class)));
        doReturn(settings("")).when(service).current();
        assertThat(service.robots()).isEqualTo("User-agent: *\nDisallow: /\n");
        var v=settings("");doReturn(new SiteSettingsService.Settings(v.name(),v.tagline(),v.description(),v.keywords(),v.publicUrl(),true,"","","","")).when(service).current();
        assertThat(service.robots()).contains("Allow: /","Disallow: /api/","Disallow: /vault");
    }
}
