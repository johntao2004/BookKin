import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { PermissionBoundary, defaultGrants, permissionCatalog, rolePermissionApi, routePermission, usePermissions } from "./permissions";
import { RolePermissionsPage } from "../pages/RolePermissionsPage";
import { AppShell } from "../components/AppShell";
import { articlesNavigationSections, libraryNavigationSections, notesNavigationSections } from "../components/app-navigation-sections";
import { permissionPageModel, rolePermissionGroups, rolePermissionPages } from "../pages/role-permission-groups";

const login = (role: "OWNER" | "ADMIN" | "MEMBER") => sessionStorage.setItem("silvae-demo-session", JSON.stringify({ id: role, username: role.toLowerCase(), displayName: role, role, mustChangePassword: false }));
beforeEach(() => sessionStorage.clear());
it("keeps owner authority fixed and member NAS/administration ceilings explicit", () => {
  expect(defaultGrants("OWNER")).toHaveLength(permissionCatalog.length);
  expect(defaultGrants("MEMBER")).toContain("reader.annotate");
  expect(defaultGrants("MEMBER")).not.toContain("library.files");
  expect(defaultGrants("ADMIN")).not.toContain("roles.manage");
  expect(defaultGrants("ADMIN")).not.toContain("settings.recycle.purge");
  expect(routePermission("/library/books/book-1/edit")).toBe("library.view");
  expect(routePermission("/library/uploads/upload-1")).toBe("library.view");
  expect(routePermission("/settings", "#users/roles")).toBe("roles.manage");
  expect(routePermission("/article-collections/collection-1")).toBe("articles.collections.details.view");
  expect(defaultGrants("MEMBER")).toContain("articles.collections.edit");
  expect(defaultGrants("MEMBER")).not.toContain("articles.edit");
});
it("does not mount private queries through a denied direct page route", () => {
  login("MEMBER"); const mounted = vi.fn();
  function PrivatePage() { mounted(); return <p>受限数据</p>; }
  render(<TestProviders initialPath="/settings#users/roles"><PermissionBoundary><PrivatePage /></PermissionBoundary></TestProviders>);
  expect(screen.getByRole("heading", {level: 1, name: "403"})).toBeInTheDocument(); expect(mounted).not.toHaveBeenCalled();
});
it("removes revoked page links and denies a bookmarked page", () => {
  login("MEMBER");
  sessionStorage.setItem("silvae-demo-role-permissions", JSON.stringify({ revision: 1, grants: { OWNER: defaultGrants("OWNER"), ADMIN: defaultGrants("ADMIN"), MEMBER: defaultGrants("MEMBER").filter(p => !["articles.view", "articles.read", "articles.collections.view", "articles.collections.details.view"].includes(p)) } }));
  render(<TestProviders initialPath="/articles"><AppShell><p>文章数据</p></AppShell></TestProviders>);
  expect(screen.queryByRole("link", { name: "文钞馆" })).not.toBeInTheDocument();
  expect(screen.queryByText("文章数据")).not.toBeInTheDocument(); expect(screen.getByRole("heading", {level: 1, name: "403"})).toBeInTheDocument();
});
it("keeps the articles navigation group available when only the collections page is granted", () => {
  login("MEMBER");
  sessionStorage.setItem("silvae-demo-role-permissions", JSON.stringify({ revision: 1, grants: {
    OWNER: defaultGrants("OWNER"), ADMIN: defaultGrants("ADMIN"),
    MEMBER: defaultGrants("MEMBER").filter(permission => permission !== "articles.view"),
  } }));
  render(<TestProviders initialPath="/article-collections"><AppShell><p>选集数据</p></AppShell></TestProviders>);
  expect(screen.getByText("选集数据")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "文钞馆" })).toHaveAttribute("href", "/article-collections");
});
it("allows a page while separately denying its write action", () => {
  login("ADMIN"); sessionStorage.setItem("silvae-demo-role-permissions", JSON.stringify({ revision: 1, grants: { OWNER: defaultGrants("OWNER"), ADMIN: defaultGrants("ADMIN").filter(p => p !== "knowledge.generate"), MEMBER: defaultGrants("MEMBER") } }));
  function Probe() { const { can } = usePermissions(); return <><p>{String(can("knowledge.view"))}</p>{can("knowledge.generate") && <button>分析书籍</button>}</>; }
  render(<TestProviders initialPath="/knowledge-graph"><PermissionBoundary><Probe /></PermissionBoundary></TestProviders>);
  expect(screen.getByText("true")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "分析书籍" })).not.toBeInTheDocument();
});
it("shows role ceilings and recursively updates dependent page/action grants in the editor", async () => {
  login("OWNER"); render(<TestProviders><RolePermissionsPage /></TestProviders>);
  const library = await screen.findByRole("checkbox", { name: "管理员 · 页面访问" });
  expect(screen.queryByRole("checkbox", { name: "主人 · 页面访问" })).not.toBeInTheDocument();
  expect(screen.queryByText(/先选择页面，再配置访问与操作权限/)).not.toBeInTheDocument();
  expect(screen.queryByText(/开启操作会同时开启必需的页面访问/)).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "成员 · 更新" })).toBeDisabled();
  fireEvent.click(library);
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择权限页面" }));
  fireEvent.change(screen.getByRole("combobox", { name: "选择权限页面" }), { target: { value: "学脉图" } });
  fireEvent.click(await screen.findByText("学脉图", { exact: true }));
  expect(screen.getByRole("checkbox", { name: "管理员 · 页面访问" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "管理员 · 生成知识图谱" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "管理员 · 生成知识图谱" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择权限页面" }));
  fireEvent.change(screen.getByRole("combobox", { name: "选择权限页面" }), { target: { value: "全部藏书" } });
  fireEvent.click(await screen.findByText("全部藏书", { exact: true }));
  expect(screen.getByRole("checkbox", { name: "管理员 · 页面访问" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "管理员 · 上传" })).not.toBeChecked();
  // Draft edits never save until the explicit confirmation action.
  expect((await rolePermissionApi.policy()).revision).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "保存权限" })).toBeDisabled());
});

it("uses distinct route leaves in one permission group and keeps draft actions while switching pages", async () => {
  login("OWNER"); render(<TestProviders><RolePermissionsPage /></TestProviders>);
  const select = await screen.findByRole("combobox", { name: "选择权限页面" });
  expect(await screen.findByRole("checkbox", { name: "管理员 · 页面访问" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "管理员 · 上传" }));
  fireEvent.mouseDown(select);
  fireEvent.click(await screen.findByText("楼中一览", { exact: true }));
  expect(screen.getByRole("checkbox", { name: "管理员 · 页面访问" })).toBeChecked();
  expect(screen.queryByRole("checkbox", { name: "管理员 · 上传" })).not.toBeInTheDocument();
  fireEvent.mouseDown(select);
  fireEvent.click(await screen.findByText("全部藏书", { exact: true }));
  expect(screen.getByRole("checkbox", { name: "管理员 · 上传" })).not.toBeChecked();
  expect(rolePermissionPages.find(page => page.route === "/library")?.value).not.toBe(rolePermissionPages.find(page => page.route === "/library/overview")?.value);
  expect((await rolePermissionApi.policy()).revision).toBe(0);
});

it("keeps every catalog group reachable once without mixing unrelated page rows", async () => {
  expect(new Set(rolePermissionPages.map(page => page.value)).size).toBe(rolePermissionPages.length);
  expect([...new Set(permissionCatalog.map(permission => permission.group))].every(group => rolePermissionPages.some(page => page.permissionGroup === group))).toBe(true);
  login("OWNER"); render(<TestProviders><RolePermissionsPage /></TestProviders>);
  await screen.findByRole("checkbox", { name: "管理员 · 页面访问" });
  expect(screen.queryByRole("checkbox", { name: "管理员 · 创建成员账户" })).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择权限页面" }));
  fireEvent.change(screen.getByRole("combobox", { name: "选择权限页面" }), { target: { value: "角色权限" } });
  fireEvent.click(await screen.findByText("角色权限", { exact: true }));
  expect(screen.getByRole("checkbox", { name: "管理员 · 管理角色权限" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "成员 · 管理角色权限" })).toBeDisabled();
});

it("mirrors AppShell route hierarchy and keeps repeated permission groups on unique route leaves", () => {
  const pages = new Map(rolePermissionPages.map(page => [page.route, page]));
  expect(pages.get("/library")).toMatchObject({ title: "全部藏书", permissionGroup: "藏书楼" });
  expect(pages.get("/library/overview")).toMatchObject({ title: "楼中一览", permissionGroup: "藏书楼" });
  expect(pages.get("/reader/:bookId")).toMatchObject({ title: "阅读器", permissionGroup: "阅读器" });
  expect(pages.get("/booklists")).toMatchObject({ title: "书目", permissionGroup: "书单" });
  expect(pages.get("/knowledge-graph")).toMatchObject({ title: "学脉图", permissionGroup: "学脉图" });
  expect(pages.get("/virtual-library")).toMatchObject({ title: "书楼漫游", permissionGroup: "书楼漫游" });
  expect(pages.get("/articles")).toMatchObject({ title: "全部文章", permissionGroup: "文章收藏" });
  expect(pages.get("/article-collections")).toMatchObject({ title: "选集", permissionGroup: "文章收藏" });
  expect(pages.get("/annotations/books")).toMatchObject({ title: "读书札记", permissionGroup: "阅读笔记" });
  expect(pages.get("/annotations/articles")).toMatchObject({ title: "阅文札记", permissionGroup: "阅读笔记" });
  expect(pages.get("/vault")).toMatchObject({ title: "秘阁", permissionGroup: "禁书库" });
  expect(routePermission("/library")).toBe("library.view");
  expect(routePermission("/library/books/book-1")).toBe("library.details.view");
  expect(routePermission("/search")).toBe("library.search.view");
  expect(routePermission("/reader/book-1")).toBe("reader.read");
  expect(routePermission("/booklists")).toBe("booklists.view");
  expect(routePermission("/booklists/list-1")).toBe("booklists.details.view");
  expect(routePermission("/knowledge-graph")).toBe("knowledge.view");
  expect(routePermission("/virtual-library")).toBe("virtual.view");
  expect(routePermission("/articles")).toBe("articles.view");
  expect(routePermission("/articles/article-1")).toBe("articles.read");
  expect(routePermission("/article-collections")).toBe("articles.collections.view");
  expect(routePermission("/annotations/books")).toBe("notes.books.view");
  expect(routePermission("/annotations/articles")).toBe("notes.articles.view");
  expect(routePermission("/annotations/posts/book/post-1")).toBe("notes.posts.view");
  expect(routePermission("/annotations")).toBe("notes.view");
  expect(routePermission("/settings", "#services/metadata")).toBe("settings.metadata.view");
  expect(routePermission("/vault")).toBe("vault.use");
  expect(rolePermissionGroups.map(group => group.title)).toEqual(["藏书楼", "搜索", "文钞馆", "读书录", "秘阁", "管理设置"]);
  expect(rolePermissionGroups[0].children?.map(child => child.title)).toEqual(["全部藏书", "楼中一览", "书籍详情", "书目", "学脉图", "书楼漫游"]);
  expect(rolePermissionGroups[0].children?.[2].children?.map(child => child.title)).toEqual(["阅读器"]);
  expect(rolePermissionGroups[0].children?.[3].children?.map(child => child.title)).toEqual(["书目详情"]);
  expect(rolePermissionGroups[0].children?.slice(1, 2).map(({ title, route }) => ({ title, route }))).toEqual([
    { title: libraryNavigationSections[0].label, route: libraryNavigationSections[0].path },
  ]);
  expect(rolePermissionGroups[0].children?.slice(3).map(({ title, route }) => ({ title, route }))).toEqual(
    libraryNavigationSections.slice(1).map(({ label: title, path: route }) => ({ title, route })),
  );
  expect(rolePermissionPages.some(page => ["/library/books/:bookId/edit", "/library/uploads/:uploadId", "/categories", "/categories/:categoryId", "/library/all"].includes(page.route ?? ""))).toBe(false);
  expect(rolePermissionGroups[2].children?.map(child => child.title)).toEqual(["全部文章", "选集"]);
  expect(rolePermissionGroups[2].children?.[0].children?.map(child => child.title)).toEqual(["文章阅读"]);
  expect(rolePermissionGroups[2].children?.[1].children?.map(child => child.title)).toEqual(["选集详情"]);
  expect(rolePermissionGroups[3]).toMatchObject({ title: "读书录", route: "/annotations" });
  expect(rolePermissionGroups[3].children?.map(child => child.title)).toEqual(["读书札记", "阅文札记", "随笔详情"]);
  expect(rolePermissionGroups[4]).toMatchObject({ title: "秘阁", route: "/vault" });
  expect(rolePermissionGroups[4].children).toBeUndefined();
  expect(rolePermissionGroups[2].children?.map(({ title, route }) => ({ title, route }))).toEqual([
    { title: articlesNavigationSections[0].label, route: articlesNavigationSections[0].path },
    { title: articlesNavigationSections[1].label, route: articlesNavigationSections[1].path },
  ]);
  expect(rolePermissionGroups[3].children?.slice(0, 2).map(({ title, route }) => ({ title, route }))).toEqual(
    notesNavigationSections.map(({ label: title, path: route }) => ({ title, route })),
  );
  expect(rolePermissionGroups.at(-1)?.children?.map(group => group.title)).toEqual(["馆藏与文件", "用户与权限", "登录与安全", "网站与阅读", "外部服务"]);
  const libraryOperations = permissionPageModel(rolePermissionPages.find(page => page.route === "/library")!).operations;
  expect(libraryOperations.map(operation => operation.label)).toEqual(["上传", "下载", "更新", "查询", "删除"]);
  expect(new Set(libraryOperations.flatMap(operation => operation.codes)).size).toBeGreaterThan(5);
});
