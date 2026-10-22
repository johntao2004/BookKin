package com.elexvx.bookkin.articles;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.elexvx.bookkin.auth.MustChangePasswordFilter;
import com.elexvx.bookkin.auth.SecurityConfig;
import com.elexvx.bookkin.auth.SessionLifetimeFilter;
import com.elexvx.bookkin.auth.SessionLifecycleService;
import java.security.Principal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;

@SpringJUnitWebConfig(ArticlePrepareAuthorizationTest.Config.class)
@ActiveProfiles("api")
class ArticlePrepareAuthorizationTest {
    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import({SecurityConfig.class, ArticleController.class})
    static class Config {
        @Bean SessionLifecycleService sessionLifecycle() {
            var service = mock(SessionLifecycleService.class);
            when(service.status(any())).thenReturn(new SessionLifecycleService.Status(
                    Long.MAX_VALUE, false, System.currentTimeMillis()));
            return service;
        }

        @Bean SessionLifetimeFilter sessionLifetimeFilter(SessionLifecycleService service) {
            return new SessionLifetimeFilter(service);
        }

        @Bean com.elexvx.bookkin.users.UserRepository users() {
            return com.elexvx.bookkin.auth.PermissionTestFixtures.users();
        }

        @Bean com.elexvx.bookkin.auth.RolePermissionService permissions() { return com.elexvx.bookkin.auth.PermissionTestFixtures.permissions(); }

        @Bean MustChangePasswordFilter passwordFilter(com.elexvx.bookkin.users.UserRepository users) {
            return new MustChangePasswordFilter(users);
        }

        @Bean ArticleService articleService() { return mock(ArticleService.class); }
    }

    @Autowired WebApplicationContext context;
    @Autowired ArticleService service;
    private MockMvc mvc;

    @BeforeEach void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(service.prepare(anyString(), anyString(), any(Principal.class))).thenReturn("<p>已处理</p>");
    }

    @Test void anonymousRequestReturns401AndMemberRequestReturns403() throws Exception {
        String body = "{\"html\":\"<p>正文</p>\",\"sourceUrl\":\"https://example.test/article\"}";
        mvc.perform(post("/api/v1/articles/prepare").with(csrf()).contentType("application/json").content(body))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/articles/prepare").with(user("member").roles("MEMBER")).with(csrf())
                        .contentType("application/json").content(body))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test void ownerAndAdminCanPrepareAndEmptySourceUrlIsAccepted() throws Exception {
        String body = "{\"html\":\"<p>正文</p>\",\"sourceUrl\":\"\"}";
        for (String role : new String[] {"OWNER", "ADMIN"}) {
            mvc.perform(post("/api/v1/articles/prepare").with(user(role.toLowerCase()).roles(role)).with(csrf())
                            .contentType("application/json").content(body))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.html").value("<p>已处理</p>"));
        }
        verify(service, times(2)).prepare(anyString(), anyString(), any(Principal.class));
    }

    @Test void validatesRequiredHtmlAndSourceUrlLimit() throws Exception {
        mvc.perform(post("/api/v1/articles/prepare").with(user("owner").roles("OWNER")).with(csrf())
                        .contentType("application/json").content("{\"sourceUrl\":\"\"}"))
                .andExpect(status().isBadRequest());

        String tooLongSource = "x".repeat(4097);
        String body = "{\"html\":\"<p>正文</p>\",\"sourceUrl\":\"" + tooLongSource + "\"}";
        mvc.perform(post("/api/v1/articles/prepare").with(user("owner").roles("OWNER")).with(csrf())
                        .contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
