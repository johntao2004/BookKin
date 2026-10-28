import catalog from '../../../server/src/main/resources/catalog/thema-1.6.json';
import chineseCatalog from './thema-zh-CN.json';

export const THEMA_VERSION = catalog.version;
export const THEMA_SUBJECTS = catalog.subjects;
const subjects = new Map(THEMA_SUBJECTS.map(item => [item.code, item]));
// 中文为 BookKin 展示译名；标准代码及英文原名保留用于检索和数据互通。
// BookKin display translations do not replace the canonical codes or English headings.
const chinese: Record<string, string> = chineseCatalog.labels;
export function themaLabel(code: string) {
  const item = subjects.get(code);
  return item ? `${chinese[code]}（${code}）` : `未收录代码（${code}）`;
}
export function themaPath(code: string): string {
  const item = subjects.get(code);
  return item ? [item.parent ? themaPath(item.parent) : '', themaLabel(code)].filter(Boolean).join(' / ') : themaLabel(code);
}
function englishPath(code: string): string {
  const item = subjects.get(code);
  return item ? [item.parent ? englishPath(item.parent) : '', item.label].filter(Boolean).join(' / ') : '';
}
export interface ThemaTreeNode { value: string; title: string; searchText: string; selectable: boolean; children: ThemaTreeNode[] }
export function themaTree(filter = false): ThemaTreeNode[] {
  const nodes = new Map(THEMA_SUBJECTS.map(item => [item.code, {
    value: item.code, title: themaLabel(item.code), searchText: `${themaPath(item.code)} ${englishPath(item.code)}`.toLowerCase(),
    selectable: filter || item.code.length > 1, children: [] as ThemaTreeNode[],
  }]));
  const roots: ThemaTreeNode[] = [];
  for (const item of THEMA_SUBJECTS) {
    const node = nodes.get(item.code)!;
    if (item.parent) nodes.get(item.parent)?.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export { matchesThema } from "./thema-filter";
