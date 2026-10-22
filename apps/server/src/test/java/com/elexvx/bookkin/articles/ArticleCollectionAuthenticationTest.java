package com.elexvx.bookkin.articles;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.elexvx.bookkin.auth.MustChangePasswordFilter;
import com.elexvx.bookkin.auth.SecurityConfig;
import com.elexvx.bookkin.auth.SessionLifetimeFilter;
import com.elexvx.bookkin.auth.SessionLifecycleService;
import com.elexvx.bookkin.users.UserRepository;
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

@SpringJUnitWebConfig(ArticleCollectionAuthenticationTest.Config.class)
@ActiveProfiles("api")
class ArticleCollectionAuthenticationTest {
    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import({SecurityConfig.class, ArticleCollectionController.class})
    static class Config {
        @Bean SessionLifecycleService sessionLifecycle() {
            var service = mock(SessionLifecycleService.class);
            when(service.status(any())).thenReturn(new SessionLifecycleService.Status(Long.MAX_VALUE, false, System.currentTimeMillis()));
            return service;
        }
        @Bean SessionLifetimeFilter sessionLifetimeFilter(SessionLifecycleService service) { return new SessionLifetimeFilter(service); }
        @Bean UserRepository users() { return com.elexvx.bookkin.auth.PermissionTestFixtures.users(); }
        @Bean com.elexvx.bookkin.auth.RolePermissionService permissions() { return com.elexvx.bookkin.auth.PermissionTestFixtures.permissions(); }
        @Bean MustChangePasswordFilter passwordFilter(UserRepository users) { return new MustChangePasswordFilter(users); }
        @Bean ArticleCollectionService articleCollectionService() { return mock(ArticleCollectionService.class); }
    }

    @Autowired WebApplicationContext context;
    @Autowired ArticleCollectionService service;
    MockMvc mvc;

    @BeforeEach void setup() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(service.list(isNull(), any())).thenReturn(new ArticleCollectionService.ListResponse(java.util.List.of()));
    }

    @Test void anonymousCollectionRequestsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/v1/article-collections")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/article-collections/00000000-0000-4000-8000-000000000001")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/article-collections").contentType("application/json")
                .content("{\"title\":\"合集\",\"description\":\"\",\"visibility\":\"PRIVATE\"}"))
                .andExpect(status().isForbidden());
    }

    @Test void signedInMemberCanReadCollectionList() throws Exception {
        mvc.perform(get("/api/v1/article-collections").with(user("member").roles("MEMBER")))
                .andExpect(status().isOk());
    }
}
