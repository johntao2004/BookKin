import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import catalog from "../../../server/src/main/resources/role-permissions.json";
import { api, request } from "../api/client";
import { useAuth } from "./AuthContext";
import type { UserRole } from "../domain/types";
import { AccessDeniedPage } from "../pages/AccessDeniedPage";
import { Button } from "../ui/buttons";
import { CircularProgress } from "../ui/feedback";
import { HttpErrorPage, pageFailure, type PageFailure } from "../pages/HttpErrorPage";

export interface PermissionDefinition { code: string; group: string; label: string; kind: string; roles: UserRole[]; requires: string[] }
export const permissionCatalog = catalog as PermissionDefinition[];
export interface RolePolicy { revision: number; grants: Record<UserRole, string[]> }
interface PermissionSnapshot { role: UserRole; revision: number; grants: string[] }
export const defaultGrants = (role: UserRole) => permissionCatalog.filter(p => p.roles.includes(role)).map(p => p.code);
const demoKey = "bookkin-demo-role-permissions";
export function demoRolePolicy(): RolePolicy {
  try { const stored = sessionStorage.getItem(demoKey); if (stored) return JSON.parse(stored); } catch { /* A blocked store retains built-in defaults. */ }
  return { revision: 0, grants: { OWNER: defaultGrants("OWNER"), ADMIN: defaultGrants("ADMIN"), MEMBER: defaultGrants("MEMBER") } };
}
export const rolePermissionApi = {
  policy: () => api.isDemo ? Promise.resolve(demoRolePolicy()) : request<RolePolicy>("/role-permissions"),
  save: async (policy: RolePolicy) => {
    const grants = { ADMIN: policy.grants.ADMIN, MEMBER: policy.grants.MEMBER };
    if (!api.isDemo) return request<RolePolicy>("/role-permissions", { method: "PUT", body: JSON.stringify({ revision: policy.revision, grants }) });
    if (demoRolePolicy().revision !== policy.revision) throw new Error("权限配置已更新，请重新加载后再保存。");
    const result = { revision: policy.revision + 1, grants: { ...grants, OWNER: defaultGrants("OWNER") } };
    sessionStorage.setItem(demoKey, JSON.stringify(result)); return result;
  },
};
export const settingsPermissions: Record<string, string> = {
  "#catalog/library-roots": "settings.roots.view", "#catalog/operations": "settings.operations.view", "#catalog/recycle-bin": "settings.recycle.view",
  "#users": "settings.users.view", "#users/roles": "roles.manage", "#users/sessions": "settings.sessions.view", "#users/logins": "settings.logs.view", "#users/security": "settings.security.view",
  "#services/personalization": "settings.site.view", "#services/reader-fonts": "settings.fonts.view", "#services/mail": "settings.mail.view", "#services/ai": "settings.ai.view",
};
export function routePermission(path: string, hash = ""): string | undefined {
  if (path === "/settings") return settingsPermissions[hash];
  if (path === "/admin/users") return "settings.users.view";
  if (path === "/admin/library-roots") return "settings.roots.view";
  if (path === "/admin/file-operations") return "settings.operations.view";
  if (path.includes("recycle-bin")) return "settings.recycle.view";
  if (path === "/admin/reader-fonts") return "settings.fonts.view";
  if (path === "/library/overview") return "library.overview";
  if (path.startsWith("/library/uploads/")) return "library.upload";
  if (/^\/library\/books\/[^/]+\/edit$/.test(path)) return "library.edit";
  if (path.startsWith("/library") || path.startsWith("/categories") || path === "/search") return "library.view";
  if (path.startsWith("/reader/")) return "reader.read";
  if (path.startsWith("/articles") || path.startsWith("/article-collections")) return "articles.view";
  if (path.startsWith("/annotations")) return "notes.view";
  if (path.startsWith("/booklists")) return "booklists.view";
  if (path === "/knowledge-graph") return "knowledge.view";
  if (path === "/virtual-library") return "virtual.view";
  if (path === "/vault") return "vault.use";
  return undefined;
}
export function usePermissions() {
  const { user, ready: authReady } = useAuth();
  const query = useQuery({ queryKey: ["role-permissions-current", user?.id], enabled: Boolean(user) && !api.isDemo,
    queryFn: () => request<PermissionSnapshot>("/auth/permissions"), staleTime: 10_000, retry: false });
  const demo = api.isDemo ? demoRolePolicy() : undefined;
  const grants = user ? (api.isDemo ? (user.role === "OWNER" ? defaultGrants("OWNER") : demo?.grants[user.role] ?? []) : query.isError ? [] : query.data?.grants ?? []) : [];
  const can = (code: string) => Boolean(user && grants.includes(code));
  const canVisit = (path: string, hash = "") => {
    const permission = routePermission(path, hash);
    if (!user) return ["/library", "/search", "/categories", "/booklists", "/reader"].some(p => path === p || path.startsWith(`${p}/`));
    if (path === "/settings" && !hash) return Object.values(settingsPermissions).some(can);
    return !permission || can(permission);
  };
  return { can, canVisit, grants, role: query.data?.role ?? user?.role, ready: authReady && (!user || api.isDemo || query.isSuccess), error: query.isError,
    requestError: query.error, fetching: query.isFetching, retry: query.refetch };
}
export function PermissionGate({ permission, children }: PropsWithChildren<{ permission: string }>) {
  return usePermissions().can(permission) ? children : null;
}
/** Guard before children mount: hiding navigation alone cannot protect queries or a bookmarked route. */
export function PermissionBoundary({ children }: PropsWithChildren) {
  const access = usePermissions(); const location = useLocation(); const client = useQueryClient();
  const [lastFailure, setLastFailure] = useState<PageFailure | null>(null);
  const failure = access.error ? pageFailure(access.requestError) : !access.ready ? lastFailure : null;
  useEffect(() => {
    if (access.error) setLastFailure(pageFailure(access.requestError));
    else if (access.ready) setLastFailure(null);
  }, [access.error, access.requestError, access.ready]);
  const recovering = failure !== null;
  useEffect(() => {
    if (api.isDemo) return;
    const timer = window.setInterval(() => { void client.invalidateQueries({ queryKey: ["role-permissions-current"] }); }, recovering ? 5_000 : 10_000);
    return () => window.clearInterval(timer);
  }, [client, recovering]);
  const previous = useRef<string | undefined>(undefined);
  const signature = [...access.grants].sort().join("|");
  useEffect(() => {
    if (!access.ready) return;
    if (previous.current !== undefined && previous.current !== signature) {
      void client.cancelQueries({ predicate: query => query.queryKey[0] !== "role-permissions-current" });
      client.removeQueries({ predicate: query => query.queryKey[0] !== "role-permissions-current" });
    }
    previous.current = signature;
  }, [access.ready, client, signature]);
  if (failure !== null) return <HttpErrorPage failure={failure} title="无法确认功能权限。"
    recovery="每 5 秒自动重试，服务恢复后会自动打开页面。"
    actions={<Button disabled={access.fetching} onClick={() => void access.retry()}>{access.fetching ? "正在重试…" : "重试"}</Button>} />;
  if (!access.ready) return <CircularProgress />;
  if (!access.canVisit(location.pathname, location.hash)) return <AccessDeniedPage reason="INSUFFICIENT_ROLE" returnTo={`${location.pathname}${location.search}${location.hash}`} />;
  return children;
}
