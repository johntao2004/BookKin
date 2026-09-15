package io.github.johntao2004.bookkin.auth;

import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

import io.github.johntao2004.bookkin.users.UserRepository;
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
    @Import({SecurityConfig.class, RecoveryController.class, PasswordPolicyController.class})
    static class Config {
        @Bean PasswordPolicyService passwordPolicy() { return mock(PasswordPolicyService.class); }
        @Bean MailService mail() { return mock(MailService.class); }
        @Bean RecoveryService recovery() { return mock(RecoveryService.class); }
        @Bean LoginRateLimiter limiter() { return new LoginRateLimiter(); }
        @Bean UserRepository users() { return mock(UserRepository.class); }
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
    @Test void anonymousSessionIs401NotAnAuthorizationFailure() throws Exception {
        mvc.perform(get("/api/v1/auth/session")).andExpect(status().isUnauthorized())
            .andExpect(content().contentType("application/problem+json;charset=UTF-8"));
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
    @Test void csrfBootstrapRemainsPublic() throws Exception {
        mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk());
    }
    @Test void loginStillRequiresCsrfProtection() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
    }
}
