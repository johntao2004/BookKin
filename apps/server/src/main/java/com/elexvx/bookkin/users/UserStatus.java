// 账户状态与角色分开保存，禁用不能靠保留高权限角色绕过认证限制。
// Account status is separate from role; a privileged role does not bypass disabled-account authentication checks.
package com.elexvx.bookkin.users;

public enum UserStatus {
    ACTIVE,
    DISABLED
}
