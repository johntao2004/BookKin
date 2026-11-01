import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { BookKinThemeProvider } from '../theme/BookKinThemeProvider';
import { AuthProvider } from '../auth/AuthContext';
import type { Book } from '../domain/types';
import { MingLibraryExperience, MING_LIBRARY_CHANNEL } from './MingLibraryExperience';
import { VIRTUAL_LIBRARY_BOOKS_QUERY_KEY } from './virtual-library-query';

const book: Book = {id: 'real-id', title: '真实馆藏', author: '作者', description: '', format: 'PDF',
  coverUrl: '/cover.png', status: 'AVAILABLE', progress: 0, addedAt: '', tags: [], libraryRoot: '', relativePath: '', fingerprint: ''};
const state = vi.hoisted(() => ({refresh: vi.fn()}));
vi.mock('./virtual-library-query', async original => ({
  ...await original<typeof import('./virtual-library-query')>(), refreshVirtualLibraryBooks: state.refresh,
}));
function Location() { const location = useLocation(); return <output aria-label="当前路径">{location.pathname}</output>; }
function renderScene() {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const view = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/virtual-library']}>
    <AuthProvider><BookKinThemeProvider><MingLibraryExperience /><Location /></BookKinThemeProvider></AuthProvider>
  </MemoryRouter></QueryClientProvider>);
  return {...view, client};
}
async function sceneFrame() { return await screen.findByTitle('明式藏书楼三维场景') as HTMLIFrameElement; }
function message(frame: HTMLIFrameElement, data: object, origin = window.location.origin, source: Window | null = frame.contentWindow) {
  act(() => window.dispatchEvent(new MessageEvent('message', {origin, source, data: {channel: MING_LIBRARY_CHANNEL, ...data}})));
}
beforeEach(() => { state.refresh.mockReset().mockResolvedValue({pages: [{items: [book]}], pageParams: [undefined]}); });

it('sends real complete snapshots only after its own local frame is ready', async () => {
  const {client} = renderScene();
  const frame = await sceneFrame();
  const post = vi.spyOn(frame.contentWindow!, 'postMessage');
  message(frame, {type: 'ready'}, 'https://foreign.example');
  message(frame, {type: 'ready'}, window.location.origin, window);
  expect(post).not.toHaveBeenCalled();
  message(frame, {type: 'ready'});
  await waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({type: 'catalog', books: [expect.objectContaining({id: 'real-id'})]}), window.location.origin));
  act(() => client.setQueryData(VIRTUAL_LIBRARY_BOOKS_QUERY_KEY, {pages: [{items: []}], pageParams: [undefined]}));
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
