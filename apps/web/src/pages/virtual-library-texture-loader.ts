import * as THREE from 'three';

/** 场景私有请求可取消；Keep image requests owned and cancellable by this scene. */
export function createVirtualLibraryTextureLoader(manager: THREE.LoadingManager, signal: AbortSignal) {
  const loader = new THREE.TextureLoader(manager);
  const pending = new Set<() => void>();
  signal.addEventListener('abort', () => [...pending].forEach(cancel => cancel()), {once: true});

  loader.load = (url, onLoad, _onProgress, onError) => {
    const texture = new THREE.Texture<HTMLImageElement>();
    if (signal.aborted) {
      texture.dispose();
      onError?.(new DOMException('Scene closed', 'AbortError'));
      return texture;
    }
    const resolved = manager.resolveURL(loader.path + url);
    const request = new AbortController();
    let image: HTMLImageElement | undefined;
    let objectUrl: string | undefined;
    let settled = false;
    const finish = () => {
      settled = true;
      pending.delete(cancel);
      texture.removeEventListener('dispose', onDispose);
      if (image) {image.onload = null; image.onerror = null;}
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      manager.itemEnd(resolved);
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
    manager.itemStart(resolved);
    void fetch(resolved, {signal: request.signal, headers: loader.requestHeader,
      credentials: loader.withCredentials ? 'include' : 'same-origin'})
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
          texture.needsUpdate = true;
          finish();
          onLoad?.(texture);
        };
        image.onerror = fail;
        image.src = objectUrl;
      }).catch(fail);
    return texture;
  };
  return loader;
}
