import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = { id: 'owner', username: 'owner', role: 'OWNER', mustChangePassword: false };
let api: typeof import('./client').api;
let fetchMock: ReturnType<typeof vi.fn>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  api = (await import('./client')).api;
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('real authentication transport', () => {
  it('distinguishes an anonymous session from an unavailable service', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(new Response('Bad gateway', { status: 502 }));
    await expect(api.getSession()).resolves.toBeNull();
    await expect(api.getSession()).rejects.toThrow('书库服务暂时不可用');
  });
  it('reports a disconnected CSRF endpoint without submitting credentials', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.login('owner', 'example')).rejects.toThrow('无法连接书库服务');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('preserves incorrect-password feedback', async () => {
    fetchMock.mockResolvedValueOnce(json({ token: 'first' }))
      .mockResolvedValueOnce(json({ detail: '用户名或密码不正确。' }, 401));
    await expect(api.login('owner', 'example')).rejects.toThrow('用户名或密码不正确。');
  });
  it('refreshes a rejected CSRF token once and clears it after login', async () => {
    fetchMock.mockResolvedValueOnce(json({ token: 'old' })).mockResolvedValueOnce(json({}, 403))
      .mockResolvedValueOnce(json({ token: 'new' })).mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json({ token: 'logout' })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api.login('owner', 'example')).resolves.toEqual(session);
    await api.logout();
    expect(fetchMock.mock.calls[3][1].headers['X-XSRF-TOKEN']).toBe('new');
    expect(fetchMock.mock.calls[5][1].headers['X-XSRF-TOKEN']).toBe('logout');
  });
  it('times out authentication with a relevant message and does not replay login', async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms);
      return controller.signal;
    });
    fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    }));
    const result = expect(api.login('owner', 'example')).rejects.toThrow('连接书库服务超时');
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
