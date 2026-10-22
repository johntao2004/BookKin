// Settings navigation and permission-page categories share one functional hierarchy.
export const settingsGroups = [
  { key: "catalog", label: "馆藏与文件", sections: [
    { hash: "#catalog/library-roots", label: "书库目录", panel: "roots", permissionGroup: "书库目录", ownerOnly: false },
    { hash: "#catalog/operations", label: "文件任务", panel: "operations", permissionGroup: "文件任务", ownerOnly: false },
    { hash: "#catalog/recycle-bin", label: "回收站", panel: "recycle", permissionGroup: "回收站", ownerOnly: false },
  ] },
  { key: "users", label: "用户与权限", sections: [
    { hash: "#users", label: "用户列表", panel: "users", permissionGroup: "用户管理", ownerOnly: false },
    { hash: "#users/roles", label: "角色权限", panel: "roles", permissionGroup: "角色权限", ownerOnly: true },
  ] },
  { key: "security", label: "登录与安全", sections: [
    { hash: "#users/security", label: "安全策略", panel: "security", permissionGroup: "安全设置", ownerOnly: false },
    { hash: "#users/sessions", label: "在线会话", panel: "sessions", permissionGroup: "在线会话", ownerOnly: false },
    { hash: "#users/logins", label: "登录日志", panel: "logins", permissionGroup: "登录日志", ownerOnly: false },
  ] },
  { key: "website", label: "网站与阅读", sections: [
    { hash: "#services/personalization", label: "网站设置", panel: "site", permissionGroup: "网站设置", ownerOnly: true },
    { hash: "#services/reader-fonts", label: "阅读字体", panel: "fonts", permissionGroup: "阅读字体", ownerOnly: false },
  ] },
  { key: "services", label: "外部服务", sections: [
    { hash: "#services/ai", label: "AI 服务", panel: "ai", permissionGroup: "AI 服务", ownerOnly: false },
    { hash: "#services/mail", label: "邮件服务", panel: "mail", permissionGroup: "邮件服务", ownerOnly: true },
  ] },
] as const;

// Preserve bookmarked settings and old administration links after regrouping panels.
export function normalizeSettingsHash(hash: string): string {
  const aliases: Record<string, string> = {
    "#library-roots": "#catalog/library-roots",
    "#file-operations": "#catalog/operations",
    "#users/operations": "#catalog/operations",
    "#operations": "#catalog/operations",
    "#recycle-bin": "#catalog/recycle-bin",
    "#personalization": "#services/personalization",
    "#reader-fonts": "#services/reader-fonts",
    "#mail": "#services/mail",
    "#ai": "#services/ai",
    "#sessions": "#users/sessions",
    "#logins": "#users/logins",
    "#security": "#users/security",
    "#users/users": "#users",
  };
  return aliases[hash] ?? hash;
}
