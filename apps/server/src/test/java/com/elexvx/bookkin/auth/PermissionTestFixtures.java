package com.elexvx.bookkin.auth;
import com.elexvx.bookkin.users.*;
import com.elexvx.bookkin.audit.AuditService;
import java.util.*;
import java.security.Principal;
import static org.mockito.Mockito.*;
/** Existing controller slices use current-role fixtures; RBAC persistence/revocation has separate real-DB tests. */
public final class PermissionTestFixtures {
    private PermissionTestFixtures() {}
    public static UserRepository users() {
        var users = mock(UserRepository.class);
        when(users.findByUsername(org.mockito.ArgumentMatchers.anyString())).thenAnswer(invocation -> {
            String name = invocation.getArgument(0);
            UserRole role;
            try { role = UserRole.valueOf(name.toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { role = UserRole.MEMBER; }
            return Optional.of(new BookKinUser(UUID.nameUUIDFromBytes(name.getBytes(java.nio.charset.StandardCharsets.UTF_8)), name, name, "unused", role, UserStatus.ACTIVE, false, null, null));
        });
        return users;
    }
    public static RolePermissionService permissions() {
        var catalog = new RolePermissionService(mock(org.jooq.DSLContext.class), mock(UserRepository.class), mock(AuditService.class));
        var service = mock(RolePermissionService.class);
        when(service.snapshot(org.mockito.ArgumentMatchers.any(Principal.class))).thenAnswer(invocation -> {
            Principal principal = invocation.getArgument(0); UserRole role;
            try { role = UserRole.valueOf(principal.getName().toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { role = UserRole.MEMBER; }
            return new RolePermissionService.Snapshot(role, 0, catalog.defaults(role));
        });
        return service;
    }
}
