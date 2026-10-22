// Only public, content-addressed architectural assets enter persistent storage.
// Catalogue APIs, personal reading data and book covers always retain their existing authorization path.
const CACHE_NAME = 'bookkin-library-assets-v1';
const MAX_BYTES = 96 * 1024 * 1024;
export const libraryAssetCacheStats = { hits: 0, misses: 0, reusedBytes: 0 };

export function staticLibraryAssetHash(path: string): string | undefined {
  const url = new URL(path, 'https://bookkin.invalid');
  if (url.origin !== 'https://bookkin.invalid' || url.hash) return undefined;
  const texture = url.pathname.match(/^\/assets\/hogwarts-library\/textures\/([a-f\d]{64})\.png$/);
  if (texture && !url.search) return texture[1];
  if (!/^\/assets\/hogwarts-library\/(?:modules\/[\w-]+\.glb|materials\.gltf)$/.test(url.pathname)) return undefined;
  const version = url.searchParams.get('v');
  return [...url.searchParams.keys()].length === 1 && version && /^[a-f\d]{16}$/.test(version) ? version : undefined;
}

async function valid(bytes: ArrayBuffer, hash: string) {
  if (!globalThis.crypto?.subtle) return false;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('').startsWith(hash);
}

let pendingBytes = 0;
let trimming = false;
let trimTimer: ReturnType<typeof setTimeout> | undefined;
const pending = new Map<string, {bytes: ArrayBuffer; headers: Headers}>();

function store(cache: Cache, url: string, bytes: ArrayBuffer, headers: Headers) {
  // Storage is a best-effort write-behind operation, never part of the first-frame dependency chain.
  if (pendingBytes + bytes.byteLength > MAX_BYTES / 3) return;
  headers.set('x-bookkin-asset-bytes', String(bytes.byteLength));
  pendingBytes += bytes.byteLength; pending.set(url, {bytes, headers});
  void cache.put(url, new Response(bytes, {headers})).catch(() => undefined).finally(() => {
    pendingBytes -= bytes.byteLength; pending.delete(url);
    if (trimTimer !== undefined) clearTimeout(trimTimer);
    trimTimer = setTimeout(() => {trimTimer = undefined; void trim(cache);}, 1000);
  });
}
async function trim(cache: Cache) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    const sizes = await Promise.all(keys.map(async key => Number((await cache.match(key))?.headers.get('x-bookkin-asset-bytes') ?? 0)));
    let used = 0;
    for (let i = keys.length - 1; i >= 0; i--) {
      used += sizes[i];
      if (used > MAX_BYTES) await cache.delete(keys[i]);
    }
  } catch { /* Storage maintenance cannot fail the scene. */ }
  finally {trimming = false;}
}

export async function fetchLibraryAsset(url: string, signal?: AbortSignal): Promise<Response> {
  const hash = staticLibraryAssetHash(url);
  if (!hash || typeof caches === 'undefined' || !globalThis.crypto?.subtle) return fetch(url, {signal});
  let cache: Cache | undefined;
  try { cache = await caches.open(CACHE_NAME); } catch { /* Private mode or quota: use the network normally. */ }
  signal?.throwIfAborted();
  const writing = pending.get(url);
  if (writing) {
    libraryAssetCacheStats.hits++; libraryAssetCacheStats.reusedBytes += writing.bytes.byteLength;
    return new Response(writing.bytes, {headers: writing.headers});
  }
  if (cache) {
    try {
      const response = await cache.match(url);
      if (response) {
        const bytes = await response.arrayBuffer();
        signal?.throwIfAborted();
        if (await valid(bytes, hash)) {
          libraryAssetCacheStats.hits++; libraryAssetCacheStats.reusedBytes += bytes.byteLength;
          return new Response(bytes, {headers: response.headers});
        }
        await cache.delete(url);
      }
    } catch { signal?.throwIfAborted(); }
  }
  libraryAssetCacheStats.misses++;
  const response = await fetch(url, {signal});
  if (!response.ok || !cache) return response;
  const bytes = await response.arrayBuffer();
  signal?.throwIfAborted();
  if (!await valid(bytes, hash)) throw new Error('建筑资源校验失败，请重试');
  store(cache, url, bytes, new Headers(response.headers));
  signal?.throwIfAborted();
  return new Response(bytes, {headers: response.headers});
}
