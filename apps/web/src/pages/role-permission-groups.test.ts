import { describe, expect, it } from "vitest";
import { permissionCatalog, routePermission } from "../auth/permissions";
import { settingsGroups } from "./settings-navigation";
import { permissionPageModel, rolePermissionGroups, rolePermissionPages } from "./role-permission-groups";

describe("role permission page aggregation", () => {
  it("maps every existing action grant to a page feature without exposing fine subfeatures", () => {
    const mapped = new Set(rolePermissionPages.flatMap(page => permissionPageModel(page).operations.flatMap(operation => operation.codes)));
    expect(permissionCatalog.filter(permission => permission.kind !== "page" && !mapped.has(permission.code)).map(permission => permission.code)).toEqual([]);
    expect(rolePermissionPages.some(page => permissionPageModel(page).operations.some(operation => /封面|重命名|分类/.test(operation.label)))).toBe(false);
  });

  it("gives the library separate page, upload, download, update, delete and query controls", () => {
    const library = rolePermissionPages.find(page => page.route === "/library");
    expect(library).toBeDefined();
    const model = permissionPageModel(library!);
    expect(model.accessCodes).toEqual(["library.view"]);
    expect(model.operations).toEqual([
      { label: "上传", codes: ["library.upload"] },
      { label: "下载", codes: ["library.download"] },
      { label: "更新", codes: ["library.edit", "library.organize", "library.files"] },
      { label: "查询", codes: ["library.query"] },
      { label: "删除", codes: ["library.trash"] },
    ]);
  });

  it("keeps the file download capability separate from reader access", () => {
    const library = rolePermissionPages.find(page => page.route === "/library");
    const model = permissionPageModel(library!);
    expect(model.operations.find(operation => operation.label === "下载")?.codes).toEqual(["library.download"]);
    expect(model.operations.find(operation => operation.label === "下载")?.codes).not.toContain("reader.read");
  });

  it("maps search result controls to the scopes that actually gate each source", () => {
    const search = permissionPageModel(rolePermissionPages.find(page => page.route === "/search")!);
    expect(search.accessCodes).toEqual(["library.search.view"]);
    expect(search.operations).toEqual([
      { label: "查询书籍", codes: ["library.query"] },
      { label: "查询笔记（同时控制读书录访问）", codes: ["notes.view"] },
      { label: "查询书目（同时控制书目页面访问）", codes: ["booklists.view"] },
    ]);
  });

  it("keeps every settings permission page aligned with the live settings navigation", () => {
    const root = rolePermissionGroups.find(group => group.title === "管理设置");
    expect(root?.children?.map(group => group.title)).toEqual(settingsGroups.map(group => group.label));
    const values: string[] = [];
    settingsGroups.forEach((group, groupIndex) => {
      const treeGroup = root?.children?.[groupIndex];
      expect(treeGroup?.children?.map(page => page.title)).toEqual(group.sections.map(section => section.label));
      group.sections.forEach((section, sectionIndex) => {
        const page = treeGroup?.children?.[sectionIndex];
        expect(page?.route).toBe(`/settings${section.hash}`);
        expect(page?.permissionGroup).toBe(section.permissionGroup);
        const code = routePermission("/settings", section.hash);
        if (permissionCatalog.some(permission => permission.code === code && permission.kind === "page")) {
          expect(permissionPageModel(page!).accessCodes).toEqual([code]);
        } else {
          expect(permissionPageModel(page!).operations.flatMap(operation => operation.codes)).toContain(code);
        }
        values.push(page!.value);
      });
    });
    expect(new Set(values).size).toBe(values.length);
  });

  it("assigns an independent page-access code to every route leaf", () => {
    const scopedRoutes = [
      ["/library", "library.view"], ["/library/overview", "library.overview"],
      ["/library/books/:bookId", "library.details.view"], ["/search", "library.search.view"],
      ["/booklists", "booklists.view"], ["/booklists/:booklistId", "booklists.details.view"],
      ["/articles", "articles.view"], ["/articles/:articleId", "articles.read"],
      ["/article-collections", "articles.collections.view"], ["/article-collections/:collectionId", "articles.collections.details.view"],
      ["/annotations", "notes.view"], ["/annotations/books", "notes.books.view"],
      ["/annotations/articles", "notes.articles.view"], ["/annotations/posts/:kind/:postId", "notes.posts.view"],
      ["/settings#services/ai", "settings.ai.view"], ["/settings#services/metadata", "settings.metadata.view"],
    ];
    const scopes = scopedRoutes.map(([route, code]) => {
      const page = rolePermissionPages.find(item => item.route === route);
      expect(page, `route ${route}`).toBeDefined();
      expect(permissionPageModel(page!).accessCodes).toEqual([code]);
      return code;
    });
    expect(new Set(scopes).size).toBe(scopes.length);
  });

  it("places controls beside the real page features that use them", () => {
    const modelAt = (route: string) => permissionPageModel(rolePermissionPages.find(page => page.route === route)!);
    expect(modelAt("/library/books/:bookId").operations.map(operation => operation.label)).toEqual([
      "下载", "更新", "删除", "开始阅读", "加入书目", "查看知识点", "查看书评与随笔", "撰写与编辑随笔",
    ]);
    expect(modelAt("/reader/:bookId").operations.map(operation => operation.label)).toEqual(["批注与书签", "整理笔记"]);
    expect(modelAt("/articles").operations.map(operation => operation.label)).toEqual(["管理文章", "加入选集"]);
    expect(modelAt("/articles/:articleId").operations).toEqual(permissionCatalog.some(permission => permission.code === "articles.annotate")
      ? [{ label: "批注与书签", codes: ["articles.annotate"] }]
      : []);
    expect(modelAt("/vault").operations).toEqual(permissionCatalog.some(permission => permission.code === "vault.read")
      ? [{ label: "阅读", codes: ["vault.read"] }, { label: "上传", codes: ["vault.upload"] }, { label: "删除", codes: ["vault.delete"] }]
      : []);
    expect(modelAt("/settings#services/ai").operations).toEqual([{ label: "配置服务", codes: ["settings.ai.edit"] }]);
    expect(modelAt("/settings#services/metadata").operations).toEqual([{ label: "配置元数据来源", codes: ["settings.metadata.edit"] }]);
  });
});
