import { classifyCatalogBook } from '../pages/virtual-library-catalog';
import { demoBooks } from '../data/demo';
import chineseCatalog from './thema-zh-CN.json';
import { THEMA_VERSION, THEMA_SUBJECTS, themaLabel, themaPath, themaTree, suggestThema, matchesThema } from './thema';

it('includes the complete official subject hierarchy with resolvable parents and no qualifiers', () => {
  expect(THEMA_SUBJECTS).toHaveLength(3422);
  expect(themaTree()).toHaveLength(20);
  const codes = new Set(THEMA_SUBJECTS.map(item => item.code));
  expect(codes.size).toBe(THEMA_SUBJECTS.length);
  expect(THEMA_SUBJECTS.every(item => /^[A-Y]/.test(item.code) && (!item.parent || codes.has(item.parent)))).toBe(true);
  expect(themaPath('RNKH2')).toContain('生态修复');
  expect(themaPath('RNKH2')).toContain('地球科学');
  expect(themaTree().every(item => !item.selectable)).toBe(true);
  expect(themaTree(true).every(item => item.selectable)).toBe(true);
});
it('uses declared descendants for filters without treating keyword guesses as saved subjects', () => {
  expect(matchesThema(['RNKH2'], 'R')).toBe(true);
  expect(matchesThema(['RNKH2'], 'RNK')).toBe(true);
  expect(matchesThema(['AKH'], 'RNK')).toBe(false);
  expect(matchesThema([], 'R')).toBe(false);
  expect(matchesThema([], 'UNCLASSIFIED')).toBe(true);
  expect(matchesThema(['AKH'], 'UNCLASSIFIED')).toBe(false);
});
it('returns conservative metadata suggestions and an honest empty result', () => {
  expect(suggestThema('古籍装帧与纸张保护')).toEqual(['GL', 'AKH']);
  expect(suggestThema('森林修复与生态监测')).toContain('RNKH2');
  expect(suggestThema('123456')).toEqual([]);
});

it('keeps the first deep subject authoritative in the existing virtual-library zones', () => {
  expect(classifyCatalogBook({ ...demoBooks[0], subjectCodes: ['AKH', 'GL'] }).category.id).toBe('arts');
  expect(classifyCatalogBook({ ...demoBooks[0], subjectCodes: ['RNKH2', 'FB'] }).category.id).toBe('nature');
});

it('covers every standard code with Chinese display text and keeps the same catalog version', () => {
  expect(chineseCatalog.version).toBe(THEMA_VERSION);
  expect(Object.keys(chineseCatalog.labels).sort()).toEqual(THEMA_SUBJECTS.map(item => item.code).sort());
  for (const item of THEMA_SUBJECTS) {
    expect(themaLabel(item.code)).toMatch(/[\u3400-\u9fff]/);
    expect(themaLabel(item.code)).toContain(`（${item.code}）`);
  }
  expect(themaPath('AKH')).toBe('艺术（A） / 设计、工业与商业艺术、插画（AK） / 书籍设计与装帧（AKH）');
});
it('retains English ancestor and leaf search alongside Chinese and standard-code search', () => {
  const flatten = (nodes: ReturnType<typeof themaTree>): ReturnType<typeof themaTree> => nodes.flatMap(node => [node, ...flatten(node.children)]);
  const nodes = flatten(themaTree());
  expect(nodes.find(node => node.value === 'RNKH2')?.searchText).toContain('restoration ecology');
  expect(nodes.find(node => node.value === 'RNKH2')?.searchText).toContain('earth sciences');
  expect(nodes.find(node => node.value === 'AKH')?.searchText).toContain('书籍设计与装帧');
  expect(nodes.find(node => node.value === 'AKH')?.searchText).toContain('akh');
  expect(themaLabel('INVALID')).toBe('未收录代码（INVALID）');
});
