package com.elexvx.silvae.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.elexvx.silvae.users.SilvaeUser;
import com.elexvx.silvae.users.UserRepository;
import com.elexvx.silvae.users.UserRole;
import com.elexvx.silvae.users.UserStatus;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class RolePermissionFilterPageScopeTest {
    @AfterEach void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test void uploadGrantCannotReadAiSettingsProvidersWhenAiPageAccessIsRevoked() throws Exception {
        var users = mock(UserRepository.class);
        when(users.findByUsername(anyString())).thenReturn(Optional.of(new SilvaeUser(
            UUID.randomUUID(), "admin", "Admin", "unused", UserRole.ADMIN, UserStatus.ACTIVE, false, null, null)));
        var permissions = mock(RolePermissionService.class);
        when(permissions.snapshot(any())).thenReturn(new RolePermissionService.Snapshot(UserRole.ADMIN, 4, Set.of("library.upload")));
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
            "admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));

        var request = new MockHttpServletRequest("GET", "/api/v1/ai/providers");
        var response = new MockHttpServletResponse();
        var continued = new AtomicBoolean(false);
        new RolePermissionFilter(users, permissions).doFilter(request, response, (req, res) -> continued.set(true));

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(continued).isFalse();
    }
}
