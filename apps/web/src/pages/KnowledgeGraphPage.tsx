import { usePermissions } from "../auth/permissions";
// 藏书阁图谱只显示书籍正文的知识点和关联；分析由用户显式触发。
// The library graph contains book evidence only; analysis starts explicitly on user action.
import { type NetworkGraphOptions } from '@ant-design/graphs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { _AntAlert as Alert, _AntButton as Button, Empty, Pagination, Skeleton, Tag } from '@/ui/antd';
import { Typography } from '@/ui/primitives';
import { Drawer } from '@/ui/overlays';
import { Checkbox } from '@/ui/forms';
import { TextField } from '@/ui/forms';
import { SearchRounded } from '@/ui/icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PageContainer, PageHeader } from '../components/PageHeader';
import type { BookKnowledge } from '../domain/types';
import { tokens } from '../theme/generated-tokens';
import { useBookKinTheme } from '../theme/BookKinThemeProvider';
import { buildKnowledgeGraph, filterBooksByNode, knowledgeKey, searchKnowledgeBooks } from './knowledge-graph-model';
import { fetchVirtualLibraryBooks } from './virtual-library-query';
import { KnowledgeNetwork } from './KnowledgeNetwork';
import './knowledge-graph.css';

type GraphInstance = Parameters<NonNullable<NetworkGraphOptions['onReady']>>[0];
const PAGE_SIZE = 24;
const MAX_NODES = 160;
const NO_KNOWLEDGE: BookKnowledge[] = [];

export function KnowledgeGraphPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { mode } = useBookKinTheme();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<'analysis' | null>(null);
  const [analysisQuery, setAnalysisQuery] = useState('');
  const [analysisLimit, setAnalysisLimit] = useState(PAGE_SIZE);
  const analysisListRef = useRef<HTMLDivElement | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState('');
  const [generationMessage, setGenerationMessage] = useState('');
  const graphRef = useRef<GraphInstance | null>(null);
  const { can } = usePermissions();
  const canGenerate = can("knowledge.generate");
  const knowledgeQueryKey = ['book-knowledge', user?.id];
  const catalog = useQuery({ queryKey: ['books', 'knowledge-graph', user?.id], queryFn: ({ signal }) => fetchVirtualLibraryBooks(signal), enabled: Boolean(user) });
  const knowledgeQuery = useQuery({ queryKey: knowledgeQueryKey, queryFn: ({ signal }) => api.listBookKnowledge(signal), enabled: Boolean(user), refetchInterval: generating ? false : 30000 });
  const knowledge = knowledgeQuery.data ?? NO_KNOWLEDGE;
  const books = useMemo(() => catalog.data?.pages.flatMap(value => value.items) ?? [], [catalog.data]);
  const matches = useMemo(() => searchKnowledgeBooks(books, knowledge, query), [books, knowledge, query]);
  const fullGraph = useMemo(() => buildKnowledgeGraph(knowledge, new Set(matches.map(book => book.id))), [knowledge, matches]);
  const data = useMemo(() => {
    const nodes = fullGraph.nodes.slice(0, MAX_NODES);
    const ids = new Set(nodes.map(node => node.id));
    return { nodes, edges: fullGraph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)) };
  }, [fullGraph]);
  const selected = fullGraph.nodes.find(node => node.id === selectedId);
  const filteredBooks = useMemo(() => filterBooksByNode(matches, selected), [matches, selected]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredBooks.length / PAGE_SIZE)));
  const completed = knowledge.filter(item => item.status === 'READY').length;
  const options = useMemo<NetworkGraphOptions>(() => ({
    data,
    autoFit: 'view', padding: tokens.spacing[10], animation: false,
    node: { style: {
      size: node => Math.min(40, 14 + Number(node.data?.count ?? 1) * 3),
      fill: node => Number(node.data?.count) > 1 ? tokens.color.semantic.primary : tokens.color.semantic.accentTeal,
      stroke: 'transparent',
      labelText: node => String(node.data?.label ?? ''),
      labelFill: mode === 'NIGHT' ? tokens.color.semantic.textOnDark : tokens.color.semantic.textPrimary,
      labelFontSize: tokens.typography.fontSize.caption, labelPlacement: 'bottom',
      labelMaxWidth: 112, labelWordWrap: true, labelMaxLines: 2,
    }, state: { active: { lineWidth: 3, stroke: tokens.color.semantic.primary }, inactive: { opacity: 0.2 } } },
    edge: { style: { stroke: tokens.color.semantic.border, lineWidth: 1 }, state: { inactive: { opacity: 0.12 } } },
    layout: { type: 'd3-force', link: { distance: 100 }, collide: { radius: 38 }, manyBody: { strength: -260 }, x: {}, y: {} },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', { type: 'hover-activate', degree: 1 }],
    onReady: graph => {
      graphRef.current = graph;
      graph.on('node:click', event => { if ('target' in event && event.target && 'id' in event.target) { const id = String(event.target.id); setSelectedId(previous => previous === id ? null : id); setPage(1); } });
      graph.on('canvas:click', () => { setSelectedId(null); setPage(1); });
    },
    onDestroy: () => { graphRef.current = null; },
  }), [data, mode]);

  const analysisBooks = useMemo(() => searchKnowledgeBooks(books, [], analysisQuery), [books, analysisQuery]);
  const visibleAnalysisBooks = analysisBooks.slice(0, analysisLimit);
  const toggleBook = (id: string, checked: boolean) => setSelectedBooks(current => checked ? [...new Set([...current, id])] : current.filter(value => value !== id));

  async function analyzeSelection() {
    if (batchBusy || !selectedBooks.length) return;
    setBatchBusy(true); setGenerationError(''); setGenerationMessage('');
    let completedCount = 0;
    const failures: string[] = [];
    const failedIds = new Set<string>();
    for (const bookId of selectedBooks) {
      setGenerating(bookId);
      try {
        const items = await api.generateBookKnowledge(bookId);
        queryClient.setQueryData(knowledgeQueryKey, items);
        completedCount++;
      } catch (error) { failedIds.add(bookId); failures.push(error instanceof Error ? error.message : '知识点提取失败，请重试。'); }
    }
    if (completedCount) setGenerationMessage(`已完成 ${completedCount} 本书的正文分析。`);
    if (failures.length) setGenerationError(`${failures.length} 本分析失败：${failures[0]}`);
    setSelectedBooks(current => current.filter(id => failedIds.has(id)));
    setGenerating(null); setBatchBusy(false);
  }

  const pending = catalog.isPending || knowledgeQuery.isPending;
  const error = catalog.isError || knowledgeQuery.isError;
  return <PageContainer>
    <PageHeader eyebrow="KNOWLEDGE GRAPH" title="知识图谱" action={
      <div className="bk-knowledge-header-actions">
        <div className="bk-knowledge-controls" role="group" aria-label="搜索和视图操作">
          <TextField className="bk-knowledge-search" slotProps={{ input: { startAdornment: <SearchRounded fontSize="small" /> } }} aria-label="搜索知识点或书籍" placeholder="搜索知识点、书名或作者" allowClear value={query} onChange={event => { setQuery(event.target.value); setPage(1); setSelectedId(null); }} />
          <Button onClick={() => { setSelectedId(null); setPage(1); void graphRef.current?.fitView(); }}>重置视图</Button>
        </div>
        {canGenerate && <Button onClick={() => setDrawer('analysis')}>{batchBusy ? '分析中…' : '分析书籍'}</Button>}
      </div>
    } />
    <section className="bk-knowledge" aria-label="正文知识网络">
      <div className={`bk-knowledge-workspace${selected ? ' has-selection' : ''}`}>
        <div className="bk-knowledge-canvas" aria-label="可拖动缩放的知识点网络">
          {error ? <Alert type="error" showIcon title="暂时无法加载知识图谱" action={<Button onClick={() => { void catalog.refetch(); void knowledgeQuery.refetch(); }}>重试</Button>} />
            : pending ? <Skeleton active paragraph={{ rows: 10 }} />
            : !data.nodes.length ? <div className="bk-knowledge-empty"><Empty description={query ? '没有匹配的正文知识点' : '还没有正文知识点'} />{query ? <Button onClick={() => setQuery('')}>清除搜索</Button> : null}</div>
            : <><KnowledgeNetwork key={mode} options={options} /><div className="bk-knowledge-zoom"><Button aria-label="放大图谱" onClick={() => void graphRef.current?.zoomBy(1.25)}>＋</Button><Button aria-label="缩小图谱" onClick={() => void graphRef.current?.zoomBy(0.8)}>−</Button><Button onClick={() => void graphRef.current?.fitView()}>适应</Button></div></>}
        </div>
        {selected && <aside className="bk-knowledge-details" aria-label="知识点筛选">
          <div className="bk-knowledge-selection"><Typography component="h2">{selected.data.label}</Typography><Button onClick={() => { setSelectedId(null); setPage(1); }}>清除筛选</Button></div>
          <section aria-label="图谱筛选结果"><Tag>{filteredBooks.length} 本相关书籍</Tag>
            <div className="bk-knowledge-related-books">{filteredBooks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(book => {
              const analysis = knowledge.find(item => item.bookId === book.id);
              const evidence = analysis?.points.find(point => knowledgeKey(point.name) === selected.id);
              return <article key={book.id} className="bk-knowledge-related-book"><Typography component="h3"><Link to={`/reader/${book.id}`}>{book.title}</Link></Typography><span>{book.author}</span>
                {analysis && <small>已分析 {analysis.sampledSections}/{analysis.totalSections} {book.format === 'PDF' ? '页' : '章'}</small>}
                {evidence && <blockquote><p>{evidence.quote}</p><Link to={`/reader/${book.id}?locator=${encodeURIComponent(book.format === 'PDF' ? `pdf:page=${Number(evidence.locator.replace('page:', ''))}` : evidence.locator)}`}>查看原文 · {evidence.locator}</Link></blockquote>}
              </article>;
            })}</div>
            {filteredBooks.length > PAGE_SIZE && <Pagination size="small" current={currentPage} pageSize={PAGE_SIZE} total={filteredBooks.length} showSizeChanger={false} onChange={setPage} />}
          </section>

        </aside>}
      </div>
      <div className="bk-knowledge-footer"><div className="bk-knowledge-summary"><div className="bk-knowledge-legend"><span><i style={{ background: tokens.color.semantic.accentTeal }} />单书知识点</span><span><i style={{ background: tokens.color.semantic.primary }} />跨书知识点</span></div><span>已分析 {completed} / {books.length} 本</span></div></div>
    </section>
    {canGenerate && <Drawer open={drawer === 'analysis'} onClose={() => setDrawer(null)} anchor="right" title="正文分析" slotProps={{ paper: { sx: { width: `min(100vw, ${tokens.layout.touchTarget * 10}px)` } } }}>
      <div className="bk-knowledge-drawer-body">
        <TextField aria-label="搜索待分析书籍" placeholder="搜索书名或作者" value={analysisQuery} onChange={event => { setAnalysisQuery(event.target.value); setAnalysisLimit(PAGE_SIZE); if (analysisListRef.current) analysisListRef.current.scrollTop = 0; }} />
        <div className="bk-knowledge-analysis-summary"><Checkbox disabled={batchBusy || !visibleAnalysisBooks.length} checked={Boolean(visibleAnalysisBooks.length) && visibleAnalysisBooks.every(book => selectedBooks.includes(book.id))} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSelectedBooks(current => event.target.checked ? [...new Set([...current, ...visibleAnalysisBooks.map(book => book.id)])] : current.filter(id => !visibleAnalysisBooks.some(book => book.id === id)))}>选择已加载</Checkbox><span>已选 {selectedBooks.length} 本</span></div>
        <div className="bk-knowledge-analysis-list" ref={analysisListRef} role="region" aria-label="待分析书籍" tabIndex={0} onScroll={event => { const list = event.currentTarget; if (list.scrollHeight - list.scrollTop - list.clientHeight <= tokens.layout.touchTarget) setAnalysisLimit(current => Math.min(current + PAGE_SIZE, analysisBooks.length)); }}>{visibleAnalysisBooks.map(book => {
          const analysis = knowledge.find(item => item.bookId === book.id);
          return <div key={book.id} className="bk-knowledge-analysis-row"><Checkbox aria-label={`选择 ${book.title}`} checked={selectedBooks.includes(book.id)} disabled={batchBusy} onChange={(event: React.ChangeEvent<HTMLInputElement>) => toggleBook(book.id, event.target.checked)} /><span><strong>{book.title}</strong><small>{book.author}</small></span><small>{generating === book.id ? '分析中' : analysis?.status === 'READY' ? `${analysis.points.length} 个知识点 · ${analysis.sampledSections}/${analysis.totalSections} ${book.format === 'PDF' ? '页' : '章'}` : analysis?.status === 'FAILED' ? '分析失败' : '未分析'}</small></div>;
        })}{!analysisBooks.length && <Empty description="没有匹配书籍" />}</div>
        {generationError && <Alert type="error" showIcon title={generationError} />}
        {generationMessage && <Alert type="success" showIcon title={generationMessage} />}
        <Button type="primary" block loading={batchBusy} disabled={!selectedBooks.length || batchBusy} onClick={() => void analyzeSelection()}>开始分析</Button>
      </div>
    </Drawer>}
  </PageContainer>;
}
