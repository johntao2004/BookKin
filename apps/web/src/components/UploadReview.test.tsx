import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { api } from '../api/client';
import type { BookUpload } from '../domain/types';
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
  vi.spyOn(api, 'updateBookUploadMetadata').mockResolvedValue(upload);
  const commit = vi.spyOn(api, 'commitBookUpload').mockResolvedValue({...upload,status: 'SUCCEEDED'});
  const cancel = vi.fn().mockResolvedValue(undefined);
  render(<TestProviders><UploadReview upload={upload} onChanged={vi.fn()} onCommitted={vi.fn()} onCancel={cancel} /></TestProviders>);
  const toggle = screen.getByRole('switch', {name: '公开展示'});
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  if (!visible) fireEvent.click(toggle);
  expect(screen.queryByText('文件内置')).not.toBeInTheDocument();
  expect(screen.queryByText('hidden-original.pdf')).not.toBeInTheDocument();
  expect(screen.queryByText('sha256:private-fingerprint')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('目标路径')).not.toBeInTheDocument();
  const actions = screen.getByRole('button', {name: '重新在线补全'}).parentElement!;
  expect(within(actions).getByRole('button', {name: '取消本次上传'})).toHaveClass('ant-btn-dangerous');
  fireEvent.click(screen.getByRole('button', {name: '保存并完成'}));
  await waitFor(() => expect(commit).toHaveBeenCalledWith('upload-review', visible));
});

it('restores the public choice from a saved upload draft', () => {
  render(<TestProviders><UploadReview upload={{...upload, draftMetadata: {...upload.draftMetadata!, publiclyVisible: false}}} onChanged={vi.fn()} onCommitted={vi.fn()} /></TestProviders>);
  expect(screen.getByRole('switch', {name: '公开展示'})).toHaveAttribute('aria-checked', 'false');
});
