import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { PermissionBoundary, defaultGrants, permissionCatalog, rolePermissionApi, routePermission, usePermissions } from "./permissions";
import { RolePermissionsPage } from "../pages/RolePermissionsPage";
import { AppShell } from "../components/AppShell";
import { rolePermissionPages } from "../pages/role-permission-groups";

const login = (role: "OWNER" | "ADMIN" | "MEMBER") => sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: role, username: role.toLowerCase(), displayName: role, role, mustChangePassword: false }));
beforeEach(() => sessionStorage.clear());
it("keeps owner authority fixed and member NAS/administration ceilings explicit", () => {
  expect(defaultGrants("OWNER")).toHaveLength(permissionCatalog.length);
  expect(defaultGrants("MEMBER")).toContain("reader.annotate");
  expect(defaultGrants("MEMBER")).not.toContain("library.files");
  expect(defaultGrants("ADMIN")).not.toContain("roles.manage");
  expect(defaultGrants("ADMIN")).not.toContain("settings.recycle.purge");
  expect(routePermission("/library/books/book-1/edit")).toBe("library.edit");
  expect(routePermission("/settings", "#users/roles")).toBe("roles.manage");
  expect(routePermission("/article-collections/collection-1")).toBe("articles.view");
  expect(defaultGrants("MEMBER")).toContain("articles.collections.edit");
  expect(defaultGrants("MEMBER")).not.toContain("articles.edit");
});
it("does not mount private queries through a denied direct page route", () => {
  login("MEMBER"); const mounted = vi.fn();
  function PrivatePage() { mounted(); return <p>受限数据</p>; }
  render(<TestProviders initialPath="/settings#users/roles"><PermissionBoundary><PrivatePage /></PermissionBoundary></TestProviders>);
  expect(screen.getByText("403 · 权限受限")).toBeInTheDocument(); expect(mounted).not.toHaveBeenCalled();
});
it("removes revoked page links and denies a bookmarked page", () => {
  login("MEMBER");
  sessionStorage.setItem("bookkin-demo-role-permissions", JSON.stringify({ revision: 1, grants: { OWNER: defaultGrants("OWNER"), ADMIN: defaultGrants("ADMIN"), MEMBER: defaultGrants("MEMBER").filter(p => p !== "articles.view") } }));
  render(<TestProviders initialPath="/articles"><AppShell><p>文章数据</p></AppShell></TestProviders>);
  expect(screen.queryByRole("link", { name: "文钞馆" })).not.toBeInTheDocument();
  expect(screen.queryByText("文章数据")).not.toBeInTheDocument(); expect(screen.getByText("403 · 权限受限")).toBeInTheDocument();
});
it("allows a page while separately denying its write action", () => {
  login("ADMIN"); sessionStorage.setItem("bookkin-demo-role-permissions", JSON.stringify({ revision: 1, grants: { OWNER: defaultGrants("OWNER"), ADMIN: defaultGrants("ADMIN").filter(p => p !== "knowledge.generate"), MEMBER: defaultGrants("MEMBER") } }));
  function Probe() { const { can } = usePermissions(); return <><p>{String(can("knowledge.view"))}</p>{can("knowledge.generate") && <button>分析书籍</button>}</>; }
  render(<TestProviders initialPath="/knowledge-graph"><PermissionBoundary><Probe /></PermissionBoundary></TestProviders>);
  expect(screen.getByText("true")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "分析书籍" })).not.toBeInTheDocument();
});
it("shows role ceilings and recursively updates dependent page/action grants in the editor", async () => {
  login("OWNER"); render(<TestProviders><RolePermissionsPage /></TestProviders>);
  const library = await screen.findByRole("checkbox", { name: "管理员 · 全部藏书与书籍详情" });
  expect(screen.queryByRole("checkbox", { name: "主人 · 全部藏书与书籍详情" })).not.toBeInTheDocument();
  expect(screen.queryByText(/先选择页面，再配置访问与操作权限/)).not.toBeInTheDocument();
  expect(screen.queryByText(/开启操作会同时开启必需的页面访问/)).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "成员 · 重命名与写回文件" })).toBeDisabled();
  fireEvent.click(library);
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择权限页面" }));
  fireEvent.click(await screen.findByText("学脉图", { exact: true }));
  expect(screen.getByRole("checkbox", { name: "管理员 · 查看书籍学脉图" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "管理员 · 分析书籍正文" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "管理员 · 分析书籍正文" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择权限页面" }));
  fireEvent.click(await screen.findByText("藏书楼", { exact: true }));
  expect(screen.getByRole("checkbox", { name: "管理员 · 全部藏书与书籍详情" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "管理员 · 上传书籍" })).not.toBeChecked();
  // Draft edits never save until the explicit confirmation action.
  expect((await rolePermissionApi.policy()).revision).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "保存权限" })).toBeDisabled());
});

it("keeps every catalog group reachable once without mixing unrelated page rows", async () => {
  expect(new Set(rolePermissionPages.map(page => page.value)).size).toBe(rolePermissionPages.length);
  expect([...new Set(permissionCatalog.map(permission => permission.group))].sort()).toEqual(rolePermissionPages.map(page => page.value).sort());
  login("OWNER"); render(<TestProviders><RolePermissionsPage /></TestProviders>);
  await screen.findByRole("checkbox", { name: "管理员 · 全部藏书与书籍详情" });
  expect(screen.queryByRole("checkbox", { name: "管理员 · 创建成员账户" })).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择权限页面" }));
  fireEvent.change(screen.getByRole("combobox", { name: "选择权限页面" }), { target: { value: "角色权限" } });
  fireEvent.click(await screen.findByText("角色权限", { exact: true }));
  expect(screen.getByRole("checkbox", { name: "管理员 · 配置角色权限与调整用户角色" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "成员 · 配置角色权限与调整用户角色" })).toBeDisabled();
});
