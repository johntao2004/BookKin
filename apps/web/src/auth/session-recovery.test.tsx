import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, RequireAuth, useAuth } from './AuthContext';
import { api } from '../api/client';
vi.mock('../api/client', () => ({ api: { isDemo: false, getSession: vi.fn(), login: vi.fn() } }));
const user = { id: 'owner', username: 'owner', displayName: 'Owner', role: 'OWNER' as const, mustChangePassword: false };
function Probe() {
  const auth = useAuth();
  return <><button onClick={() => void auth.login('owner', 'test')}>测试登录</button>
    <RequireAuth><p>私有书库</p></RequireAuth></>;
}
function mount() { return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter></QueryClientProvider>); }
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });
it('offers retry after session transport failure without mounting private content', async () => {
  vi.mocked(api.getSession).mockRejectedValueOnce(new Error('书库服务暂时不可用')).mockResolvedValueOnce(user);
  mount();
  fireEvent.click(await screen.findByRole('button', { name: '重试连接' }));
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
it('ignores demo identity in storage during a real session check', async () => {
  sessionStorage.setItem('bookkin-demo-session', JSON.stringify(user));
  vi.mocked(api.getSession).mockResolvedValue(null);
  mount();
  await screen.findByText('401 · 需要登录');
  expect(screen.queryByText('私有书库')).not.toBeInTheDocument();
});
