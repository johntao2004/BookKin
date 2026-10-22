import { permissionCatalog } from "../auth/permissions";
import { settingsGroups } from "./settings-navigation";

const contentPages = [
  ["藏书阁", "藏书阁"], ["阅读器", "阅读器"], ["书单", "书目"], ["知识图谱", "知识图谱"],
  ["虚拟书库", "虚拟书库"], ["文章收藏", "文章与合集"], ["阅读笔记", "阅读笔记"], ["禁书库", "秘藏阁"],
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
