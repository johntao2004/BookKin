package com.elexvx.silvae.auth;

import com.elexvx.silvae.users.UserRepository;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InitializationRequiredFilterTest {
    @Test void blocksBusinessApiUntilOwnerExists() throws Exception {
        var users = mock(UserRepository.class);
        when(users.count()).thenReturn(0L);
        var filter = new InitializationRequiredFilter(users);
        var request = new MockHttpServletRequest("GET", "/api/v1/display-books");
        var response = new MockHttpServletResponse();
        var chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);
        assertEquals(503, response.getStatus());
        assertTrue(response.getContentAsString().contains("SETUP_REQUIRED"));
        verifyNoInteractions(chain);
    }

    @Test void allowsSetupBootstrapAndPassesThroughAfterInitialization() throws Exception {
        var users = mock(UserRepository.class);
        when(users.count()).thenReturn(1L);
        var filter = new InitializationRequiredFilter(users);
        for (String path : new String[] {"/api/v1/auth/setup", "/api/v1/auth/setup-status", "/api/v1/auth/csrf", "/api/v1/auth/password-policy"}) {
            var request = new MockHttpServletRequest("GET", path);
            var response = new MockHttpServletResponse();
            var chain = mock(FilterChain.class);
            filter.doFilter(request, response, chain);
            verify(chain).doFilter(request, response);
            assertEquals(200, response.getStatus());
        }
        var request = new MockHttpServletRequest("GET", "/api/v1/display-books");
        var response = new MockHttpServletResponse();
        var chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test void failsClosedWhenStatusCannotBeRead() throws Exception {
        var users = mock(UserRepository.class);
        when(users.count()).thenThrow(new IllegalStateException("database unavailable"));
        var filter = new InitializationRequiredFilter(users);
        var request = new MockHttpServletRequest("GET", "/api/v1/display-books");
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, mock(FilterChain.class));
        assertEquals(503, response.getStatus());
        assertTrue(response.getContentAsString().contains("SETUP_STATUS_UNAVAILABLE"));
    }
}
