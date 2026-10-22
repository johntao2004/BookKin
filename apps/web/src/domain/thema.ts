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

// 分类建议只使用当前书目信息；须点击采纳并保存，不自动写入或覆盖人工分类。
/** Metadata-only suggestions require explicit adoption and save; never silently overwrite manual subjects. */
const suggestionRules: [string, string[]][] = [
  ['AKH', ['装帧', '书籍设计', 'bookbinding', 'book design']], ['GL', ['古籍', '图书馆', '文献保护', '纸张保护', 'library science']],
  ['RNKH2', ['生态修复', '森林修复', 'rewilding']], ['TVR', ['林业', '森林', 'forestry']],
  ['PSAF', ['生态系统', '碳循环', '光合作用', 'ecology']], ['RNCB', ['生物多样性', 'biodiversity']],
  ['PSPF', ['河流', '淡水', '水质', 'freshwater']], ['UM', ['编程', '程序设计', '软件开发', 'programming']],
  ['PB', ['数学', 'mathematics']], ['PH', ['物理', 'physics']], ['PN', ['化学', 'chemistry']],
  ['JN', ['教育', '教学', 'education']], ['FB', ['小说', 'novel']], ['AM', ['建筑', 'architecture']],
];
export function suggestThema(text: string): string[] {
  const value = text.toLowerCase();
  return suggestionRules.map(([code, terms], index) => ({ code, index, score: terms.filter(term => value.includes(term)).length }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 4).map(item => item.code);
}
export { matchesThema } from "./thema-filter";
