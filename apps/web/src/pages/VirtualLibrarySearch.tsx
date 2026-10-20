// 对已授权目录快照做本地检索，选择结果交给场景定位或阅读导航。
// Searches the authorized catalog snapshot locally and delegates selections to scene focus or reader navigation.
import { Empty, Input, Modal } from 'antd';
import { useMemo, useRef, useState } from 'react';
import type { InputRef } from 'antd';
import { Link } from 'react-router-dom';
import type { Book } from '../domain/types';
import { SearchRounded } from '../ui/icons';
import { Button } from '../ui/buttons';
import { EMPTY_CATALOG_TITLE } from '../ui/empty-state-copy';
import { tokens } from '../theme/generated-tokens';

const SEARCH_MODAL_BODY_STYLE = {
  maxHeight: "calc(100dvh - var(--spacing-24) - var(--spacing-24))",
  overflowY: "auto",
  overscrollBehavior: "contain",
} as const;
const SEARCH_RESULTS_STYLE = { flexWrap: "wrap" } as const;
const SEARCH_LOCATE_BUTTON_STYLE = {
  minWidth: tokens.layout.touchTarget,
  minHeight: tokens.layout.touchTarget,
  marginInlineStart: "auto",
} as const;

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
  return <Modal className="virtual-library-search-modal" aria-label="搜索藏书" centered closable={false} open={open} onCancel={onClose} footer={null}
    width={tokens.spacing[24] * 5} styles={{ container: {padding: 0, background: "transparent", boxShadow: "none", border: 0}, body: SEARCH_MODAL_BODY_STYLE }}
    afterOpenChange={visible => { if (visible) input.current?.focus(); else setQuery(''); }}>
    <Input className="virtual-library-search-input" ref={input} size="large" prefix={<SearchRounded />} aria-label="搜索书名、作者或分类" placeholder="搜索书名、作者或分类"
      allowClear value={query} onChange={event => setQuery(event.target.value)} />
    {hasQuery && <><p className="virtual-library-search-status" role="status">找到 {results.length} 本藏书</p>
    <div className="virtual-library-search-results">
      {results.length ? results.map(book => <div key={book.id} className="virtual-library-search-row" style={SEARCH_RESULTS_STYLE}><Link className="virtual-library-search-result"
        to={`/reader/${encodeURIComponent(book.id)}`} onClick={event => {
          onClose();
          if (onReadBook && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault(); onReadBook(book.id);
          }
        }} aria-label={`阅读《${book.title}》`}>
        <strong>{book.title}</strong><span>{book.author || '佚名'} · {book.format}</span>
      </Link>{onLocateBook && <Button size="small" aria-label={`定位《${book.title}》到书架`}
        sx={SEARCH_LOCATE_BUTTON_STYLE}
        onClick={() => {onClose(); onLocateBook(book.id);}}>定位到书架</Button>}</div>) : <Empty description={query ? "未找到匹配的书籍" : EMPTY_CATALOG_TITLE} image={Empty.PRESENTED_IMAGE_DEFAULT} />}
    </div></>}
  </Modal>;
}
