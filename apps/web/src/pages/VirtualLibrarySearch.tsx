import { Empty, Input, Modal } from 'antd';
import { useMemo, useRef, useState } from 'react';
import type { InputRef } from 'antd';
import { Link } from 'react-router-dom';
import type { Book } from '../domain/types';
import { SearchRounded } from '../ui/icons';
import { Button } from '../ui/buttons';

export function searchLibraryBooks(books: Book[], query: string) {
  const terms = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return books.filter(book => {
    const text = [book.title, book.author, book.series, book.format, ...book.tags]
      .filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}

export function VirtualLibrarySearch({open, books, onClose, onLocateBook, onReadBook}: {
  open: boolean; books: Book[]; onClose: () => void;
  onLocateBook?: (bookId: string) => void;
  onReadBook?: (bookId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const input = useRef<InputRef>(null);
  const results = useMemo(() => searchLibraryBooks(books, query), [books, query]);
  const hasQuery = query.trim().length > 0;
  return <Modal aria-label="搜索藏书" centered closable={false} open={open} onCancel={onClose} footer={null}
    afterOpenChange={visible => { if (visible) input.current?.focus(); else setQuery(''); }}>
    <Input ref={input} size="large" prefix={<SearchRounded />} aria-label="搜索书名、作者或分类" placeholder="搜索书名、作者或分类"
      allowClear value={query} onChange={event => setQuery(event.target.value)} />
    {hasQuery && <><p role="status">找到 {results.length} 本藏书</p>
    <div className="virtual-library-search-results">
      {results.length ? results.map(book => <div key={book.id} className="virtual-library-search-row"><Link className="virtual-library-search-result"
        to={`/reader/${encodeURIComponent(book.id)}`} onClick={event => {
          onClose();
          if (onReadBook && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault(); onReadBook(book.id);
          }
        }} aria-label={`阅读《${book.title}》`}>
        <strong>{book.title}</strong><span>{book.author || '佚名'} · {book.format}</span>
      </Link>{onLocateBook && <Button size="small" aria-label={`定位《${book.title}》到书架`}
        onClick={() => {onClose(); onLocateBook(book.id);}}>定位到书架</Button>}</div>) : <Empty description="没有找到匹配的藏书，试试其他关键词" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
    </div></>}
  </Modal>;
}
