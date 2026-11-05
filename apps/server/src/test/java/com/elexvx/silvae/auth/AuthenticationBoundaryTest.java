// 通过请求级测试区分匿名、角色不足与 CSRF 失败，保护公开恢复入口和主人专属设置的边界。
// Uses request-level tests to distinguish anonymous access, insufficient roles and CSRF failures across recovery and owner-only settings.
package com.elexvx.silvae.auth;

import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

import com.elexvx.silvae.users.UserRepository;
import com.elexvx.silvae.filemanagement.FileTaskHistoryController;
import com.elexvx.silvae.filemanagement.FileTaskHistoryService;
import com.elexvx.silvae.filemanagement.FileTaskHistoryModels;
import com.elexvx.silvae.common.ApiExceptionHandler;
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
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringJUnitWebConfig(AuthenticationBoundaryTest.Config.class)
@ActiveProfiles("api")
class AuthenticationBoundaryTest {
    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import({SecurityConfig.class, RecoveryController.class, PasswordPolicyController.class, SessionLifecycleController.class,
        FileTaskHistoryController.class, ApiExceptionHandler.class})
    static class Config {
        @Bean SessionLifecycleService sessionLifecycle() {
            var service=mock(SessionLifecycleService.class);
            org.mockito.Mockito.when(service.status(org.mockito.ArgumentMatchers.any())).thenReturn(new SessionLifecycleService.Status(Long.MAX_VALUE,false,System.currentTimeMillis()));
            return service;
        }
        @Bean SessionLifetimeFilter sessionLifetimeFilter(SessionLifecycleService service) {return new SessionLifetimeFilter(service);}
        @Bean PasswordPolicyService passwordPolicy() { return mock(PasswordPolicyService.class); }
        @Bean MailService mail() { return mock(MailService.class); }
        @Bean RecoveryService recovery() { return mock(RecoveryService.class); }
        @Bean FileTaskHistoryService fileTaskHistory() {
            var history = mock(FileTaskHistoryService.class);
            org.mockito.Mockito.when(history.page(org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt()))
                .thenReturn(new FileTaskHistoryModels.Page(java.util.List.of(), 0));
            return history;
        }
        @Bean LoginRateLimiter limiter() { return new LoginRateLimiter(); }
        @Bean UserRepository users() {
            var users = mock(UserRepository.class);
            org.mockito.Mockito.when(users.count()).thenReturn(1L);
            org.mockito.Mockito.when(users.findByUsername(org.mockito.ArgumentMatchers.anyString())).thenAnswer(invocation -> {
                String name = invocation.getArgument(0);
                var role = switch (name) { case "owner" -> com.elexvx.silvae.users.UserRole.OWNER; case "admin" -> com.elexvx.silvae.users.UserRole.ADMIN; default -> com.elexvx.silvae.users.UserRole.MEMBER; };
                return java.util.Optional.of(new com.elexvx.silvae.users.SilvaeUser(java.util.UUID.randomUUID(), name, name, "unused", role, com.elexvx.silvae.users.UserStatus.ACTIVE, false, null, null));
            });
            return users;
        }
        @Bean RolePermissionService permissions() {
            var service = mock(RolePermissionService.class);
            org.mockito.Mockito.when(service.snapshot(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> {
                java.security.Principal principal = invocation.getArgument(0);
                var role = switch (principal.getName()) { case "owner" -> com.elexvx.silvae.users.UserRole.OWNER; case "admin" -> com.elexvx.silvae.users.UserRole.ADMIN; default -> com.elexvx.silvae.users.UserRole.MEMBER; };
                return new RolePermissionService.Snapshot(role, 0, role == com.elexvx.silvae.users.UserRole.OWNER ? java.util.Set.of("settings.mail.view", "settings.mail.edit", "settings.security.edit", "settings.security.view", "settings.sessions.view", "settings.operations.view") : role == com.elexvx.silvae.users.UserRole.ADMIN ? java.util.Set.of("settings.security.view", "settings.sessions.view", "settings.operations.view") : java.util.Set.of());
            });
            return service;
        }
        @Bean MustChangePasswordFilter passwordFilter(UserRepository users) { return new MustChangePasswordFilter(users); }
        @Bean Probe probe() { return new Probe(); }
    }
    @RestController
    static class Probe {
        @GetMapping("/api/v1/auth/session") String session() { return "private"; }
        @GetMapping("/api/v1/auth/csrf") String csrf() { return "public"; }
    }
    @Autowired WebApplicationContext context;
    MockMvc mvc;
    @BeforeEach void setup() { mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build(); }
    @Test void contentPolicyAllowsLocallyGeneratedArticleEpubWithoutRemoteConnections() throws Exception {
        String policy = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk())
            .andReturn().getResponse().getHeader("Content-Security-Policy");
        org.assertj.core.api.Assertions.assertThat(policy).isNotNull();
        org.assertj.core.api.Assertions.assertThat(policy.split(";"))
            .anySatisfy(directive -> org.assertj.core.api.Assertions.assertThat(directive.trim()).isEqualTo("connect-src 'self' blob:"));
        org.assertj.core.api.Assertions.assertThat(policy).contains("script-src 'self' 'wasm-unsafe-eval'", "object-src 'none'");
    }
    @Test void anonymousSessionIs401NotAnAuthorizationFailure() throws Exception {
        mvc.perform(get("/api/v1/auth/session")).andExpect(status().isUnauthorized())
            .andExpect(content().contentType("application/problem+json;charset=UTF-8"));
    }
    // 随包字体与 /assets 一样是公开静态资源：登录页也要用，且不应因 401 产生控制台错误；私有 API 仍需登录。
    // Bundled fonts are public static assets like /assets (the login page needs them); private APIs still require authentication.
    @Test void bundledFontFilesAreNotBehindAuthentication() throws Exception {
        mvc.perform(get("/fonts/source-han-sans-sc-regular.woff2")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/auth/session")).andExpect(status().isUnauthorized());
    }
    @Test void smtpSettingsAreOwnerOnly() throws Exception {
        mvc.perform(get("/api/v1/mail/settings")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/mail/settings").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("member").roles("MEMBER"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/mail/settings").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/mail/settings").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("owner").roles("OWNER"))).andExpect(status().isOk());
    }
    @Test void resetRequestIsPublicButRequiresCsrf() throws Exception {
        mvc.perform(post("/api/v1/auth/recovery/request").contentType("application/json").content("{\"email\":\"qa@example.com\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/recovery/request").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content("{\"email\":\"qa@example.com\"}"))
            .andExpect(status().isOk());
    }
    @Test void passwordPolicyIsPublicButChangesAreOwnerOnly() throws Exception {
        mvc.perform(get("/api/v1/auth/password-policy")).andExpect(status().isOk());
        String json="{\"minLength\":16,\"requireUppercase\":true,\"requireLowercase\":true,\"requireDigit\":true,\"requireSpecial\":true}";
        for(String role:new String[]{"MEMBER","ADMIN"}) mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/users/password-policy")
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("test").roles(role))
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content(json)).andExpect(status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/users/password-policy")
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("owner").roles("OWNER"))
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content(json)).andExpect(status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/users/password-policy")
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("owner").roles("OWNER"))
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content(json.replace(":16",":6"))).andExpect(status().isBadRequest());
    }
    @Test void activeSessionsAreManagementOnlyAndSessionPolicyIsOwnerOnly() throws Exception {
        mvc.perform(get("/api/v1/users/active-sessions")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/users/active-sessions").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("member").roles("MEMBER"))).andExpect(status().isForbidden());
        for(String role:new String[]{"OWNER","ADMIN"}) mvc.perform(get("/api/v1/users/active-sessions").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(role.toLowerCase(java.util.Locale.ROOT)).roles(role))).andExpect(status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/users/session-policy").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content("{\"maxMinutes\":60}")).andExpect(status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/users/session-policy").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("owner").roles("OWNER")).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content("{\"maxMinutes\":1}")).andExpect(status().isBadRequest());
    }

    @Test void unifiedFileTaskHistoryUsesExistingAuthenticationRoleAndGrantBoundary() throws Exception {
        mvc.perform(get("/api/v1/file-task-history")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/file-task-history").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("member").roles("MEMBER")))
            .andExpect(status().isForbidden());
        for (String role : new String[]{"OWNER", "ADMIN"}) {
            mvc.perform(get("/api/v1/file-task-history").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(role.toLowerCase(java.util.Locale.ROOT)).roles(role)))
                .andExpect(status().isOk());
        }
        mvc.perform(get("/api/v1/file-task-history?page=bad").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/file-task-history?page=0&pageSize=101").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("owner").roles("OWNER")))
            .andExpect(status().isBadRequest());
    }
    @Test void csrfBootstrapRemainsPublic() throws Exception {
        mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk());
    }
    @Test void loginStillRequiresCsrfProtection() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
    }
}
