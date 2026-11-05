package com.elexvx.silvae.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.elexvx.silvae.auth.MustChangePasswordFilter;
import com.elexvx.silvae.auth.RolePermissionService;
import com.elexvx.silvae.auth.SecurityConfig;
import com.elexvx.silvae.auth.SessionLifetimeFilter;
import com.elexvx.silvae.auth.SessionLifecycleService;
import com.elexvx.silvae.users.SilvaeUser;
import com.elexvx.silvae.users.UserRepository;
import com.elexvx.silvae.users.UserRole;
import com.elexvx.silvae.users.UserStatus;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringJUnitWebConfig(StaticAssetCacheConfigurationTest.Config.class)
@ActiveProfiles("api")
class StaticAssetCacheConfigurationTest {
    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import({SecurityConfig.class, StaticAssetCacheConfiguration.class, TestStaticResourceFallback.class, Probe.class})
    static class Config {
        @Bean
        SessionLifecycleService sessionLifecycle() {
            var service = mock(SessionLifecycleService.class);
            when(service.status(org.mockito.ArgumentMatchers.any())).thenReturn(
                    new SessionLifecycleService.Status(Long.MAX_VALUE, false, System.currentTimeMillis()));
            return service;
        }

        @Bean
        SessionLifetimeFilter sessionLifetimeFilter(SessionLifecycleService service) {
            return new SessionLifetimeFilter(service);
        }

        @Bean
        UserRepository users() {
            var users = mock(UserRepository.class);
            when(users.count()).thenReturn(1L);
            when(users.findByUsername("member")).thenReturn(Optional.of(new SilvaeUser(
                    UUID.fromString("d15239ee-ecc9-4aa0-b6d2-e73f9fa6296f"), "member", "Member", "unused",
                    UserRole.MEMBER, UserStatus.ACTIVE, false, null, null)));
            return users;
        }

        @Bean
        RolePermissionService permissions() {
            var permissions = mock(RolePermissionService.class);
            when(permissions.snapshot(org.mockito.ArgumentMatchers.any())).thenReturn(
                    new RolePermissionService.Snapshot(UserRole.MEMBER, 0, Set.of()));
            return permissions;
        }

        @Bean
        MustChangePasswordFilter passwordFilter(UserRepository users) {
            return new MustChangePasswordFilter(users);
        }
    }

    /** Mirrors Spring Boot's ordinary static-resource mapping for the unversioned fallback. */
    @Configuration
    static class TestStaticResourceFallback implements WebMvcConfigurer {
        @Override
        public void addResourceHandlers(ResourceHandlerRegistry registry) {
            registry.addResourceHandler("/**").addResourceLocations("classpath:/static/");
        }
    }

    @RestController
    static class Probe {
        @GetMapping("/api/v1/auth/session")
        String privateSession() {
            return "private";
        }
    }

    @Autowired
    WebApplicationContext context;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void hashedViteBundlesArePublicAndCacheableForOneYear() throws Exception {
        var js = mvc.perform(get("/assets/cache-probe-0123abcd.js"))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        assertLongLivedPublicCache(js.getHeader("Cache-Control"));

        var css = mvc.perform(get("/assets/cache-probe-abcdef12.css"))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        assertLongLivedPublicCache(css.getHeader("Cache-Control"));
    }

    @Test
    void unversionedSceneHtmlAndJsonKeepTheSecurityNoStorePolicy() throws Exception {
        for (String path : new String[]{
                "/assets/ming-library/index.html",
                "/assets/hogwarts-library/library-manifest.json"}) {
            var response = mvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse();
            assertThat(response.getHeader("Cache-Control")).contains("no-store").doesNotContain("max-age=31536000");
        }
    }

    @Test
    void authenticatedPrivateApiResponseKeepsNoStore() throws Exception {
        var response = mvc.perform(get("/api/v1/auth/session").with(user("member").roles("MEMBER")))
                .andExpect(status().isOk()).andReturn().getResponse();
        assertThat(response.getHeader("Cache-Control")).contains("no-store").doesNotContain("max-age=31536000");
    }

    private static void assertLongLivedPublicCache(String cacheControl) {
        assertThat(cacheControl)
                .contains("public", "max-age=31536000", "immutable")
                .doesNotContain("no-store");
    }
}
