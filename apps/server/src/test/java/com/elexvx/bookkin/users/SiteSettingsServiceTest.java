// 覆盖来源 URL 校验、主人权限与默认禁止索引，拒绝在配置校验中触发跳转或抓取。
// Covers origin validation, owner rights and default indexing denial without turning validation into redirects or fetching.
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
    private SiteSettingsService.Settings settings(String url) {return new SiteSettingsService.Settings("  我的书库  "," 简介 ","说明","关键词",url,false,true,"","","","");}
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
    @Test void preservesLegacyAvailabilityAndExplicitDisabledSetting() {
        var v=settings("");
        var legacy=new SiteSettingsService.Settings(v.name(),v.tagline(),v.description(),v.keywords(),v.publicUrl(),false,null,"","","","");
        assertThat(SiteSettingsService.normalize(legacy).virtualLibraryEnabled()).isTrue();
        var disabled=new SiteSettingsService.Settings(v.name(),v.tagline(),v.description(),v.keywords(),v.publicUrl(),false,false,"","","","");
        assertThat(SiteSettingsService.normalize(disabled).virtualLibraryEnabled()).isFalse();
    }
    @Test void robotsDeniesAllByDefaultAndNeverAdvertisesPrivateRoutes() {
        var service=spy(new SiteSettingsService(mock(DSLContext.class),mock(ObjectMapper.class),mock(UserRepository.class),mock(AuditService.class)));
        doReturn(settings("")).when(service).current();
        assertThat(service.robots()).isEqualTo("User-agent: *\nDisallow: /\n");
        var v=settings("");doReturn(new SiteSettingsService.Settings(v.name(),v.tagline(),v.description(),v.keywords(),v.publicUrl(),true,true,"","","","")).when(service).current();
        assertThat(service.robots()).contains("Allow: /","Disallow: /api/","Disallow: /vault");
    }
}
