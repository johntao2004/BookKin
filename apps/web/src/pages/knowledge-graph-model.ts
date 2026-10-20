import type { Book, BookKnowledge } from '../domain/types';

export interface KnowledgeNode {
  [key: string]: unknown;
  id: string;
  data: { label: string; bookIds: string[]; count: number };
}
export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  edges: { source: string; target: string; data: { count: number } }[];
}
export const knowledgeKey = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** Every node has source-text evidence. Edges mean co-occurrence in a book, not inferred causality. */
export function buildKnowledgeGraph(knowledge: BookKnowledge[], bookIds: Set<string>): KnowledgeGraphData {
  const nodes = new Map<string, KnowledgeNode>();
  const edges = new Map<string, { source: string; target: string; data: { count: number } }>();
  for (const item of knowledge) {
    if (!bookIds.has(item.bookId)) continue;
    const ids = new Set<string>();
    for (const point of item.points) {
      const id = knowledgeKey(point.name);
      if (!id || !point.quote || !point.locator) continue;
      const node = nodes.get(id) ?? { id, data: { label: point.name, bookIds: [], count: 0 } };
      if (!node.data.bookIds.includes(item.bookId)) node.data.bookIds.push(item.bookId);
      node.data.count = node.data.bookIds.length;
      nodes.set(id, node);
      ids.add(id);
    }
    const sorted = [...ids].sort();
    for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) {
      const key = JSON.stringify([sorted[i], sorted[j]]);
      const edge = edges.get(key) ?? { source: sorted[i], target: sorted[j], data: { count: 0 } };
      edge.data.count++;
      edges.set(key, edge);
    }
  }
  return { nodes: [...nodes.values()].sort((a, b) => b.data.count - a.data.count || a.id.localeCompare(b.id)), edges: [...edges.values()] };
}

export function searchKnowledgeBooks(books: Book[], knowledge: BookKnowledge[], query: string) {
  const value = knowledgeKey(query);
  if (!value) return books;
  const matched = new Set(knowledge.filter(item => item.points.some(point => knowledgeKey(point.name).includes(value))).map(item => item.bookId));
  return books.filter(book => matched.has(book.id) || [book.title, book.author].some(text => knowledgeKey(text).includes(value)));
}
export function filterBooksByNode(books: Book[], node?: KnowledgeNode) {
  if (!node) return books;
  const ids = new Set(node.data.bookIds);
  return books.filter(book => ids.has(book.id));
}
