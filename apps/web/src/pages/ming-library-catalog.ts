import type { Book } from '../domain/types';
import { themaPath } from '../domain/thema';

/** The scene receives bibliographic fields only, never NAS paths or file fingerprints. */
export interface MingLibraryBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  category: string;
  description: string;
  format: Book['format'];
  readUrl: string;
}

export function mingLibraryCatalog(books: readonly Book[], origin: string): MingLibraryBook[] {
  const seen = new Set<string>();
  return books.filter(book => {
    if (book.status !== 'AVAILABLE' || seen.has(book.id)) return false;
    seen.add(book.id);
    return true;
  }).map(book => {
    let coverUrl = '';
    try {
      const cover = new URL(book.coverUrl, origin);
      if (book.coverUrl && cover.origin === origin && ['http:', 'https:'].includes(cover.protocol)) coverUrl = cover.href;
    } catch { /* The scene can render a title cover when the stored cover is unavailable. */ }
    return {
      id: book.id, title: book.title, author: book.author, coverUrl,
      category: book.subjectCodes?.[0] ? themaPath(book.subjectCodes[0]) : '未分类',
      description: book.description, format: book.format,
      readUrl: `${origin}/reader/${encodeURIComponent(book.id)}`,
    };
  });
}
