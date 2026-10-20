// 验证只从有证据知识合并概念和共现关系，排除不可用书籍与元数据冒充知识。
// Checks evidence-backed concept/co-occurrence merging while excluding unavailable books and metadata masquerading as knowledge.
import type { Book, BookKnowledge } from '../domain/types';
import { buildKnowledgeGraph, filterBooksByNode, searchKnowledgeBooks } from './knowledge-graph-model';
const book = (id: string): Book => ({ id, title: `书籍${id}`, author: '作者', tags: ['普通标签'], description: '', format: 'EPUB', coverUrl: '', progress: 0, addedAt: '', libraryRoot: '', relativePath: '', fingerprint: '', status: 'AVAILABLE' });
const analysis = (bookId: string, names: string[]): BookKnowledge => ({bookId, status: 'READY', providerId: 'test', generatedAt: '', sampledSections: 1, totalSections: 3, points: names.map(name => ({name, quote: `这是一段关于${name}的正文证据。`, locator: 'chapter.xhtml'}))});
it('merges a concept across books and records co-occurrence without turning metadata into knowledge', () => {
  const graph = buildKnowledgeGraph([analysis('a', ['认知偏差', '注意力']), analysis('b', ['认知偏差', '注意力'])], new Set(['a', 'b']));
  expect(graph.nodes).toHaveLength(2);
  expect(graph.nodes[0].data.bookIds).toEqual(['a', 'b']);
  expect(graph.edges).toHaveLength(1);
  expect(graph.edges[0].data.count).toBe(2);
  expect(graph.nodes.some(n => n.data.label === '普通标签')).toBe(false);
});
it('excludes unavailable books and evidence-free points', () => {
  const missingEvidence = analysis('b', ['无证据']); missingEvidence.points[0].quote = '';
  const graph = buildKnowledgeGraph([analysis('a', ['隐藏']), missingEvidence], new Set(['b']));
  expect(graph).toEqual({nodes: [], edges: []});
});
it('deduplicates names within a book and keeps empty catalogs empty', () => {
  expect(buildKnowledgeGraph([], new Set())).toEqual({nodes: [], edges: []});
  const graph = buildKnowledgeGraph([analysis('a', [' Attention ', 'attention'])], new Set(['a']));
  expect(graph.nodes).toHaveLength(1);
  expect(graph.nodes[0].data.count).toBe(1);
  expect(graph.edges).toHaveLength(0);
});
it('searches concepts and books across the complete catalog, then applies a clicked concept as a filter', () => {
  const books = [book('a'), book('b'), book('c')];
  const knowledge = [analysis('a', ['认知偏差']), analysis('b', ['认知偏差']), analysis('c', ['注意力'])];
  expect(searchKnowledgeBooks(books, knowledge, '认知偏差').map(b => b.id)).toEqual(['a', 'b']);
  expect(searchKnowledgeBooks(books, knowledge, '书籍c').map(b => b.id)).toEqual(['c']);
  const graph = buildKnowledgeGraph(knowledge, new Set(books.map(b => b.id)));
  expect(filterBooksByNode(books, graph.nodes.find(n => n.id === '认知偏差')).map(b => b.id)).toEqual(['a', 'b']);
  expect(filterBooksByNode(books)).toEqual(books);
});
