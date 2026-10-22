import { fetchLibraryAsset } from "./virtual-library-asset-cache";
import * as THREE from 'three';

const textureRequests = new WeakMap<THREE.Texture, (full: boolean) => void>();
export function requestVirtualLibraryTexture(texture: THREE.Texture, full = false) { textureRequests.get(texture)?.(full); }

/** 场景私有请求可取消；Keep image requests owned and cancellable by this scene. */
export function createVirtualLibraryTextureLoader(manager: THREE.LoadingManager, signal: AbortSignal, options: {maxDimension?: number; deferred?: boolean} = {}) {
  const loader = new THREE.TextureLoader(manager);
  const pending = new Set<() => void>();
  signal.addEventListener('abort', () => [...pending].forEach(cancel => cancel()), {once: true});

  const loadTexture = (url: string, onLoad?: (texture: THREE.Texture) => void, onError?: (error: unknown) => void,
    dimension: number | null | undefined = options.maxDimension, deferred = options.deferred) => {
    const texture = new THREE.Texture();
    if (signal.aborted) {
      texture.dispose();
      onError?.(new DOMException('Scene closed', 'AbortError'));
      return texture;
    }
    const resolved = manager.resolveURL(loader.path + url);
    const request = new AbortController();
    let image: HTMLImageElement | undefined;
    let objectUrl: string | undefined;
    let settled = false, started = false, thumbnail = false;
    let fullTexture: THREE.Texture | undefined;
    const finish = () => {
      settled = true;
      pending.delete(cancel);
      texture.removeEventListener('dispose', onDispose);
      if (image) {image.onload = null; image.onerror = null;}
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (started) manager.itemEnd(resolved);
    };
    const cancel = (disposeTexture = true) => {
      if (settled) return;
      request.abort();
      finish();
      image?.removeAttribute('src');
      if (disposeTexture) texture.dispose();
      // 拒绝等待中的材质，避免退出悬挂；Settle waiting materials during exit.
      onError?.(new DOMException('Scene closed', 'AbortError'));
    };
    const onDispose = () => cancel(false);
    const fail = (error: unknown) => {
      if (settled) return;
      finish();
      texture.dispose();
      manager.itemError(resolved);
      onError?.(error);
    };
    pending.add(cancel);
    texture.addEventListener('dispose', onDispose);
    texture.addEventListener('dispose', () => {textureRequests.delete(texture); fullTexture?.dispose();});
    const start = () => {
    if (started || settled) return;
    started = true;
    manager.itemStart(resolved);
    void (/^\/assets\/hogwarts-library\//.test(resolved)
      ? fetchLibraryAsset(resolved, request.signal)
      : fetch(resolved, {signal: request.signal, headers: loader.requestHeader, credentials: loader.withCredentials ? 'include' : 'same-origin'}))
      .then(response => {
        if (!response.ok) throw new Error(`Texture request failed (${response.status})`);
        return response.blob();
      }).then(blob => {
        if (settled || signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        image = new Image();
        image.onload = () => {
          if (settled || signal.aborted || !image) return;
          texture.image = image;
          if (dimension && Math.max(image.naturalWidth, image.naturalHeight) > dimension) {
            const scale = dimension / Math.max(image.naturalWidth, image.naturalHeight);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const context = canvas.getContext('2d');
            if (context) {context.drawImage(image, 0, 0, canvas.width, canvas.height); texture.image = canvas; thumbnail = true;}
          }
          texture.needsUpdate = true;
          finish();
          onLoad?.(texture);
          if (thumbnail) image?.removeAttribute('src');
          image = undefined;
        };
        image.onerror = fail;
        image.src = objectUrl;
      }).catch(fail);
    };
    textureRequests.set(texture, full => {
      if (signal.aborted) return;
      if (full) dimension = null;
      if (!started) start();
      else if (full && settled && thumbnail && !fullTexture) {
        fullTexture = loadTexture(url, loaded => {
          if (signal.aborted) return;
          texture.image = loaded.image; texture.needsUpdate = true;
          onLoad?.(texture);
        }, onError, null, false);
      }
    });
    if (!deferred) start();
    return texture;
  };
  // Three's TextureLoader typing narrows images to HTMLImageElement; WebGL also supports the canvas thumbnail.
  loader.load = (url, onLoad, _onProgress, onError) => loadTexture(url,
    texture => onLoad?.(texture as THREE.Texture<HTMLImageElement>), onError) as THREE.Texture<HTMLImageElement>;
  return loader;
}
