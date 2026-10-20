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
