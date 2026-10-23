import { permissionCatalog } from "../auth/permissions";
import { settingsGroups } from "./settings-navigation";

const contentPages = [
  ["藏书楼", "藏书楼"], ["阅读器", "阅读器"], ["书单", "书目"], ["学脉图", "学脉图"],
  ["书楼漫游", "书楼漫游"], ["文章收藏", "文钞馆"], ["阅读笔记", "读书录"], ["禁书库", "秘阁"],
];
const sections = [
  { title: "内容与阅读", value: "content", pages: contentPages.map(([value, title]) => ({ value, title })) },
  ...settingsGroups.map(group => ({ title: group.label, value: group.key,
    pages: group.sections.map(section => ({ value: section.permissionGroup, title: section.label })) })),
];
const known = new Set(sections.flatMap(section => section.pages.map(page => page.value)));
// Keep newly added catalog groups discoverable until their navigation category is assigned.
const extra = [...new Set(permissionCatalog.map(permission => permission.group))].filter(group => !known.has(group));
export const rolePermissionGroups = [
  ...sections,
  ...(extra.length ? [{ title: "其他页面", value: "other", pages: extra.map(value => ({ value, title: value })) }] : []),
].map(section => ({ ...section, pages: section.pages.filter(page => permissionCatalog.some(permission => permission.group === page.value)) }))
  .filter(section => section.pages.length);
export const rolePermissionPages = rolePermissionGroups.flatMap(section => section.pages);
