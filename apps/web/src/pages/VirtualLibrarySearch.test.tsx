import { fireEvent, render, screen } from '@testing-library/react';
import { TestProviders } from '../test/TestProviders';
import type { Book } from '../domain/types';
import { searchLibraryBooks, VirtualLibrarySearch } from './VirtualLibrarySearch';

const books = [
  { id: 'book-one', title: '山川与灯火', author: '顾远', format: 'EPUB', tags: ['文学', '小说'] },
  { id: 'book-two', title: '星空图鉴', author: '李明', format: 'PDF', tags: ['科学'] },
] as Book[];

describe('catalog orb search', () => {
  it('matches title, author, category and normalized format terms', () => {
    expect(searchLibraryBooks(books, '灯火 顾远').map(book => book.id)).toEqual(['book-one']);
    expect(searchLibraryBooks(books, '科学 ｐｄｆ').map(book => book.id)).toEqual(['book-two']);
    expect(searchLibraryBooks(books, '不存在')).toEqual([]);
    expect(searchLibraryBooks(books, '')).toHaveLength(2);
  });
  it('filters live, shows an empty state and links matching books to the reader', () => {
    const close = vi.fn();
    render(<TestProviders><VirtualLibrarySearch open books={books} onClose={close} /></TestProviders>);
    const input = screen.getByRole('textbox', {name:'搜索书名、作者或分类'});
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    fireEvent.change(input, {target:{value:'顾远'}});
    expect(screen.getByRole('status')).toHaveTextContent('找到 1 本藏书');
    expect(screen.queryByRole('link', {name:'阅读《星空图鉴》'})).not.toBeInTheDocument();
    const link = screen.getByRole('link', {name:'阅读《山川与灯火》'});
    expect(link).toHaveAttribute('href', '/reader/book-one');
    fireEvent.change(input, {target:{value:'不存在'}});
    expect(screen.getByText('没有找到匹配的藏书，试试其他关键词')).toBeInTheDocument();
    fireEvent.change(input, {target:{value:'顾远'}});
    fireEvent.click(screen.getByRole('link', {name:'阅读《山川与灯火》'}));
    expect(close).toHaveBeenCalledOnce();
  });
});
