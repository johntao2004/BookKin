import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SilvaeThemeProvider } from '../theme/SilvaeThemeProvider';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import type { Book } from '../domain/types';
import { MingLibraryExperience, MING_LIBRARY_CHANNEL } from './MingLibraryExperience';
import { VIRTUAL_LIBRARY_BOOKS_QUERY_KEY } from './virtual-library-query';

const book: Book = {id: 'real-id', title: '真实馆藏', author: '作者', description: '', format: 'PDF',
  coverUrl: '/cover.png', status: 'AVAILABLE', progress: 0, addedAt: '', tags: [], libraryRoot: '', relativePath: '', fingerprint: ''};
const state = vi.hoisted(() => ({refresh: vi.fn(), publicRefresh: vi.fn()}));
vi.mock('./virtual-library-query', async original => ({
  ...await original<typeof import('./virtual-library-query')>(), refreshVirtualLibraryBooks: state.refresh, fetchPublicVirtualLibraryBooks: state.publicRefresh,
}));
function Location() { const location = useLocation(); return <output aria-label="当前路径">{location.pathname}</output>; }
function Logout() { const { logout } = useAuth(); return <button onClick={() => void logout()}>退出验证</button>; }
function renderScene() {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const view = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/virtual-library']}>
    <AuthProvider><SilvaeThemeProvider><MingLibraryExperience /><Location /><Logout /></SilvaeThemeProvider></AuthProvider>
  </MemoryRouter></QueryClientProvider>);
  return {...view, client};
}
async function sceneFrame() { return await screen.findByTitle('明式藏书楼三维场景') as HTMLIFrameElement; }
function message(frame: HTMLIFrameElement, data: object, origin = window.location.origin, source: Window | null = frame.contentWindow) {
  act(() => window.dispatchEvent(new MessageEvent('message', {origin, source, data: {channel: MING_LIBRARY_CHANNEL, ...data}})));
}
beforeEach(() => {
  sessionStorage.setItem("silvae-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false }));
  state.refresh.mockReset().mockResolvedValue({pages: [{items: [book]}], pageParams: [undefined]});
  state.publicRefresh.mockReset().mockResolvedValue({pages: [{items: [book]}], pageParams: [undefined]});
});
afterEach(() => sessionStorage.clear());

it('sends real complete snapshots only after its own local frame is ready', async () => {
  const {client} = renderScene();
  const frame = await sceneFrame();
  const post = vi.spyOn(frame.contentWindow!, 'postMessage');
  message(frame, {type: 'ready'}, 'https://foreign.example');
  message(frame, {type: 'ready'}, window.location.origin, window);
  expect(post).not.toHaveBeenCalled();
  message(frame, {type: 'ready'});
  await waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({type: 'catalog', books: [expect.objectContaining({id: 'real-id'})]}), window.location.origin));
  act(() => client.setQueryData([...VIRTUAL_LIBRARY_BOOKS_QUERY_KEY, "user-owner"], {pages: [{items: []}], pageParams: [undefined]}));
  await waitFor(() => expect(post).toHaveBeenLastCalledWith({channel: MING_LIBRARY_CHANNEL, type: 'catalog', books: [], view: null}, window.location.origin));
});

it('opens only currently accessible real book IDs and retains the reader return route', async () => {
  renderScene();
  const frame = await sceneFrame();
  message(frame, {type: 'read-book', bookId: 'unavailable-id'});
  expect(screen.getByLabelText('当前路径')).toHaveTextContent('/virtual-library');
  message(frame, {type: 'read-book', bookId: book.id});
  expect(screen.getByLabelText('当前路径')).toHaveTextContent('/reader/real-id');
});

it('does not mount the model or fall back to demo books when the real catalog fails', async () => {
  state.refresh.mockRejectedValue(new Error('真实服务不可用'));
  renderScene();
  expect(await screen.findByText('原因：真实服务不可用')).toBeInTheDocument();
  expect(screen.queryByTitle('明式藏书楼三维场景')).not.toBeInTheDocument();
});

it('cleans up its message listener on departure', async () => {
  const view = renderScene();
  const frame = await sceneFrame();
  const remove = vi.spyOn(window, 'removeEventListener');
  view.unmount();
  expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  message(frame, {type: 'back'});
});


it('uses only public shelves for anonymous visitors and returns to the public catalog', async () => {
  sessionStorage.clear();
  renderScene();
  const frame = await sceneFrame();
  expect(state.publicRefresh).toHaveBeenCalled();
  expect(state.refresh).not.toHaveBeenCalled();
  message(frame, {type: 'back'});
  expect(screen.getByLabelText('当前路径')).toHaveTextContent('/library');
});


it('replaces the private iframe on logout and rejects IDs outside the public snapshot', async () => {
  state.publicRefresh.mockResolvedValue({pages: [{items: [{...book, id: "public-id"}]}], pageParams: [undefined]});
  renderScene();
  const privateFrame = await sceneFrame();
  fireEvent.click(screen.getByRole('button', {name: '退出验证'}));
  await waitFor(() => expect(screen.getByTitle('明式藏书楼三维场景')).not.toBe(privateFrame));
  const publicFrame = await sceneFrame();
  message(publicFrame, {type: 'read-book', bookId: book.id});
  expect(screen.getByLabelText('当前路径')).toHaveTextContent('/virtual-library');
  message(publicFrame, {type: 'read-book', bookId: 'public-id'});
  expect(screen.getByLabelText('当前路径')).toHaveTextContent('/reader/public-id');
});
