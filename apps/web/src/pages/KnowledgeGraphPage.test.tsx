// 验证只有明确选书分析才发起生成，并覆盖成员限制、无伪造节点和抽屉懒加载。
// Checks explicit selected-book analysis, member restrictions, honest empty graphs and lazy drawer loading.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { NetworkGraphOptions } from '@ant-design/graphs';
import { api } from '../api/client';
import { articles } from '../features/content/api';
import type { Book, BookKnowledge } from '../domain/types';
import { TestProviders } from '../test/TestProviders';
import { KnowledgeGraphPage } from './KnowledgeGraphPage';

vi.mock('./KnowledgeNetwork', () => ({ KnowledgeNetwork: ({ options: props }: { options: NetworkGraphOptions }) => <div data-testid="knowledge-canvas">{props.data?.nodes?.map(node => <button key={node.id} onClick={() => {
  const handlers = new Map<string, (event: unknown) => void>();
  props.onReady?.({on: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler), fitView: () => undefined} as never);
  handlers.get('node:click')?.({target: {id: node.id}});
}}>{String(node.data?.label)}</button>)}</div> }));
const book = (id: string): Book => ({id, title: `书籍${id}`, author: '作者', description: '', tags: ['普通标签'], format: 'PDF', coverUrl: '/cover.jpg', progress: 0, addedAt: '', libraryRoot: '', relativePath: '', fingerprint: '', status: 'AVAILABLE'});
const points: BookKnowledge[] = [{bookId: 'a', status: 'READY', providerId: 'local', sampledSections: 1, totalSections: 10, generatedAt: '', points: [{name: '认知偏差', quote: '认知偏差会影响人们处理信息时的判断和决策。', locator: 'page:3'}]}];
beforeEach(() => {
  sessionStorage.setItem('bookkin-demo-session', JSON.stringify({id: 'owner', username: 'owner', displayName: '主人', role: 'OWNER'}));
  vi.spyOn(api, 'listBooks').mockResolvedValue({items: [book('a'), book('b')]});
  vi.spyOn(api, 'listBookKnowledge').mockResolvedValue(points);
  vi.spyOn(articles, 'knowledge').mockResolvedValue([]);
});
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });
it('keeps search and reset together and resets a selection made from a graph node', async () => {
  render(<TestProviders><KnowledgeGraphPage /></TestProviders>);
  const controls = screen.getByRole('group', {name: '搜索和视图操作'});
  expect(within(controls).getByRole('textbox', {name: '搜索知识点或书籍'})).toBeInTheDocument();
  expect(within(controls).getByRole('button', {name: '重置视图'})).toBeInTheDocument();
  expect(within(controls).queryByRole('button', {name: '分析书籍'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: /^知识点$/})).not.toBeInTheDocument();

  const canvas = await screen.findByTestId('knowledge-canvas');
  fireEvent.click(within(canvas).getByRole('button', {name: '认知偏差'}));
  expect(screen.getByRole('region', {name: '图谱筛选结果'})).toBeInTheDocument();
  fireEvent.click(within(controls).getByRole('button', {name: '重置视图'}));
  expect(screen.queryByRole('region', {name: '图谱筛选结果'})).not.toBeInTheDocument();
});

it('keeps an empty book graph empty without requesting article knowledge', async () => {
  vi.mocked(api.listBookKnowledge).mockResolvedValue([]);
  vi.mocked(articles.knowledge).mockResolvedValue([{id: 'article-only', title: '验收示例文章', points: JSON.stringify(points[0].points)}]);
  render(<TestProviders><KnowledgeGraphPage /></TestProviders>);
  expect(await screen.findByText('还没有正文知识点')).toBeInTheDocument();
  expect(articles.knowledge).not.toHaveBeenCalled();
  expect(screen.queryByTestId('knowledge-canvas')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', {name: '相关文章知识来源'})).not.toBeInTheDocument();
  expect(screen.queryByText('验收示例文章')).not.toBeInTheDocument();
});

it('limits concepts and related sources to accessible catalog books', async () => {
  vi.mocked(api.listBookKnowledge).mockResolvedValue([
    ...points,
    {...points[0], bookId: 'b'},
    {...points[0], bookId: 'outside-catalog', points: [{name: '其他来源知识', quote: '不在当前书目中的来源。', locator: 'page:1'}]},
  ]);
  vi.mocked(articles.knowledge).mockRejectedValue(new Error('article service unavailable'));
  render(<TestProviders><KnowledgeGraphPage /></TestProviders>);
  const canvas = await screen.findByTestId('knowledge-canvas');
  expect(within(canvas).getAllByRole('button')).toHaveLength(1);
  expect(within(canvas).queryByRole('button', {name: '其他来源知识'})).not.toBeInTheDocument();
  fireEvent.click(within(canvas).getByRole('button', {name: '认知偏差'}));
  const results = screen.getByRole('region', {name: '图谱筛选结果'});
  expect(within(results).getByText('2 本相关书籍')).toBeInTheDocument();
  expect(within(results).getByRole('link', {name: '书籍a'})).toHaveAttribute('href', '/reader/a');
  expect(within(results).getByRole('link', {name: '书籍b'})).toHaveAttribute('href', '/reader/b');
  expect(screen.queryByText('相关文章')).not.toBeInTheDocument();
  expect(screen.queryByText('文章知识来源加载失败')).not.toBeInTheDocument();
  expect(articles.knowledge).not.toHaveBeenCalled();
  expect(screen.getByText('单书知识点')).toBeInTheDocument();
  expect(screen.getByText('跨书知识点')).toBeInTheDocument();
  expect(screen.queryByText('连线表示同一本书中共现')).not.toBeInTheDocument();
});

it('shows related books only after choosing a concept and removes them on clear', async () => {
  render(<TestProviders><KnowledgeGraphPage /></TestProviders>);
  const canvas = await screen.findByTestId('knowledge-canvas');
  expect(screen.queryByRole('region', {name: '图谱筛选结果'})).not.toBeInTheDocument();
  expect(screen.queryByText('藏书与正文分析')).not.toBeInTheDocument();
  fireEvent.click(within(canvas).getByRole('button', {name: '认知偏差'}));
  const results = screen.getByRole('region', {name: '图谱筛选结果'});
  expect(within(results).getByRole('heading', {name: '书籍a'})).toBeInTheDocument();
  expect(within(results).queryByRole('heading', {name: '书籍b'})).not.toBeInTheDocument();
  expect(within(results).getByRole('link', {name: '查看原文 · page:3'})).toHaveAttribute('href', '/reader/a?locator=pdf%3Apage%3D3');
  fireEvent.click(screen.getByRole('button', {name: '清除筛选'}));
  expect(screen.queryByRole('region', {name: '图谱筛选结果'})).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', {name: '书籍b'})).not.toBeInTheDocument();
});
it('shows an honest empty state and surfaces provider errors without fake nodes', async () => {
  vi.mocked(api.listBookKnowledge).mockResolvedValue([]);
  vi.spyOn(api, 'generateBookKnowledge').mockRejectedValue(new Error('请先配置 AI 平台'));
  render(<TestProviders><KnowledgeGraphPage /></TestProviders>);
  expect(await screen.findByText('还没有正文知识点')).toBeInTheDocument();
  expect(screen.queryByTestId('knowledge-canvas')).not.toBeInTheDocument();
  expect(screen.queryByText('书籍a')).not.toBeInTheDocument();
  expect(screen.queryByText('书籍b')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: '提取正文知识点'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: '分析书籍'}));
  fireEvent.click(await screen.findByRole('checkbox', {name: '选择 书籍a'}));
  fireEvent.click(screen.getByRole('button', {name: '开始分析'}));
  expect(await screen.findByText('1 本分析失败：请先配置 AI 平台')).toBeInTheDocument();
  await waitFor(() => expect(api.generateBookKnowledge).toHaveBeenCalledWith('a'));
});
it('members can explore knowledge but cannot invoke paid generation', async () => {
  sessionStorage.setItem('bookkin-demo-session', JSON.stringify({id: 'member', role: 'MEMBER'}));
  render(<TestProviders><KnowledgeGraphPage /></TestProviders>);
  await screen.findByTestId('knowledge-canvas');
  expect(screen.queryByRole('button', {name: '分析书籍'})).not.toBeInTheDocument();
});

it('opens a compact analysis drawer without sending body text until explicit selection and action', async () => {
  const generate = vi.spyOn(api, 'generateBookKnowledge').mockResolvedValue(points);
  render(<TestProviders><KnowledgeGraphPage /></TestProviders>);
  await screen.findByTestId('knowledge-canvas');
  fireEvent.click(screen.getByRole('button', {name: '分析书籍'}));
  expect(await screen.findByRole('checkbox', {name: '选择 书籍a'})).toBeInTheDocument();
  expect(generate).not.toHaveBeenCalled();
  expect(screen.getByRole('button', {name: '开始分析'})).toBeDisabled();
  expect(screen.queryByText(/分析会将部分正文发送至已配置的 AI 平台/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', {name: '选择已加载'}));
  fireEvent.click(screen.getByRole('button', {name: '开始分析'}));
  await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
  expect(generate.mock.calls.map(call => call[0])).toEqual(['a', 'b']);
});

it('appends books on reaching the bottom and resets the loaded batch on search', async () => {
  vi.mocked(api.listBooks).mockResolvedValue({items: Array.from({length: 55}, (_, index) => book(String(index)))});
  render(<TestProviders><KnowledgeGraphPage /></TestProviders>);
  fireEvent.click(screen.getByRole('button', {name: '分析书籍'}));
  const list = await screen.findByRole('region', {name: '待分析书籍'});
  expect(await within(list).findAllByRole('checkbox')).toHaveLength(24);
  expect(screen.queryByRole('list', {name: /pagination/i})).not.toBeInTheDocument();
  fireEvent.scroll(list, {target: {scrollTop: 600}});
  expect(within(list).getAllByRole('checkbox')).toHaveLength(48);
  fireEvent.scroll(list, {target: {scrollTop: 1200}});
  expect(within(list).getAllByRole('checkbox')).toHaveLength(55);
  fireEvent.change(screen.getByRole('textbox', {name: '搜索待分析书籍'}), {target: {value: '书籍1'}});
  expect(within(list).getAllByRole('checkbox').length).toBeLessThanOrEqual(24);
  expect(list.scrollTop).toBe(0);
});
