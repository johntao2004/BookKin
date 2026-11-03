// 测试失败可重试、迟到匿名响应与演示存储隔离，避免会话恢复覆盖后续登录。
// Tests retryable failures, late anonymous responses and demo-storage isolation so bootstrap cannot overwrite a later login.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, RequireAuth, useAuth } from './AuthContext';
import { SetupGate } from './SetupGate';
import { setupStatusQueryKey } from './setup-status';
import { api } from '../api/client';
vi.mock('../api/client', () => ({ api: { isDemo: false, getSession: vi.fn(), getSetupStatus: vi.fn(), login: vi.fn(), replayReadingProgress: vi.fn().mockResolvedValue(undefined), sessionStatus: vi.fn().mockImplementation(async()=>({expiresAt:Date.now()+86400000,serverTime:Date.now(),revocationRequested:false})), logout: vi.fn().mockResolvedValue(undefined) } }));
const user = { id: 'owner', username: 'owner', displayName: 'Owner', role: 'OWNER' as const, mustChangePassword: false };
function Probe() {
  const auth = useAuth();
  return <><button onClick={() => void auth.login('owner', 'test')}>测试登录</button>
    <RequireAuth><p>私有书库</p></RequireAuth></>;
}
function mount(client = new QueryClient()) { return render(<QueryClientProvider client={client}><MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter></QueryClientProvider>); }
function mountSetupFlow(client = new QueryClient()) {
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/library']}><AuthProvider><SetupGate><Routes>
    <Route path="/library" element={<RequireAuth><p>私有书库</p></RequireAuth>} />
    <Route path="/setup" element={<p>初始化</p>} />
  </Routes></SetupGate></AuthProvider></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });
it('offers retry after session transport failure without mounting private content', async () => {
  vi.mocked(api.getSession).mockRejectedValueOnce(new Error('书库服务暂时不可用')).mockResolvedValueOnce(user);
  mount();
  fireEvent.click(await screen.findByRole('button', { name: '重试' }));
  expect(screen.queryByText('私有书库')).not.toBeInTheDocument();
  expect(await screen.findByText('私有书库')).toBeInTheDocument();
});
it('does not let a late anonymous bootstrap overwrite a successful login', async () => {
  let resolve!: (value: null) => void;
  vi.mocked(api.getSession).mockReturnValue(new Promise(r => { resolve = r; }));
  vi.mocked(api.login).mockResolvedValue(user);
  mount();
  fireEvent.click(screen.getByRole('button', { name: '测试登录' }));
  await screen.findByText('私有书库');
  await act(async () => resolve(null));
  await waitFor(() => expect(screen.getByText('私有书库')).toBeInTheDocument());
});
it('keeps the anonymous setup-status cache while clearing other identity-scoped caches', async () => {
  const client = new QueryClient();
  const setupStatus = { initialized: true };
  client.setQueryData(setupStatusQueryKey, setupStatus);
  client.setQueryData(['books', 'private'], [{ id: 'previous-user-book' }]);
  client.getMutationCache().build(client, { mutationKey: ['private-write'], mutationFn: async () => undefined });
  vi.mocked(api.getSession).mockResolvedValue(null);
  vi.mocked(api.login).mockResolvedValue(user);

  mount(client);
  fireEvent.click(await screen.findByRole('button', { name: '测试登录' }));
  await screen.findByText('私有书库');

  expect(client.getQueryData(setupStatusQueryKey)).toEqual(setupStatus);
  expect(client.getQueryData(['books', 'private'])).toBeUndefined();
  expect(client.getMutationCache().getAll()).toHaveLength(0);
});
it('keeps the pending setup check alive while session restoration resolves first', async () => {
  let resolveSession!: (value: typeof user | null) => void;
  let resolveSetupStatus!: (value: { initialized: boolean }) => void;
  const getSetupStatus = vi.mocked(api.getSetupStatus);
  vi.mocked(api.getSession).mockReturnValue(new Promise(resolve => { resolveSession = resolve; }));
  getSetupStatus.mockReturnValue(new Promise(resolve => { resolveSetupStatus = resolve; }));

  mountSetupFlow();
  expect(await screen.findByRole('status', { name: '正在确认系统初始化状态' })).toBeInTheDocument();
  expect(getSetupStatus).toHaveBeenCalledTimes(1);

  await act(async () => resolveSession(user));
  expect(getSetupStatus).toHaveBeenCalledTimes(1);

  await act(async () => resolveSetupStatus({ initialized: true }));
  expect(await screen.findByText('私有书库')).toBeInTheDocument();
  expect(screen.queryByRole('status', { name: '正在确认系统初始化状态' })).not.toBeInTheDocument();
  expect(getSetupStatus).toHaveBeenCalledTimes(1);
});
it('ignores demo identity in storage during a real session check', async () => {
  sessionStorage.setItem('bookkin-demo-session', JSON.stringify(user));
  vi.mocked(api.getSession).mockResolvedValue(null);
  mount();
  await screen.findByRole("heading", {level: 1, name: "401"});
  expect(screen.queryByText('私有书库')).not.toBeInTheDocument();
});
