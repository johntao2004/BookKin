package io.github.johntao2004.bookkin.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.johntao2004.bookkin.users.UserRepository;
import org.junit.jupiter.api.Test;

class AuthControllerTest {
    @Test
    void ownerSetupOnlyTrustsLocalOrPrivateNetworks() {
        assertTrue(AuthController.isTrustedSetupAddress("127.0.0.1"));
        assertTrue(AuthController.isTrustedSetupAddress("192.168.1.20"));
        assertTrue(AuthController.isTrustedSetupAddress("10.0.0.8"));
        assertTrue(AuthController.isTrustedSetupAddress("172.16.4.2"));
        assertTrue(AuthController.isTrustedSetupAddress("::1"));
        assertTrue(AuthController.isTrustedSetupAddress("fd12:3456::1"));

        assertFalse(AuthController.isTrustedSetupAddress("8.8.8.8"));
        assertFalse(AuthController.isTrustedSetupAddress("1.1.1.1"));
        assertFalse(AuthController.isTrustedSetupAddress("not-an-address"));
    }

    @Test
    void setupStatusReflectsWhetherTheLibraryAlreadyHasUsers() {
        var users = mock(UserRepository.class);
        var controller = new AuthController(users, null, null, null, null, null);

        when(users.count()).thenReturn(0L);
        assertFalse(controller.setupStatus().initialized());

        when(users.count()).thenReturn(1L);
        assertTrue(controller.setupStatus().initialized());
    }
}
