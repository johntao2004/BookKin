package io.github.johntao2004.bookkin.users;

import java.time.OffsetDateTime;
import java.util.UUID;

public record BookKinUser(
        UUID id,
        String username,
        String displayName,
        String passwordHash,
        UserRole role,
        UserStatus status,
        boolean mustChangePassword,
        OffsetDateTime createdAt,
        OffsetDateTime lastLoginAt) {

    public boolean canManageFiles() {
        return role == UserRole.OWNER || role == UserRole.ADMIN;
    }
}
