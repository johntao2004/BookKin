import type { Book } from '../domain/types';
import { mingLibraryCatalog } from './ming-library-catalog';

const book: Book = {
  id: 'real-book', title: '真实书名', author: '真实作者', description: '内容简介', format: 'EPUB',
  coverUrl: '/api/v1/books/real-book/cover?v=2', progress: 0.4, addedAt: '2026-10-26',
  libraryRoot: '/private/nas', relativePath: 'private.epub', fingerprint: 'private-fingerprint',
  status: 'AVAILABLE', tags: [], subjectCodes: ['UM'],
};

it('maps each accessible book once and excludes filesystem and private reading data', () => {
  const catalog = mingLibraryCatalog([book, book, {...book, id: 'missing', status: 'MISSING'}], 'http://localhost:4176');
  expect(catalog).toHaveLength(1);
  expect(catalog[0]).toMatchObject({id: book.id, title: book.title, author: book.author,
    coverUrl: 'http://localhost:4176/api/v1/books/real-book/cover?v=2'});
  expect(catalog[0].category).toContain('UM');
  for (const key of ['libraryRoot', 'relativePath', 'fingerprint', 'progress', 'pageCount']) expect(catalog[0]).not.toHaveProperty(key);
});

it('keeps an empty real catalog empty and never requests external or executable cover URLs', () => {
  expect(mingLibraryCatalog([], 'http://localhost:4176')).toEqual([]);
  for (const coverUrl of ['https://external.example/cover.png', 'javascript:alert(1)', 'data:image/png;base64,AA', '']) {
    expect(mingLibraryCatalog([{...book, coverUrl}], 'http://localhost:4176')[0].coverUrl).toBe('');
  }
});
