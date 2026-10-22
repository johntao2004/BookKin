package com.elexvx.bookkin.reading;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import com.elexvx.bookkin.auth.*;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

@SpringJUnitWebConfig(ReadingOverviewAuthenticationTest.Config.class)
@ActiveProfiles("api")
class ReadingOverviewAuthenticationTest {
    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import({SecurityConfig.class, ReadingOverviewController.class})
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

        @Bean ReadingOverviewService overview() { return mock(ReadingOverviewService.class); }
    }

    @Autowired WebApplicationContext context;
    @Autowired ReadingOverviewService overview;
    @Autowired UserRepository users;

    @Test void anonymousRequestsCannotReadAnyOverviewData() throws Exception {
        reset(overview);
        var mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        mvc.perform(get("/api/v1/reading-overview")).andExpect(status().isUnauthorized());
        mvc.perform(head("/api/v1/reading-overview")).andExpect(status().isUnauthorized());
        verifyNoInteractions(overview);
    }

    @Test void everyRoleSeesOnlyItsOwnReadingEvenWhenAnotherUserIdIsSupplied() throws Exception {
        reset(overview);
        var mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        for (var role : List.of("MEMBER", "ADMIN", "OWNER")) {
            var id = UUID.randomUUID();
            var actor = mock(BookKinUser.class);
            when(actor.id()).thenReturn(id);
            when(actor.role()).thenReturn(com.elexvx.bookkin.users.UserRole.valueOf(role));
            when(actor.status()).thenReturn(com.elexvx.bookkin.users.UserStatus.ACTIVE);
            when(users.findByUsername(role)).thenReturn(Optional.of(actor));
            when(overview.current(id)).thenReturn(new ReadingOverviewService.Overview(null, null, List.of(), null));
            mvc.perform(get("/api/v1/reading-overview").param("userId", UUID.randomUUID().toString()).with(user(role).roles(role)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.recentReading").isEmpty());
            verify(overview).current(id);
        }
        verifyNoMoreInteractions(overview);
    }
}
