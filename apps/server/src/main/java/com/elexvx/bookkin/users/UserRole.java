// 角色描述管理职责；主人或管理员身份不自动授予读取他人私人阅读数据的权限。
// Roles describe management duties, not automatic access to another user’s private reading data.
package com.elexvx.bookkin.users;

public enum UserRole {
    OWNER,
    ADMIN,
    MEMBER
}
