import { permissionCatalog, routePermission } from "../auth/permissions";
import { settingsGroups } from "./settings-navigation";
import { articlesNavigationSections, libraryNavigationSections, notesNavigationSections } from "../components/app-navigation-sections";

export interface RolePermissionRouteNode {
  title: string;
  value: string;
  permissionGroup?: string;
  route?: string;
  children?: RolePermissionRouteNode[];
}

const routeNode = (title: string, route: string, permissionGroup: string): RolePermissionRouteNode => ({
  title, route, permissionGroup, value: `route:${route}`,
});
const routeBranch = (title: string, route: string, permissionGroup: string, children: RolePermissionRouteNode[]): RolePermissionRouteNode => ({
  ...routeNode(title, route, permissionGroup), children,
});

// Parent and child nodes follow actual page-route hierarchy; leaves map route
// permissions to existing catalog groups without changing permission IDs.
const navigationGroups: RolePermissionRouteNode[] = [
  { title: "藏书楼", value: "nav:library", children: [
    routeNode("全部藏书", "/library", "藏书楼"),
    routeNode(libraryNavigationSections[0].label, libraryNavigationSections[0].path, "藏书楼"),
    routeBranch("书籍详情", "/library/books/:bookId", "藏书楼", [routeNode("阅读器", "/reader/:bookId", "阅读器")]),
    routeBranch(libraryNavigationSections[1].label, libraryNavigationSections[1].path, "书单", [routeNode("书目详情", "/booklists/:booklistId", "书单")]),
    routeNode(libraryNavigationSections[2].label, libraryNavigationSections[2].path, "学脉图"),
    routeNode(libraryNavigationSections[3].label, libraryNavigationSections[3].path, "书楼漫游"),
  ] },
  routeNode("搜索", "/search", "藏书楼"),
  { title: "文钞馆", value: "nav:articles", children: [
    routeBranch(articlesNavigationSections[0].label, articlesNavigationSections[0].path, "文章收藏", [routeNode("文章阅读", "/articles/:articleId", "文章收藏")]),
    routeBranch(articlesNavigationSections[1].label, articlesNavigationSections[1].path, "文章收藏", [routeNode("选集详情", "/article-collections/:collectionId", "文章收藏")]),
  ] },
  routeBranch("读书录", "/annotations", "阅读笔记", [
    ...notesNavigationSections.map(section => routeNode(section.label, section.path, "阅读笔记")),
    routeNode("随笔详情", "/annotations/posts/:kind/:postId", "阅读笔记"),
  ]),
  routeNode("秘阁", "/vault", "禁书库"),
];

const settingsNodeGroups: RolePermissionRouteNode[] = settingsGroups.map(group => ({
  title: group.label,
  value: `settings:${group.key}`,
  children: group.sections.map(section => ({
    title: section.label,
    route: `/settings${section.hash}`,
    permissionGroup: section.permissionGroup,
    value: `route:/settings${section.hash}`,
  })),
}));

const mappedGroups = new Set(flatten([...navigationGroups, ...settingsNodeGroups])
  .map(node => node.permissionGroup).filter((group): group is string => Boolean(group)));
const extraGroups = [...new Set(permissionCatalog.map(permission => permission.group))].filter(group => !mappedGroups.has(group));

export const rolePermissionGroups: RolePermissionRouteNode[] = [
  ...navigationGroups,
  { title: "管理设置", value: "settings", children: settingsNodeGroups },
  ...(extraGroups.length ? [{ title: "其他页面", value: "other", children: extraGroups.map(group => ({
    title: group, value: `permission:${group}`, permissionGroup: group,
  })) }] : []),
];

function flatten(nodes: RolePermissionRouteNode[]): RolePermissionRouteNode[] {
  return nodes.flatMap(node => [...(node.permissionGroup ? [node] : []), ...(node.children ? flatten(node.children) : [])]);
}

export interface PermissionPageOperation { label: string; codes: string[] }
export interface PermissionPageModel { page: RolePermissionRouteNode; accessCodes: string[]; operations: PermissionPageOperation[] }

const actionsByGroup: Record<string, PermissionPageOperation[]> = {
  "阅读器": [{ label: "批注与书签", codes: ["reader.annotate"] }, { label: "整理笔记", codes: ["notes.edit"] }],
  "学脉图": [{ label: "生成知识图谱", codes: ["knowledge.generate"] }],
  "书楼漫游": [],
  "书单": [{ label: "管理书单", codes: ["booklists.edit"] }],
  "阅读笔记": [{ label: "撰写与编辑随笔", codes: ["notes.edit"] }],
  "角色权限": [{ label: "管理角色权限", codes: ["roles.manage"] }],
  "禁书库": [
    { label: "阅读", codes: ["vault.read"] },
    { label: "上传", codes: ["vault.upload"] },
    { label: "删除", codes: ["vault.delete"] },
  ],
  "书库目录": [{ label: "管理书库目录", codes: ["settings.roots.edit"] }],
  "文件任务": [],
  "回收站": [{ label: "恢复书籍", codes: ["settings.recycle.restore"] }, { label: "永久清理", codes: ["settings.recycle.purge"] }],
  "用户管理": [{ label: "创建用户", codes: ["settings.users.create"] }, { label: "管理用户", codes: ["settings.users.manage"] }],
  "在线会话": [{ label: "撤销会话", codes: ["settings.sessions.revoke"] }],
  "登录日志": [],
  "安全设置": [{ label: "配置安全策略", codes: ["settings.security.edit"] }],
  "阅读字体": [{ label: "管理阅读字体", codes: ["settings.fonts.edit"] }],
  "AI 服务": [{ label: "配置服务", codes: ["settings.ai.edit"] }],
  "网站设置": [{ label: "配置网站", codes: ["settings.site.edit"] }],
  "邮件服务": [{ label: "配置邮件", codes: ["settings.mail.edit"] }],
};

export const rolePermissionPages = flatten(rolePermissionGroups).filter(page =>
  page.permissionGroup && permissionCatalog.some(permission => permission.group === page.permissionGroup));

export function permissionPageModel(page: RolePermissionRouteNode): PermissionPageModel {
  const groupPermissions = permissionCatalog.filter(permission => permission.group === page.permissionGroup);
  const routeCode = page.route ? routePermission(page.route.startsWith("/settings#") ? "/settings" : page.route,
    page.route.startsWith("/settings#") ? page.route.slice("/settings".length) : "") : undefined;
  const accessCodes = routeCode && permissionCatalog.some(permission => permission.code === routeCode && permission.kind === "page")
    ? [routeCode] : groupPermissions.filter(permission => permission.kind === "page").map(permission => permission.code);
  let operations = actionsByGroup[page.permissionGroup ?? ""] ?? [];
  if (page.permissionGroup === "藏书楼") {
    const route = page.route ?? "";
    const update = { label: "更新", codes: ["library.edit", "library.organize", "library.files"] };
    const deletion = { label: "删除", codes: ["library.trash"] };
    if (route === "/library") operations = [
      { label: "上传", codes: ["library.upload"] }, { label: "下载", codes: ["library.download"] }, update,
      { label: "查询", codes: ["library.query"] }, { label: "删除", codes: ["library.trash"] },
    ];
    else if (route === "/library/overview") operations = [];
    else if (route.startsWith("/library/books/") && route.endsWith("/edit")) operations = [update];
    else if (route.startsWith("/library/books/")) operations = [
      { label: "下载", codes: ["library.download"] }, update, deletion,
      { label: "开始阅读", codes: ["reader.read"] }, { label: "加入书目", codes: ["booklists.edit"] },
      { label: "查看知识点", codes: ["knowledge.view"] }, { label: "查看书评与随笔", codes: ["notes.view"] },
      { label: "撰写与编辑随笔", codes: ["notes.edit"] },
    ];
    else if (route.startsWith("/library/uploads/")) operations = [{ label: "上传", codes: ["library.upload"] }];
    else if (route === "/search") operations = [
      { label: "查询书籍", codes: ["library.query"] },
      { label: "查询笔记（同时控制读书录访问）", codes: ["notes.view"] },
      { label: "查询书目（同时控制书目页面访问）", codes: ["booklists.view"] },
    ];
    else if (route === "/categories") operations = [];
    else operations = [];
  } else if (page.permissionGroup === "文章收藏") {
    operations = page.route?.startsWith("/article-collections")
      ? [{ label: "管理合集", codes: ["articles.collections.edit"] }]
      : page.route === "/articles/:articleId" ? [{ label: "批注与书签", codes: ["articles.annotate"] }]
      : page.route === "/articles" ? [
        { label: "管理文章", codes: ["articles.edit"] },
        { label: "加入选集", codes: ["articles.collections.edit"] },
      ] : [];
  } else if (page.permissionGroup === "AI 服务" && page.route === "/settings#services/metadata") {
    operations = [{ label: "配置元数据来源", codes: ["settings.metadata.edit"] }];
  }
  operations = operations.filter(operation => operation.codes.every(code => permissionCatalog.some(permission => permission.code === code)));
  return { page, accessCodes, operations };
}
