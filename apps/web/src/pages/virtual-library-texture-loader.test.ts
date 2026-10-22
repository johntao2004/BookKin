import * as THREE from 'three';
import { createVirtualLibraryTextureLoader } from './virtual-library-texture-loader';

function setup() {
  const abort=new AbortController();
  const manager=new THREE.LoadingManager();
  return {abort,manager,loader:createVirtualLibraryTextureLoader(manager,abort.signal)};
}
beforeEach(() => {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL=vi.fn(()=>'blob:scene-image');
    static revokeObjectURL=vi.fn();
  });
});
afterEach(() => {vi.restoreAllMocks();vi.unstubAllGlobals();});

it('aborts pending image downloads and settles their consumers once', async () => {
  let signal: AbortSignal | undefined;
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation((_url,init)=>{
    signal=init?.signal as AbortSignal;
    return new Promise((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(signal!.reason)));
  });
  const {abort,manager,loader}=setup();
  const ended=vi.spyOn(manager,'itemEnd'), loaded=vi.fn(), failed=vi.fn();
  const texture=loader.load('/cover.png',loaded,undefined,failed);
  const disposed=vi.spyOn(texture,'dispose');
  abort.abort();
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledOnce();
  expect(signal?.aborted).toBe(true);
  expect(disposed).toHaveBeenCalledOnce();
  expect(ended).toHaveBeenCalledOnce();
  expect(failed).toHaveBeenCalledWith(expect.objectContaining({name:'AbortError'}));
  expect(loaded).not.toHaveBeenCalled();
});

it('clears decoding images and ignores a late load callback after leaving', async () => {
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(new Blob(['image'])));
  const image=document.createElement('img');
  vi.stubGlobal('Image',class {constructor(){return image;}});
  const {abort,loader}=setup();
  const loaded=vi.fn(), failed=vi.fn();
  const texture=loader.load('/cover.png',loaded,undefined,failed);
  await vi.waitFor(()=>expect(image.onload).toBeTypeOf('function'));
  const late=image.onload!;
  abort.abort();
  late.call(image,new Event('load'));
  expect(image.onload).toBeNull();
  expect(image.hasAttribute('src')).toBe(false);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:scene-image');
  expect(texture.image).toBeNull();
  expect(loaded).not.toHaveBeenCalled();
  expect(failed).toHaveBeenCalledOnce();
});

it('preserves image orientation and gives completed textures to scene disposal', async () => {
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(new Blob(['image'])));
  const image=document.createElement('img');
  vi.stubGlobal('Image',class {constructor(){return image;}});
  const {abort,loader}=setup();
  const loaded=vi.fn(), failed=vi.fn();
  const texture=loader.load('/cover.png',loaded,undefined,failed);
  const disposed=vi.spyOn(texture,'dispose');
  await vi.waitFor(()=>expect(image.onload).toBeTypeOf('function'));
  image.dispatchEvent(new Event('load'));
  abort.abort();
  expect(texture.image).toBe(image);
  expect(texture.flipY).toBe(true);
  expect(loaded).toHaveBeenCalledExactlyOnceWith(texture);
  expect(failed).not.toHaveBeenCalled();
  expect(disposed).not.toHaveBeenCalled();
  texture.dispose();
});

it('cancels a removed book texture without aborting the remaining scene', () => {
  let signal: AbortSignal | undefined;
  vi.spyOn(globalThis,'fetch').mockImplementation((_url,init)=>{
    signal=init?.signal as AbortSignal;
    return new Promise((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(signal!.reason)));
  });
  const {abort,loader}=setup();
  const failed=vi.fn();
  const texture = loader.load('/cover.png',undefined,undefined,failed);
  const disposed = vi.spyOn(texture, 'dispose');
  texture.dispose();
  expect(disposed).toHaveBeenCalledOnce();
  expect(signal?.aborted).toBe(true);
  expect(abort.signal.aborted).toBe(false);
  expect(failed).toHaveBeenCalledOnce();
});

it('defers distant cover requests and can promote them before downloading', async () => {
  const network = vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(new Blob(['image'])));
  const image = document.createElement('img');
  vi.stubGlobal('Image', class {constructor(){return image;}});
  const {requestVirtualLibraryTexture} = await import('./virtual-library-texture-loader');
  const abort = new AbortController(), manager = new THREE.LoadingManager();
  const loader = createVirtualLibraryTextureLoader(manager, abort.signal, {maxDimension:256, deferred:true});
  const texture = loader.load('/private-cover.png');
  expect(network).not.toHaveBeenCalled();
  requestVirtualLibraryTexture(texture, true);
  await vi.waitFor(()=>expect(image.onload).toBeTypeOf('function'));
  image.dispatchEvent(new Event('load'));
  expect(network).toHaveBeenCalledOnce();
  expect(texture.image).toBe(image);
  texture.dispose(); abort.abort();
});

it('keeps a proportional thumbnail on shelves and restores original resolution on inspection', async () => {
  const images: HTMLImageElement[] = [];
  vi.stubGlobal('Image', class {constructor(){const image=document.createElement('img');images.push(image);return image;}});
  vi.spyOn(globalThis,'fetch').mockImplementation(async () => new Response(new Blob(['image'])));
  const context = {drawImage: vi.fn()} as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  const {requestVirtualLibraryTexture} = await import('./virtual-library-texture-loader');
  const abort = new AbortController();
  const loader = createVirtualLibraryTextureLoader(new THREE.LoadingManager(), abort.signal, {maxDimension:256, deferred:true});
  const texture = loader.load('/private-cover.png');
  requestVirtualLibraryTexture(texture);
  await vi.waitFor(()=>expect(images[0]?.onload).toBeTypeOf('function'));
  Object.defineProperties(images[0], {naturalWidth:{value:800}, naturalHeight:{value:1200}});
  images[0].dispatchEvent(new Event('load'));
  const thumbnail = texture.image as unknown as HTMLCanvasElement;
  expect(thumbnail).toBeInstanceOf(HTMLCanvasElement);
  expect([thumbnail.width,thumbnail.height]).toEqual([171,256]);
  requestVirtualLibraryTexture(texture,true);
  await vi.waitFor(()=>expect(images[1]?.onload).toBeTypeOf('function'));
  images[1].dispatchEvent(new Event('load'));
  expect(texture.image).toBe(images[1]);
  expect(texture.flipY).toBe(true);
  texture.dispose();abort.abort();
});
