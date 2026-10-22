import { webcrypto } from 'node:crypto';
import { fetchLibraryAsset, staticLibraryAssetHash } from './virtual-library-asset-cache';

let entries: Map<string, Response>;
beforeEach(() => {
  entries = new Map();
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('caches', {open: async () => ({
    match: async (key: string) => entries.get(key)?.clone(),
    put: async (key: string, value: Response) => {entries.set(key, value.clone());},
    delete: async (key: string) => entries.delete(key),
    keys: async () => [...entries.keys()],
  })});
});
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});
async function fixture() {
  const data = new TextEncoder().encode('exact architectural asset');
  const hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', data)).toString('hex');
  return {data, url: `/assets/hogwarts-library/modules/core.glb?v=${hash.slice(0, 16)}`};
}
it('reuses only checksum-verified architectural bytes across visits', async () => {
  const {data, url} = await fixture();
  const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(data));
  expect(await (await fetchLibraryAsset(url)).text()).toBe('exact architectural asset');
  expect(await (await fetchLibraryAsset(url)).text()).toBe('exact architectural asset');
  expect(network).toHaveBeenCalledOnce();
});
it('evicts a corrupt entry and recovers from the network', async () => {
  const {data, url} = await fixture(); entries.set(url, new Response('corrupt'));
  const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(data));
  expect(await (await fetchLibraryAsset(url)).text()).toBe('exact architectural asset');
  expect(network).toHaveBeenCalledOnce();
});
it('does not store a failed or hash-mismatching download', async () => {
  const {url} = await fixture();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('corrupt'));
  await expect(fetchLibraryAsset(url)).rejects.toThrow('校验失败');
  expect(entries.size).toBe(0);
});
it('retains network operation if persistent storage is unavailable', async () => {
  vi.stubGlobal('caches', {open: async () => {throw new Error('quota');}});
  const {data, url} = await fixture();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(data));
  expect(await (await fetchLibraryAsset(url)).text()).toBe('exact architectural asset');
});
it('never persists catalogue APIs, covers, mutable manifests or external URLs', async () => {
  const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('private'));
  for (const url of ['/api/v1/books', '/api/v1/books/private/cover?v=abc', '/assets/hogwarts-library/library-manifest.json?v=r42',
    'https://external.test/assets/hogwarts-library/modules/core.glb?v=aaaaaaaaaaaaaaaa']) {
    expect(staticLibraryAssetHash(url)).toBeUndefined();
    await fetchLibraryAsset(url);
  }
  expect(network).toHaveBeenCalledTimes(4); expect(entries.size).toBe(0);
});
it('does not continue with an aborted cache lookup', async () => {
  const {url} = await fixture(); const abort = new AbortController(); abort.abort();
  const network = vi.spyOn(globalThis, 'fetch');
  await expect(fetchLibraryAsset(url, abort.signal)).rejects.toMatchObject({name: 'AbortError'});
  expect(network).not.toHaveBeenCalled();
});

it('returns validated bytes while a slow disk write is still pending', async () => {
  const {data, url} = await fixture();
  let finish!: () => void;
  const write = new Promise<void>(resolve => {finish = resolve;});
  vi.stubGlobal('caches', {open: async () => ({match: async () => undefined, put: async () => write, keys: async () => []})});
  const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(data));
  try {
    expect(await (await fetchLibraryAsset(url)).text()).toBe('exact architectural asset');
    // A concurrent consumer reuses the validated pending entry without another network request.
    expect(await (await fetchLibraryAsset(url)).text()).toBe('exact architectural asset');
    expect(network).toHaveBeenCalledOnce();
  } finally {finish(); await write;}
});
