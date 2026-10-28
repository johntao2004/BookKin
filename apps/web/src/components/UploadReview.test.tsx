// 验证上传草稿恢复时保留已保存的公开选择，避免重新加载后悄悄改变可见性。
// Checks restored upload drafts retain saved visibility rather than silently resetting it.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { api } from '../api/client';
import type { BookKnowledgeDraft, BookUpload } from '../domain/types';
import { TestProviders } from '../test/TestProviders';
import { UploadReview } from './BookUploadDialog';
const upload: BookUpload = {
  id: 'upload-review', libraryRootId: 'root', libraryRootName: '主书库', originalFilename: 'hidden-original.pdf',
  format: 'PDF', declaredSizeBytes: 1600000, receivedBytes: 1600000, fingerprint: 'sha256:private-fingerprint', status: 'READY_FOR_REVIEW',
  encrypted: false, drmProtected: false, digitallySigned: false, metadataCandidates: [], similarBookIds: [],
  expiresAt: '', createdAt: '', updatedAt: '', coverUrl: '/cover.jpg',
  draftMetadata: { title: '测试书籍', authors: ['作者'], translators: [], tags: [], targetPath: '作者/测试书籍.pdf', pageCount: 63, sources: {title: 'FILE'} },
};
afterEach(() => vi.restoreAllMocks());
it.each([true, false])('defaults to public, respects the per-book switch (%s), and keeps technical metadata out of the form', async visible => {
  const update = vi.spyOn(api, 'updateBookUploadMetadata').mockResolvedValue(upload);
  const commit = vi.spyOn(api, 'commitBookUpload').mockResolvedValue({...upload,status: 'SUCCEEDED'});
  const cancel = vi.fn().mockResolvedValue(undefined);
  const onCommitted = vi.fn(async () => undefined);
  render(<TestProviders><UploadReview upload={upload} onChanged={vi.fn()} onCommitted={onCommitted} onCancel={cancel} /></TestProviders>);
  const toggle = screen.getByRole('switch', {name: '公开展示'});
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  const cover = screen.getByRole('img', {name: '测试书籍封面'});
  const title = screen.getByRole('textbox', {name: '书名'});
  expect(title.tagName).toBe('TEXTAREA');
  expect(Boolean(cover.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  const authors = screen.getByRole('textbox', {name: '作者'});
  const commitAction = screen.getByRole('button', {name: '确认入库'});
  expect(screen.getByRole('region', {name: '书目资料'})).toBeInTheDocument();
  expect(screen.getAllByRole('button', {name: '确认入库'})).toHaveLength(1);
  expect(Boolean(authors.compareDocumentPosition(commitAction) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  expect(Boolean(screen.getByRole('textbox', {name: '作者介绍'}).compareDocumentPosition(commitAction) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  expect(screen.getByRole('textbox', {name: '内容简介'})).toBeInTheDocument();
  expect(screen.getByRole('textbox', {name: '作者介绍'})).toBeInTheDocument();
  expect(screen.queryByRole('textbox', {name: '目录'})).not.toBeInTheDocument();
  if (!visible) fireEvent.click(toggle);
  expect(screen.queryByText('文件内置')).not.toBeInTheDocument();
  expect(screen.queryByText('hidden-original.pdf')).not.toBeInTheDocument();
  expect(screen.queryByText('sha256:private-fingerprint')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('目标路径')).not.toBeInTheDocument();
  const actions = screen.getByRole('button', {name: '在线匹配'}).parentElement!;
  expect(within(actions).getByRole('button', {name: '取消上传'})).toHaveClass('ant-btn-dangerous');
  fireEvent.click(screen.getByRole('button', {name: '确认入库'}));
  await waitFor(() => expect(commit).toHaveBeenCalledWith('upload-review', visible));
  if (visible) expect(update).not.toHaveBeenCalled();
  else expect(update).toHaveBeenCalledWith('upload-review', expect.objectContaining({publiclyVisible: false}), undefined);
  expect(onCommitted).toHaveBeenCalledWith({...upload, status: 'SUCCEEDED'});
});

it('restores the public choice from a saved upload draft', () => {
  render(<TestProviders><UploadReview upload={{...upload, draftMetadata: {...upload.draftMetadata!, publiclyVisible: false}}} onChanged={vi.fn()} onCommitted={vi.fn()} /></TestProviders>);
  expect(screen.getByRole('switch', {name: '公开展示'})).toHaveAttribute('aria-checked', 'false');
});

it('automatically saves edits and has no save-draft button', async () => {
  const update = vi.spyOn(api, 'updateBookUploadMetadata').mockResolvedValue(upload);
  const onChanged = vi.fn();
  render(<TestProviders><UploadReview upload={upload} onChanged={onChanged} onCommitted={vi.fn()} /></TestProviders>);

  expect(screen.queryByRole('button', {name: '保存草稿'})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('书名'), {target: {value: '自动保存标题'}});

  await waitFor(() => expect(update).toHaveBeenCalledTimes(1), {timeout: 2500});
  expect(update).toHaveBeenCalledWith('upload-review', expect.objectContaining({title: '自动保存标题'}), undefined);
  expect(onChanged).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('草稿已自动保存');
});

it('serializes quick edits and ignores stale upload props and save responses', async () => {
  let resolveFirst!: (value: BookUpload) => void;
  const firstResponse = new Promise<BookUpload>(resolve => { resolveFirst = resolve; });
  const snapshots: string[] = [];
  const update = vi.spyOn(api, 'updateBookUploadMetadata').mockImplementation((_id, draft) => {
    snapshots.push(draft.title);
    return snapshots.length === 1 ? firstResponse : Promise.resolve({...upload, draftMetadata: draft});
  });
  const onChanged = vi.fn();
  const rendered = (book: BookUpload) => <TestProviders><UploadReview upload={book} onChanged={onChanged} onCommitted={vi.fn()} /></TestProviders>;
  const {rerender} = render(rendered(upload));
  const title = screen.getByLabelText('书名');
  fireEvent.change(title, {target: {value: '第一次输入'}});
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1), {timeout: 2500});

  fireEvent.change(title, {target: {value: '最新输入'}});
  rerender(rendered({...upload, draftMetadata: {...upload.draftMetadata!, title: '旧服务器值'}}));
  resolveFirst({...upload, draftMetadata: {...upload.draftMetadata!, title: '第一次输入'}});

  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByLabelText('书名')).toHaveValue('最新输入'));
  expect(snapshots).toEqual(['第一次输入', '最新输入']);
  expect(onChanged).not.toHaveBeenCalled();
});

it('keeps the draft after a save failure and offers retry', async () => {
  const update = vi.spyOn(api, 'updateBookUploadMetadata')
    .mockRejectedValueOnce(new Error('网络失败'))
    .mockResolvedValueOnce(upload);
  render(<TestProviders><UploadReview upload={upload} onChanged={vi.fn()} onCommitted={vi.fn()} /></TestProviders>);

  fireEvent.change(screen.getByLabelText('书名'), {target: {value: '待重试标题'}});
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('草稿保存失败：网络失败'), {timeout: 2500});
  expect(screen.getByLabelText('书名')).toHaveValue('待重试标题');
  fireEvent.click(screen.getByRole('button', {name: '重试保存'}));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('草稿已自动保存'));
  expect(update.mock.calls[1]?.[1].title).toBe('待重试标题');
});

it('flushes the latest draft before cancellation', async () => {
  const events: string[] = [];
  const update = vi.spyOn(api, 'updateBookUploadMetadata').mockImplementation(async () => { events.push('draft'); return upload; });
  const cancel = vi.fn(async () => { events.push('cancel'); });
  render(<TestProviders><UploadReview upload={upload} onChanged={vi.fn()} onCommitted={vi.fn()} onCancel={cancel} /></TestProviders>);

  fireEvent.change(screen.getByLabelText('书名'), {target: {value: '确认前标题'}});
  fireEvent.click(screen.getByRole('button', {name: '取消上传'}));
  await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
  expect(events).toEqual(['draft', 'cancel']);
  expect(update.mock.calls[0]?.[1].title).toBe('确认前标题');
});

it('flushes before commit, passes the commit result, and stops autosaving after success', async () => {
  const events: string[] = [];
  const update = vi.spyOn(api, 'updateBookUploadMetadata').mockImplementation(async () => { events.push('draft'); return upload; });
  const committed = {...upload, status: 'SUCCEEDED' as const};
  const commit = vi.spyOn(api, 'commitBookUpload').mockImplementation(async () => { events.push('commit'); return committed; });
  const onCommitted = vi.fn(async (result: BookUpload) => { events.push('callback'); expect(result).toBe(committed); });
  render(<TestProviders><UploadReview upload={upload} onChanged={vi.fn()} onCommitted={onCommitted} onCancel={vi.fn()} /></TestProviders>);

  fireEvent.change(screen.getByLabelText('书名'), {target: {value: '最终确认标题'}});
  fireEvent.click(screen.getByRole('button', {name: '确认入库'}));
  await waitFor(() => expect(onCommitted).toHaveBeenCalledTimes(1));
  expect(events.slice(-3)).toEqual(['draft', 'commit', 'callback']);
  expect(update.mock.calls.at(-1)?.[1].title).toBe('最终确认标题');
  expect(screen.getByLabelText('书名')).toBeDisabled();
  expect(screen.getByRole('button', {name: '已入库'})).toBeDisabled();
  expect(screen.getByRole('button', {name: '在线匹配'})).toBeDisabled();
  expect(screen.getByRole('button', {name: '取消上传'})).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('已确认入库');
  await new Promise(resolve => window.setTimeout(resolve, 550));
  expect(update).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledTimes(1);
});

it('persists the selected knowledge draft before committing an upload', async () => {
  const first = { name: '待移除知识点', quote: '第一条原文证据。', locator: 'page:2' };
  const second = { name: '保留知识点', quote: '第二条原文证据。', locator: 'page:5' };
  const initialKnowledge: BookKnowledgeDraft = { points: [first, second], fingerprint: 'sha256:upload-content', sampledSections: 3, totalSections: 8 };
  const savedKnowledge: BookKnowledgeDraft = { ...initialKnowledge, points: [second] };
  const knowledgeUpload = { ...upload, draftMetadata: { ...upload.draftMetadata!, knowledgeDraft: initialKnowledge } };
  const savedUpload = { ...knowledgeUpload, draftMetadata: { ...knowledgeUpload.draftMetadata!, knowledgeDraft: savedKnowledge } };
  const committed = { ...savedUpload, status: 'SUCCEEDED' as const };
  const update = vi.spyOn(api, 'updateBookUploadMetadata').mockResolvedValue(savedUpload);
  const commit = vi.spyOn(api, 'commitBookUpload').mockResolvedValue(committed);
  const onCommitted = vi.fn(async () => undefined);
  render(<TestProviders><UploadReview upload={knowledgeUpload} onChanged={vi.fn()} onCommitted={onCommitted} /></TestProviders>);

  await screen.findByText(first.name);
  const knowledgeSelect = screen.getByRole('combobox', {name: '知识点'}).closest('.ant-select')!;
  const firstChip = [...knowledgeSelect.querySelectorAll('.ant-select-selection-item')].find(item => item.textContent?.includes(first.name));
  const remove = firstChip?.querySelector('.ant-select-selection-item-remove');
  expect(remove).toBeTruthy();
  fireEvent.mouseDown(remove!);
  fireEvent.click(remove!);
  await waitFor(() => expect(screen.queryByText(first.name)).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', {name: '确认入库'}));
  await waitFor(() => expect(onCommitted).toHaveBeenCalledExactlyOnceWith(committed));
  expect(update).toHaveBeenCalledWith('upload-review', expect.objectContaining({knowledgeDraft: savedKnowledge}), undefined);
  expect(update.mock.invocationCallOrder[0]).toBeLessThan(commit.mock.invocationCallOrder[0]!);
  expect(commit).toHaveBeenCalledExactlyOnceWith('upload-review', true);
});

it('keeps the same metadata form visible but read-only for a succeeded upload', () => {
  render(<TestProviders><UploadReview upload={{...upload, status: 'SUCCEEDED'}} onChanged={vi.fn()} onCommitted={vi.fn()} onCancel={vi.fn()} /></TestProviders>);
  expect(screen.getByLabelText('书名')).toHaveValue('测试书籍');
  expect(screen.getByLabelText('书名')).toBeDisabled();
  expect(screen.getByRole('button', {name: '已入库'})).toBeDisabled();
  expect(screen.getByRole('button', {name: '在线匹配'})).toBeDisabled();
  expect(screen.getByRole('button', {name: '取消上传'})).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('已确认入库');
});

const metadataCandidate = {
  id: 'candidate-1', provider: 'OPEN_LIBRARY' as const, providerLabel: 'Open Library', title: '远端匹配候选', authors: ['候选作者'],
  publisher: '候选出版社', publishedDate: '2024', isbn: '9780000000001', edition: '第2版', language: '中文',
  sourceUrl: 'https://openlibrary.org/works/OL1W', description: '候选简介', tags: ['候选标签'], coverUrl: '/candidate-cover.jpg',
};
function resultDialog(title: string) {
  const heading = screen.getByRole('heading', {name: title});
  const dialog = heading.closest<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error(`未找到“${title}”弹窗`);
  return dialog;
}
function closeResultDialog(dialog: HTMLElement) {
  const closeButtons = within(dialog).getAllByRole('button', {name: '关闭'});
  if (closeButtons.length !== 1) throw new Error('在线匹配结果应只保留右上角关闭按钮');
  fireEvent.click(closeButtons[0]!);
}

it('shows readable names for all candidate languages without exposing their codes', () => {
  render(<TestProviders><UploadReview upload={{...upload, metadataCandidates: [{...metadataCandidate, language: 'zh-CN,en-US'}]}} onChanged={vi.fn()} onCommitted={vi.fn()} /></TestProviders>);
  fireEvent.click(screen.getByRole('button', {name: '在线匹配（1）'}));
  const dialog = resultDialog('在线匹配结果');
  expect(within(dialog).getByText('语言：中文、英文')).toBeInTheDocument();
  expect(within(dialog).queryByText(/zh-CN|en-US/)).not.toBeInTheDocument();
});

it('uses one online matching entry, keeps candidate actions ordered, and closes by X without adopting', () => {
  const match = vi.spyOn(api, 'matchBookUpload');
  const update = vi.spyOn(api, 'updateBookUploadMetadata');
  render(<TestProviders><UploadReview upload={{...upload, metadataCandidates: [metadataCandidate]}} onChanged={vi.fn()} onCommitted={vi.fn()} /></TestProviders>);

  expect(screen.getByRole('button', {name: '在线匹配（1）'})).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: '在线补全'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'AI 匹配'})).not.toBeInTheDocument();
  expect(screen.queryByText('远端匹配候选')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: '在线匹配（1）'}));
  let dialog = resultDialog('在线匹配结果');
  expect(within(dialog).getByText('远端匹配候选')).toBeInTheDocument();
  const dialogActions = dialog.querySelector<HTMLElement>('.bk-dialog-actions');
  if (!dialogActions) throw new Error('结果弹窗缺少底部操作区');
  const refreshButton = within(dialogActions).getByRole('button', {name: '重新匹配'});
  expect(refreshButton).toHaveClass('bk-button-outlined');
  expect(within(dialogActions).queryByRole('button', {name: '关闭'})).not.toBeInTheDocument();
  const coverButton = within(dialog).getByRole('button', {name: '采用封面'});
  const useButton = within(dialog).getByRole('button', {name: '使用此版本：远端匹配候选'});
  expect(coverButton).toHaveClass('bk-button-outlined');
  expect(useButton).toHaveClass('bk-button-contained');
  expect(Array.from(coverButton.parentElement!.querySelectorAll('button')).map(button => button.textContent?.trim()))
    .toEqual(['采用封面', '使用此版本']);
  for (const detail of ['作者：候选作者', '出版社：候选出版社', '出版日期：2024年', 'ISBN：9780000000001', '版次：第2版', '语言：中文']) {
    expect(within(dialog).getByText(detail)).toBeInTheDocument();
  }
  expect(within(dialog).queryByRole('link', {name: '查看来源'})).not.toBeInTheDocument();
  expect(within(dialog).queryByText('来源：Open Library')).not.toBeInTheDocument();
  closeResultDialog(dialog);
  expect(screen.queryByRole('heading', {name: '在线匹配结果'})).not.toBeInTheDocument();
  expect(screen.queryByText('远端匹配候选')).not.toBeInTheDocument();
  expect(screen.getByLabelText('书名')).toHaveValue('测试书籍');
  expect(update).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', {name: '在线匹配（1）'}));
  dialog = resultDialog('在线匹配结果');
  expect(within(dialog).getByText('远端匹配候选')).toBeInTheDocument();
  expect(match).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

it.each([
  ['MATCH_FAILED', '在线匹配暂时不可用，可稍后重试。', [metadataCandidate]],
  ['MATCH_PARTIAL', '部分来源暂不可用，已有候选仍可选择。', [metadataCandidate]],
  ['MATCH_NO_RESULTS', '未找到匹配的版本，可修改书目资料后重试。', []],
] as const)('restores saved %s feedback when reopening a persisted upload', (errorCode, errorDetail, candidates) => {
  const match = vi.spyOn(api, 'matchBookUpload');
  render(<TestProviders><UploadReview upload={{...upload, metadataCandidates: [...candidates], errorCode, errorDetail}} onChanged={vi.fn()} onCommitted={vi.fn()} /></TestProviders>);

  fireEvent.click(screen.getByRole('button', {name: candidates.length ? '在线匹配（1）' : '在线匹配'}));
  const dialog = resultDialog('在线匹配结果');
  expect(within(dialog).getByRole('alert')).toHaveTextContent(errorDetail);
  if (candidates.length) expect(within(dialog).getByText('远端匹配候选')).toBeInTheDocument();
  expect(match).not.toHaveBeenCalled();
});

it('first matching uses the cached-result path and a late response does not reopen a closed dialog', async () => {
  let resolveMatch!: (result: BookUpload) => void;
  const match = vi.spyOn(api, 'matchBookUpload').mockReturnValue(new Promise(resolve => { resolveMatch = resolve; }));
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(<TestProviders><UploadReview upload={upload} onChanged={onChanged} onCommitted={vi.fn()} /></TestProviders>);

  fireEvent.click(screen.getByRole('button', {name: '在线匹配'}));
  const dialog = resultDialog('在线匹配结果');
  expect(within(dialog).getByText('正在在线匹配…')).toBeInTheDocument();
  await waitFor(() => expect(match).toHaveBeenCalledWith('upload-review', {refresh: false}));
  closeResultDialog(dialog);
  expect(screen.queryByRole('heading', {name: '在线匹配结果'})).not.toBeInTheDocument();

  resolveMatch({...upload, metadataCandidates: [metadataCandidate]});
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('heading', {name: '在线匹配结果'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: '在线匹配（1）'}));
  expect(within(resultDialog('在线匹配结果')).getByText('远端匹配候选')).toBeInTheDocument();
});

it('compares multiple editions without changing the draft, then adopts and immediately saves the selected candidate', async () => {
  const update = vi.spyOn(api, 'updateBookUploadMetadata').mockImplementation(async (_id, draft) => ({...upload, draftMetadata: draft}));
  const secondCandidate = {...metadataCandidate, id: 'candidate-2', title: '另一版候选', edition: '第3版', publishedDate: '2025'};
  const originalTitle = upload.draftMetadata!.title;
  render(<TestProviders><UploadReview upload={{...upload, draftMetadata: {...upload.draftMetadata!, publiclyVisible: false}, metadataCandidates: [metadataCandidate, secondCandidate]}} onChanged={vi.fn()} onCommitted={vi.fn()} /></TestProviders>);

  fireEvent.click(screen.getByRole('button', {name: '在线匹配（2）'}));
  const dialog = resultDialog('在线匹配结果');
  expect(within(dialog).getByText('另一版候选')).toBeInTheDocument();
  expect(within(dialog).getByText('版次：第3版')).toBeInTheDocument();
  expect(within(dialog).getByText('出版日期：2025年')).toBeInTheDocument();
  expect(screen.getByLabelText('书名')).toHaveValue(originalTitle);
  expect(screen.getByRole('switch', {name: '公开展示'})).toHaveAttribute('aria-checked', 'false');
  expect(update).not.toHaveBeenCalled();
  expect(within(dialog).getAllByRole('button', {name: /使用此版本/})[0]).toBeEnabled();
  fireEvent.click(within(dialog).getAllByRole('button', {name: /使用此版本/})[0]!);

  await waitFor(() => expect(update).toHaveBeenCalledWith('upload-review', expect.objectContaining({title: '远端匹配候选', language: '中文', isbn: '9780000000001', publiclyVisible: false}), undefined));
  await waitFor(() => expect(screen.getByLabelText('书名')).toHaveValue('远端匹配候选'));
  expect(screen.getByRole('switch', {name: '公开展示'})).toHaveAttribute('aria-checked', 'false');
  expect(update.mock.calls.at(-1)?.[1].sources.title).toBe('OPEN_LIBRARY');
  expect(screen.queryByRole('heading', {name: '在线匹配结果'})).not.toBeInTheDocument();
});

it('flushes before adopting a candidate cover and closes on success', async () => {
  vi.spyOn(api, 'selectBookUploadCover').mockResolvedValue(upload);
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(<TestProviders><UploadReview upload={{...upload, metadataCandidates: [metadataCandidate]}} onChanged={onChanged} onCommitted={vi.fn()} /></TestProviders>);

  fireEvent.click(screen.getByRole('button', {name: '在线匹配（1）'}));
  fireEvent.click(within(resultDialog('在线匹配结果')).getByRole('button', {name: '采用封面'}));
  await waitFor(() => expect(api.selectBookUploadCover).toHaveBeenCalledWith('upload-review', 'candidate-1'));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('heading', {name: '在线匹配结果'})).not.toBeInTheDocument();
});

it('keeps the result dialog open when candidate cover adoption fails', async () => {
  vi.spyOn(api, 'selectBookUploadCover').mockRejectedValue(new Error('封面下载失败'));
  render(<TestProviders><UploadReview upload={{...upload, metadataCandidates: [metadataCandidate]}} onChanged={vi.fn()} onCommitted={vi.fn()} /></TestProviders>);

  fireEvent.click(screen.getByRole('button', {name: '在线匹配（1）'}));
  const dialog = resultDialog('在线匹配结果');
  fireEvent.click(within(dialog).getByRole('button', {name: '采用封面'}));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('封面下载失败');
  expect(screen.getByRole('heading', {name: '在线匹配结果'})).toBeInTheDocument();
  expect(within(resultDialog('在线匹配结果')).getByText('远端匹配候选')).toBeInTheDocument();
});

it('refreshes with refresh=true, keeps prior candidates visible on failure, and offers a retry', async () => {
  let rejectRefresh!: (reason: Error) => void;
  const refreshedCandidate = {...metadataCandidate, id: 'candidate-refreshed', title: '重新匹配后的版本'};
  const match = vi.spyOn(api, 'matchBookUpload')
    .mockResolvedValueOnce({...upload, metadataCandidates: [metadataCandidate]})
    .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectRefresh = reject; }))
    .mockResolvedValueOnce({...upload, metadataCandidates: [refreshedCandidate]});
  render(<TestProviders><UploadReview upload={upload} onChanged={vi.fn().mockResolvedValue(undefined)} onCommitted={vi.fn()} /></TestProviders>);

  fireEvent.click(screen.getByRole('button', {name: '在线匹配'}));
  const dialog = resultDialog('在线匹配结果');
  await waitFor(() => expect(within(resultDialog('在线匹配结果')).getByText('远端匹配候选')).toBeInTheDocument());
  await waitFor(() => expect(within(dialog).getByRole('button', {name: '重新匹配'})).toBeEnabled());
  fireEvent.click(within(dialog).getByRole('button', {name: '重新匹配'}));
  await waitFor(() => expect(match).toHaveBeenNthCalledWith(2, 'upload-review', {refresh: true}));
  expect(within(dialog).getByRole('button', {name: '正在匹配…'})).toBeDisabled();
  expect(within(dialog).getByText('远端匹配候选')).toBeInTheDocument();
  await act(async () => rejectRefresh(new Error('刷新失败')));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('刷新失败');
  expect(within(dialog).getByRole('button', {name: '重试匹配'})).toBeEnabled();
  expect(within(dialog).getByText('远端匹配候选')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', {name: '重试匹配'}));
  await waitFor(() => expect(match).toHaveBeenNthCalledWith(3, 'upload-review', {refresh: true}));
  expect(await within(dialog).findByText('重新匹配后的版本')).toBeInTheDocument();
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
});

it('shows empty candidate fields as unavailable and preserves manual fields when using a version', async () => {
  const manualDraft = {...upload.draftMetadata!, title: '手工书名', publisher: '手工出版社', sources: {title: 'MANUAL' as const, publisher: 'MANUAL' as const}};
  const update = vi.spyOn(api, 'updateBookUploadMetadata').mockImplementation(async (_id, draft) => ({...upload, draftMetadata: draft}));
  render(<TestProviders><UploadReview upload={{...upload, draftMetadata: manualDraft, metadataCandidates: [{id: 'minimal', provider: 'WIKIDATA', title: '候选标题', publisher: '候选出版社'}]}} onChanged={vi.fn()} onCommitted={vi.fn()} /></TestProviders>);

  fireEvent.click(screen.getByRole('button', {name: '在线匹配（1）'}));
  const dialog = resultDialog('在线匹配结果');
  expect(within(dialog).getByText('作者：未提供')).toBeInTheDocument();
  expect(within(dialog).getByText('版次：未提供')).toBeInTheDocument();
  expect(within(dialog).getByText('语言：未提供')).toBeInTheDocument();
  expect(within(dialog).queryByText('来源：Wikidata')).not.toBeInTheDocument();
  expect(within(dialog).getByRole('note')).toHaveTextContent('书名、出版社');
  fireEvent.click(within(dialog).getByRole('button', {name: /使用此版本/}));

  await waitFor(() => expect(update).toHaveBeenCalledWith('upload-review', expect.objectContaining({title: '手工书名', publisher: '手工出版社'}), undefined));
  await waitFor(() => expect(screen.getByText(/已使用此版本并保存；以下手工字段已保留：书名、出版社/)).toBeInTheDocument());
  expect(update.mock.calls.at(-1)?.[1].sources.title).toBe('MANUAL');
  expect(update.mock.calls.at(-1)?.[1].sources.publisher).toBe('MANUAL');
});
