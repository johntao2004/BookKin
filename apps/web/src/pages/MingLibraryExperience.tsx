import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiRequestError } from '../api/errors';
import { Button } from '../ui/buttons';
import { Alert, CircularProgress } from '../ui/feedback';
import { RequestErrorPage } from './HttpErrorPage';
import { mingLibraryCatalog } from './ming-library-catalog';
import { readMingLibraryReaderState, readMingLibraryView } from './ming-library-view';
import {
  refreshVirtualLibraryBooks, virtualLibraryBooksQueryKey, fetchPublicVirtualLibraryBooks, PUBLIC_VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
  VIRTUAL_LIBRARY_BOOKS_REFRESH_INTERVAL, VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
} from './virtual-library-query';
import './ming-library.css';

export const MING_LIBRARY_CHANNEL = 'bookkin:ming-library';

/** Keep the imported scene local and connect its documented catalog API to the visible catalog. */
export function MingLibraryExperience() {
  const navigate = useNavigate();
  const { user, ready: authReady } = useAuth();
  const libraryReturn = user ? "/library/all" : "/library";
  const audience = user?.id ?? "anonymous";
  const location = useLocation();
  const restoredView = useRef(readMingLibraryReaderState(location.state)?.mingLibraryView ?? null);
  const queryClient = useQueryClient();
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const query = useQuery({
    queryKey: user ? virtualLibraryBooksQueryKey(user.id) : PUBLIC_VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
    queryFn: ({signal}) => user ? refreshVirtualLibraryBooks(queryClient, signal, user.id) : fetchPublicVirtualLibraryBooks(signal),
    enabled: authReady,
    staleTime: VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
    refetchInterval: VIRTUAL_LIBRARY_BOOKS_REFRESH_INTERVAL,
    refetchOnMount: 'always',
  });
  const books = useMemo(() => query.data?.pages.flatMap(page => page.items) ?? [], [query.data]);
  const catalog = useMemo(() => mingLibraryCatalog(books, window.location.origin), [books]);
  const currentCatalog = useRef(catalog);
  currentCatalog.current = catalog;

  useEffect(() => { setReady(false); setSceneError(null); }, [audience]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow
        || !event.data || event.data.channel !== MING_LIBRARY_CHANNEL) return;
      if (event.data.type === 'ready') { setReady(true); setSceneError(null); }
      if (event.data.type === 'catalog-applied') setSceneError(null);
      if (event.data.type === 'back') navigate(libraryReturn);
      if (event.data.type === 'read-book' && typeof event.data.bookId === 'string'
        && currentCatalog.current.some(book => book.id === event.data.bookId)) {
        navigate(`/reader/${encodeURIComponent(event.data.bookId)}`, {
          state: {returnTo: '/virtual-library', libraryView: null, mingLibraryView: readMingLibraryView(event.data.view)},
        });
      }
      if (event.data.type === 'error') setSceneError(typeof event.data.message === 'string'
        ? event.data.message : '书楼场景加载失败，请重试。');
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [navigate, libraryReturn]);

  useEffect(() => {
    if (ready && query.data) frame.current?.contentWindow?.postMessage({
      channel: MING_LIBRARY_CHANNEL, type: 'catalog', books: catalog, view: restoredView.current,
    }, window.location.origin);
  }, [ready, catalog, query.data]);

  const denied = query.error instanceof ApiRequestError && [401, 403].includes(query.error.status);
  if ((query.isError && !query.data) || denied) return <RequestErrorPage error={query.error}
    onRetry={() => void query.refetch()} retrying={query.isFetching} recovery="正在自动重试同步真实书目。" />;
  if (!query.data) return <section className="ming-library-page ming-library-loading" aria-label="正在同步真实书目"><CircularProgress /></section>;

  return <section className="ming-library-page" aria-label="书楼漫游">
    <iframe key={`${audience}:${attempt}`} ref={frame} title="明式藏书楼三维场景"
      className="ming-library-frame" src="/assets/ming-library/index.html"
      allow="fullscreen" allowFullScreen
      onError={() => setSceneError('书楼场景资源加载失败，请重试。')}
      onLoad={() => frame.current?.contentWindow?.postMessage({channel: MING_LIBRARY_CHANNEL, type: 'host-ready'}, window.location.origin)} />
    {!ready && !sceneError && <div className="ming-library-loading" role="status" aria-label="正在加载明式藏书楼"><CircularProgress /></div>}
    {(sceneError || query.isError) && <div className="ming-library-feedback"><Alert severity="error"
      action={<Button onClick={() => {
        if (sceneError) {setReady(false); setSceneError(null); setAttempt(value => value + 1);}
        void query.refetch();
      }}>重试</Button>}>
      {sceneError ?? (query.error instanceof Error ? query.error.message : '书目同步失败，将自动重试。')}
    </Alert></div>}
  </section>;
}
