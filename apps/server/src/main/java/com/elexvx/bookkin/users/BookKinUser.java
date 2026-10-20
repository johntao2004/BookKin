package com.elexvx.bookkin.users;

import java.time.OffsetDateTime;
import java.util.UUID;

// 账户领域快照统一提供文件管理能力判断；它不包含其他用户的私有阅读授权。
// Account snapshot centralizes file-management capability checks, not access to other users’ private reading data.
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
