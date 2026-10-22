package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.auth.MustChangePasswordFilter;
import com.elexvx.bookkin.auth.SecurityConfig;
import com.elexvx.bookkin.auth.SessionLifetimeFilter;
import com.elexvx.bookkin.auth.SessionLifecycleService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import com.elexvx.bookkin.users.UserRepository;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

@SpringJUnitWebConfig(ArticleAuthenticationTest.Config.class)
@ActiveProfiles("api")
class ArticleAuthenticationTest {
    private static final UUID ARTICLE_ID = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private static final UUID ASSET_ID = UUID.fromString("00000000-0000-4000-8000-000000000002");

    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import({SecurityConfig.class, ArticleController.class, PageShellProbe.class})
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

        @Bean UserRepository users() { return com.elexvx.bookkin.auth.PermissionTestFixtures.users(); }

        @Bean com.elexvx.bookkin.auth.RolePermissionService permissions() { return com.elexvx.bookkin.auth.PermissionTestFixtures.permissions(); }

        @Bean MustChangePasswordFilter passwordFilter(UserRepository users) {
            return new MustChangePasswordFilter(users);
        }

        @Bean ArticleService articleService() { return mock(ArticleService.class); }
    }

    @RestController
    static class PageShellProbe {
        @GetMapping("/articles") String articlesPage() { return "articles-shell"; }
    }

    @Autowired WebApplicationContext context;
    @Autowired ArticleService service;
    MockMvc mvc;

    @BeforeEach void setup() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(service.list(any(Principal.class))).thenReturn(List.of());
        when(service.get(any(UUID.class), any(Principal.class))).thenReturn(Map.of("id", ARTICLE_ID));
        when(service.image(any(UUID.class), any(Principal.class)))
                .thenReturn(new ByteArrayResource(new byte[] {1, 2, 3}));
        when(service.knowledge(any(Principal.class))).thenReturn(List.of());
        when(service.reading(any(UUID.class), any(Principal.class))).thenReturn(Map.of("state", "{}", "revision", 0));
    }

    @Test void anonymousGetAndHeadCannotReadAnyArticleResource() throws Exception {
        for (HttpMethod method : List.of(HttpMethod.GET, HttpMethod.HEAD)) {
            for (String path : List.of(
                    "/api/v1/articles",
                    "/api/v1/articles/" + ARTICLE_ID,
                    "/api/v1/articles/assets/" + ASSET_ID,
                    "/api/v1/articles/knowledge",
                    "/api/v1/articles/" + ARTICLE_ID + "/reading")) {
                mvc.perform(request(method, path)).andExpect(status().isUnauthorized());
            }
        }
        verifyNoInteractions(service);
    }

    @Test void memberAdminAndOwnerCanReadArticleEndpoints() throws Exception {
        for (String role : List.of("MEMBER", "ADMIN", "OWNER")) {
            var identity = user(role.toLowerCase()).roles(role);
            mvc.perform(get("/api/v1/articles").with(identity)).andExpect(status().isOk());
            mvc.perform(get("/api/v1/articles/" + ARTICLE_ID).with(identity)).andExpect(status().isOk());
            mvc.perform(get("/api/v1/articles/assets/" + ASSET_ID).with(identity)).andExpect(status().isOk());
            mvc.perform(get("/api/v1/articles/knowledge").with(identity)).andExpect(status().isOk());
            mvc.perform(get("/api/v1/articles/" + ARTICLE_ID + "/reading").with(identity)).andExpect(status().isOk());
        }
    }

    @Test void articlePageShellRemainsPublic() throws Exception {
        mvc.perform(get("/articles")).andExpect(status().isOk());
    }

    @Test void serviceReadMethodsRejectNullPrincipalBeforeDatabaseOrFiles() throws Exception {
        var database = mock(DSLContext.class);
        var users = mock(UserRepository.class);
        var files = mock(PrivateContentStore.class);
        var guarded = new ArticleService(database, users, null, files, (AiMetadataService) null, null);

        assertAuthRequired(() -> guarded.list(null));
        assertAuthRequired(() -> guarded.get(ARTICLE_ID, null));
        assertAuthRequired(() -> guarded.image(ASSET_ID, null));
        assertAuthRequired(() -> guarded.knowledge(null));

        verifyNoInteractions(database, users, files);
    }

    private static void assertAuthRequired(org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.code()).isEqualTo("AUTH_REQUIRED"));
    }
}
