import { act, render, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { api, DEFAULT_SITE_SETTINGS, type SiteSettings } from '../api/client';
import { AuthProvider } from '../auth/AuthContext';
import { BookKinThemeProvider } from '../theme/BookKinThemeProvider';
import { VirtualLibraryRoute } from './VirtualLibraryRoute';

const scene = vi.hoisted(() => ({imported: vi.fn(), mounted: vi.fn(), stopped: vi.fn()}));
vi.mock('./VirtualLibraryExperience', async () => {
  const {useEffect} = await import('react');
  scene.imported();
  return {VirtualLibraryExperience: function MockExperience() {
    useEffect(() => {scene.mounted(); return () => {scene.stopped();};}, []);
    return <div>Active 3D scene</div>;
  }};
});

function renderRoute(cached?: SiteSettings) {
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
  if (cached) client.setQueryData(['site-settings'], cached);
  const view = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/virtual-library']}>
    <AuthProvider><BookKinThemeProvider><Suspense fallback={<div>Loading scene</div>}><VirtualLibraryRoute /></Suspense></BookKinThemeProvider></AuthProvider>
  </MemoryRouter></QueryClientProvider>);
  return {...view, client};
}
afterEach(() => {vi.restoreAllMocks(); onlineManager.setOnline(true);});

it('waits for settings and never imports the scene when disabled', async () => {
  let resolve!: (value: SiteSettings) => void;
  vi.spyOn(api,'siteSettings').mockReturnValue(new Promise(done => {resolve=done;}));
  const imports = scene.imported.mock.calls.length;
  renderRoute();
  expect(screen.getByRole('status',{name:'正在读取虚拟书库设置'})).toBeInTheDocument();
  expect(scene.imported).toHaveBeenCalledTimes(imports);
  await act(async () => resolve({...DEFAULT_SITE_SETTINGS,virtualLibraryEnabled:false}));
  expect(await screen.findByRole('heading',{name:'虚拟书库未启用'})).toBeInTheDocument();
  expect(scene.imported).toHaveBeenCalledTimes(imports);
  expect(screen.getByRole('link',{name:'返回藏书库'})).toHaveAttribute('href','/library/all');
});

it('does not mount 3D when settings cannot be verified', async () => {
  vi.spyOn(api,'siteSettings').mockRejectedValue(new Error('offline'));
  const imports = scene.imported.mock.calls.length;
  renderRoute();
  expect(await screen.findByText('无法确认虚拟书库是否已启用，请稍后重试。')).toBeInTheDocument();
  expect(scene.imported).toHaveBeenCalledTimes(imports);
});

it('mounts only after enabling, retains the scene during revalidation and stops it on disable', async () => {
  const settings = vi.spyOn(api,'siteSettings').mockResolvedValue({...DEFAULT_SITE_SETTINGS,virtualLibraryEnabled:true});
  const {client} = renderRoute();
  expect(await screen.findByText('Active 3D scene')).toBeInTheDocument();
  const stopped = scene.stopped.mock.calls.length;
  let resolve!: (value: SiteSettings) => void;
  settings.mockReturnValue(new Promise(done => {resolve=done;}));
  act(() => {void client.invalidateQueries({queryKey:['site-settings']});});
  await waitFor(() => expect(client.isFetching()).toBe(1));
  expect(screen.getByText('Active 3D scene')).toBeInTheDocument();
  expect(scene.stopped).toHaveBeenCalledTimes(stopped);
  await act(async () => resolve({...DEFAULT_SITE_SETTINGS,virtualLibraryEnabled:false}));
  expect(await screen.findByRole('heading',{name:'虚拟书库未启用'})).toBeInTheDocument();
  expect(scene.stopped).toHaveBeenCalledTimes(stopped+1);
});

it('aborts a pending settings request when the route is left', async () => {
  let signal: AbortSignal | undefined;
  vi.spyOn(api,'siteSettings').mockImplementation(input => {
    signal=input;
    return new Promise((_resolve,reject) => input?.addEventListener('abort',()=>reject(new DOMException('closed','AbortError'))));
  });
  const view=renderRoute();
  await waitFor(() => expect(signal).toBeDefined());
  view.unmount();
  expect(signal?.aborted).toBe(true);
});


it('revalidates cached enabled settings before importing the scene on re-entry', async () => {
  let resolve!: (value: SiteSettings) => void;
  vi.spyOn(api,'siteSettings').mockReturnValue(new Promise(done => {resolve=done;}));
  const imports = scene.imported.mock.calls.length;
  renderRoute({...DEFAULT_SITE_SETTINGS,virtualLibraryEnabled:true});
  expect(screen.getByRole('status',{name:'正在读取虚拟书库设置'})).toBeInTheDocument();
  expect(screen.queryByText('Active 3D scene')).not.toBeInTheDocument();
  await act(async () => resolve({...DEFAULT_SITE_SETTINGS,virtualLibraryEnabled:false}));
  expect(await screen.findByRole('heading',{name:'虚拟书库未启用'})).toBeInTheDocument();
  expect(scene.imported).toHaveBeenCalledTimes(imports);
});

it('does not trust cached enablement while an offline entry cannot revalidate', async () => {
  onlineManager.setOnline(false);
  const request = vi.spyOn(api,'siteSettings').mockResolvedValue({...DEFAULT_SITE_SETTINGS});
  const view = renderRoute({...DEFAULT_SITE_SETTINGS,virtualLibraryEnabled:true});
  await act(async () => {await Promise.resolve();});
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole('status',{name:'正在读取虚拟书库设置'})).toBeInTheDocument();
  expect(screen.queryByText('Active 3D scene')).not.toBeInTheDocument();
  view.unmount();
});
