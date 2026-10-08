import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createReferenceLibraryStreaming, createReferenceMaterialPool, validateReferenceLibraryManifest,
  type ReferenceLibraryChunk, type ReferenceLibraryManifest, type ReferenceLibraryStreaming } from './referenceLibraryStreaming';

const blank = {asset: {version: '2.0'}, scene: 0, scenes: [{nodes: []}]};
const encoded = new TextEncoder().encode(JSON.stringify(blank));
const bytes = new ArrayBuffer(encoded.byteLength);
new Uint8Array(bytes).set(encoded);
const hash = createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
function chunk(id: string, x = 0, startup = false): ReferenceLibraryChunk {
  return {id, url: `modules/${id}.glb?v=abc123`, sha256: hash, bytes: bytes.byteLength, triangles: 0,
    primitives: 0, decodedGeometryBytes: 0, bounds: {min: [x - 1, -1, -1], max: [x + 1, 1, 1]},
    core: id === 'core', startup};
}
function manifest(chunks: ReferenceLibraryChunk[]): ReferenceLibraryManifest {
  return {version: 1, revision: 'fixture-r1', materialsUrl: 'materials.gltf?v=abc123', chunks};
}
function response(data: unknown, status = 200): Response {
  return {ok: status >= 200 && status < 300, status, json: async () => data,
    text: async () => JSON.stringify(data), arrayBuffer: async () => bytes} as Response;
}
function stubFetch(value: ReferenceLibraryManifest, load: (id: string, signal: AbortSignal) => Promise<Response> = async () => response(null)) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input).split('?')[0];
    if (path.endsWith('library-manifest.json')) return response(value);
    if (path.endsWith('materials.gltf')) return response(blank);
    return load(path.split('/').at(-1)!.replace('.glb', ''), init!.signal as AbortSignal);
  });
}
function options(signal = new AbortController().signal) {
  return {parent: new THREE.Group(), manager: new THREE.LoadingManager(), signal, multiDraw: true};
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return {promise, resolve, reject};
}
function camera(x = 0) {
  const value = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
  value.position.set(x, 0, 5); value.lookAt(x, 0, 0); value.updateMatrixWorld(true);
  return value;
}
let controller: ReferenceLibraryStreaming | undefined;
afterEach(async () => {
  await controller?.dispose(); controller = undefined;
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

describe('reference library module streaming', () => {
  it('validates the real local manifest, bounds, version and cache-busting namespace', () => {
    validateReferenceLibraryManifest(JSON.parse(readFileSync('public/assets/hogwarts-library/library-manifest.json', 'utf8')));
    const good = manifest([chunk('core')]);
    expect(() => validateReferenceLibraryManifest(good)).not.toThrow();
    for (const url of ['https://other.example/core.glb', '../../outside.glb', 'modules/core.glb?token=secret',
      'modules/core.glb?v=a&v=b', 'modules/core.glb#fragment']) {
      expect(() => validateReferenceLibraryManifest({...good, chunks: [{...good.chunks[0], url}]})).toThrow();
    }
    expect(() => validateReferenceLibraryManifest({...good, chunks: [chunk('core'), chunk('core')]})).toThrow();
    expect(() => validateReferenceLibraryManifest({...good, chunks: [{...chunk('core'), bounds: {min: [2, 0, 0], max: [1, 0, 0]}}]})).toThrow();
  });

  it('caps combined module fetch/decode jobs at two and awaits every startup module', async () => {
    const waiting = new Map<string, ReturnType<typeof deferred<Response>>>();
    stubFetch(manifest([chunk('core'), ...['a', 'b', 'c', 'd'].map(id => chunk(id, 0, true))]), async id => {
      const next = deferred<Response>(); waiting.set(id, next); return next.promise;
    });
    const pending = createReferenceLibraryStreaming(options());
    await vi.waitFor(() => expect(waiting.size).toBe(2));
    expect([...waiting.keys()]).toEqual(['core', 'a']);
    waiting.get('core')!.resolve(response(null));
    await vi.waitFor(() => expect(waiting.size).toBe(3));
    waiting.get('a')!.resolve(response(null));
    await vi.waitFor(() => expect(waiting.size).toBe(4));
    waiting.get('b')!.resolve(response(null));
    await vi.waitFor(() => expect(waiting.size).toBe(5));
    waiting.get('c')!.resolve(response(null)); waiting.get('d')!.resolve(response(null));
    controller = await pending;
    expect(controller.diagnostics()).toMatchObject({residentModules: 5, startupResidentModules: 5,
      allDetailsResident: true, peakConcurrentLoads: 2, maxConcurrentLoads: 2});
  });

  it('keeps failures retryable without retrying them on every camera update', async () => {
    let attempts = 0;
    const errors = vi.fn();
    stubFetch(manifest([chunk('core'), chunk('detail', 30)]), async id => response(null, id === 'detail' && ++attempts === 1 ? 503 : 200));
    controller = await createReferenceLibraryStreaming({...options(), onError: errors});
    await expect(controller.ensurePoint({x: 30, y: 0, z: 0})).rejects.toThrow('503');
    expect(controller.diagnostics()).toMatchObject({phase: 'error', failedModules: 1});
    controller.updateView(camera(30)); controller.updateView(camera(30));
    expect(attempts).toBe(1);
    await controller.retryFailed();
    expect(attempts).toBe(2);
    expect(controller.diagnostics()).toMatchObject({failedModules: 0, residentModules: 2});
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('aborts active requests, never starts queued requests, and leaves no mounted geometry', async () => {
    const abort = new AbortController();
    const settings = options(abort.signal);
    const requested: string[] = [], aborted: string[] = [];
    stubFetch(manifest([chunk('core'), chunk('a', 0, true), chunk('b', 0, true)]), (id, signal) => {
      requested.push(id);
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
        aborted.push(id); reject(new DOMException('aborted', 'AbortError'));
      }, {once: true}));
    });
    const pending = createReferenceLibraryStreaming(settings);
    const assertion = expect(pending).rejects.toMatchObject({name: 'AbortError'});
    await vi.waitFor(() => expect(requested).toHaveLength(2));
    abort.abort(); await assertion;
    expect(aborted).toHaveLength(2); expect(requested).toEqual(['core', 'a']);
    expect(settings.parent.children).toHaveLength(0);
  });

  it('aborts stalled bank-owned bitmap requests during route cancellation', async () => {
    const actual: ReferenceLibraryManifest = JSON.parse(readFileSync('public/assets/hogwarts-library/library-manifest.json', 'utf8'));
    const coreOnly = {...actual, chunks: actual.chunks.filter(chunk => chunk.core)};
    const abort = new AbortController(), settings = options(abort.signal);
    let imageRequests = 0, abortedImages = 0;
    vi.stubGlobal('createImageBitmap', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input).split('?')[0];
      if (path.endsWith('library-manifest.json')) return response(coreOnly);
      if (path.endsWith('.png')) {
        imageRequests++;
        return new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => {
          abortedImages++; reject(new DOMException('aborted image', 'AbortError'));
        }, {once: true}));
      }
      const data = readFileSync('public' + path);
      return {ok: true, status: 200, text: async () => data.toString(),
        arrayBuffer: async () => {const local = new ArrayBuffer(data.byteLength); new Uint8Array(local).set(data); return local;}} as Response;
    });
    const pending = createReferenceLibraryStreaming(settings);
    const assertion = expect(pending).rejects.toMatchObject({name: 'AbortError'});
    await vi.waitFor(() => expect(imageRequests).toBeGreaterThan(0));
    abort.abort(); await assertion;
    expect(abortedImages).toBe(imageRequests);
    expect(settings.parent.children).toHaveLength(0);
  });

  it('disposes a late decoded chunk once instead of attaching after cancellation', async () => {
    const abort = new AbortController();
    const settings = options(abort.signal);
    const group = new THREE.Group(), geometry = new THREE.BoxGeometry();
    group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
    const release = vi.spyOn(geometry, 'dispose');
    const decoded = deferred<GLTF>();
    const original = GLTFLoader.prototype.parseAsync;
    const parse = vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(function (this: GLTFLoader, data, path) {
      return typeof data === 'string' ? original.call(this, data, path) : decoded.promise;
    });
    stubFetch(manifest([chunk('core')]));
    const pending = createReferenceLibraryStreaming(settings);
    const assertion = expect(pending).rejects.toMatchObject({name: 'AbortError'});
    await vi.waitFor(() => expect(parse).toHaveBeenCalledTimes(2));
    abort.abort(); decoded.resolve({scene: group} as GLTF); await assertion;
    expect(settings.parent.children).toHaveLength(0); expect(release).toHaveBeenCalledTimes(1);
  });

  it('rolls back a cancelled progressive attachment without double-disposing its source', async () => {
    const abort = new AbortController(), settings = options(abort.signal);
    const geometry = new THREE.BoxGeometry(), group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
    const release = vi.spyOn(geometry, 'dispose');
    const original = GLTFLoader.prototype.parseAsync;
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(function (this: GLTFLoader, data, path) {
      return typeof data === 'string' ? original.call(this, data, path) : Promise.resolve({scene: group} as GLTF);
    });
    stubFetch(manifest([chunk('core')]));
    const copySlices = vi.fn();
    await expect(createReferenceLibraryStreaming({...settings, onSlice: (milliseconds, stage) => {
      if (stage === 'reference-chunk-material-copy') {copySlices(milliseconds); abort.abort();}
    }})).rejects.toMatchObject({name: 'AbortError'});
    expect(copySlices).toHaveBeenCalled();
    expect(settings.parent.children).toHaveLength(0);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('consolidates fallback only once every module is resident, then disables eviction', async () => {
    stubFetch(manifest([chunk('core'), chunk('detail', 30)]));
    controller = await createReferenceLibraryStreaming({...options(), multiDraw: false});
    expect(controller.diagnostics().fallbackResidencyLocked).toBe(false);
    await controller.ensurePoint({x: 30, y: 0, z: 0});
    await vi.waitFor(() => expect(controller!.diagnostics().batching.consolidatedFallback).toBe(true));
    expect(controller.diagnostics().fallbackResidencyLocked).toBe(true);
    await controller.ensurePoint({x: 0, y: 0, z: 0});
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']});
    controller.updateView(camera());
    await vi.advanceTimersByTimeAsync(31_000);
    expect(controller.diagnostics().residentModules).toBe(2);
  });

  it.each([true, false])('loads the real manifest through the controller with multi-draw=%s', async multiDraw => {
    const root = 'public/assets/hogwarts-library/';
    const actual: ReferenceLibraryManifest = JSON.parse(readFileSync(root + 'library-manifest.json', 'utf8'));
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const path = String(input).split('?')[0];
      const data = readFileSync('public' + path);
      return {ok: true, status: 200, json: async () => JSON.parse(data.toString()), text: async () => data.toString(),
        arrayBuffer: async () => { const local = new ArrayBuffer(data.byteLength); new Uint8Array(local).set(data); return local; }} as Response;
    });
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
      const texture = new THREE.Texture({close: vi.fn()} as unknown as HTMLImageElement);
      queueMicrotask(() => onLoad?.(texture));
      return texture;
    });
    const settings = {...options(), multiDraw};
    controller = await createReferenceLibraryStreaming(settings);
    const shadow = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 300);
    shadow.position.set(0, 100, 100); shadow.lookAt(0, 0, 0); shadow.updateMatrixWorld(true);
    controller.updateView(camera(), [shadow]);
    await vi.waitFor(() => expect(controller!.diagnostics().allDetailsResident).toBe(true), {timeout: 10_000});
    if (!multiDraw) await vi.waitFor(() => expect(controller!.diagnostics().batching.consolidatedFallback).toBe(true), {timeout: 10_000});
    const diagnostics = controller.diagnostics();
    expect(diagnostics).toMatchObject({residentModules: 13, failedModules: 0, peakConcurrentLoads: 2,
      fallbackResidencyLocked: !multiDraw, shadowRequiredModules: 13});
    expect(diagnostics.residentTriangles).toBe(actual.chunks.reduce((sum, chunk) => sum + chunk.triangles, 0));
    expect(diagnostics.batching.residentTriangles).toBe(diagnostics.residentTriangles);
    expect(diagnostics.batching.batchCount).toBe(28);
    settings.parent.traverse(object => {
      if (object instanceof THREE.Mesh) expect([object.castShadow, object.receiveShadow]).toEqual([true, true]);
    });
  });

  it('retains required shadow casters and every touching focus module through eviction hysteresis', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']});
    stubFetch(manifest([chunk('core'), chunk('left', 28, true), chunk('right', 32, true), chunk('other', 60)]));
    controller = await createReferenceLibraryStreaming(options());
    const shadow = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 20);
    shadow.position.set(30, 0, 10); shadow.lookAt(30, 0, 0); shadow.updateMatrixWorld(true);
    controller.updateView(camera(), [shadow]);
    await vi.advanceTimersByTimeAsync(16_000);
    expect(controller.diagnostics()).toMatchObject({residentModules: 3, shadowRequiredModules: 2});
    await controller.ensurePoint({x: 30, y: 0, z: 0});
    controller.updateView(camera());
    await vi.advanceTimersByTimeAsync(16_000);
    expect(controller.diagnostics()).toMatchObject({residentModules: 3, pinnedModules: 2});
    await controller.ensurePoint({x: 60, y: 0, z: 0});
    await vi.advanceTimersByTimeAsync(14_999);
    expect(controller.diagnostics().residentModules).toBe(4);
    await vi.advanceTimersByTimeAsync(2);
    expect(controller.diagnostics().modules.filter(value => value.state === 'resident').map(value => value.id)).toEqual(['core', 'other']);
  });
});

describe('canonical reference material ownership', () => {
  async function parser() {
    const gltf = await new GLTFLoader().parseAsync(JSON.stringify({...blank,
      materials: [{pbrMetallicRoughness: {baseColorTexture: {index: 0}}}, {pbrMetallicRoughness: {baseColorTexture: {index: 0}}}],
      textures: [{source: 0, sampler: 0}], samplers: [{}], images: [{uri: 'textures/shared.png'}]}), '/assets/hogwarts-library/');
    return gltf.parser;
  }

  it('shares canonical promises and final variants, including exactly one tangent normal flip', async () => {
    const source = await parser();
    const material = new THREE.MeshStandardMaterial();
    const load = vi.spyOn(source, 'loadMaterial').mockResolvedValue(material);
    const pool = createReferenceMaterialPool(source);
    const first = pool.loadMaterial(0), second = pool.loadMaterial(0);
    expect(first).toBe(second);
    const original = await first;
    const a = new THREE.Mesh(new THREE.BoxGeometry(), original), b = new THREE.Mesh(new THREE.BoxGeometry(), await second);
    pool.assignFinalMaterial(a); pool.assignFinalMaterial(b);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a.material).toBe(b.material); expect(a.material).not.toBe(original);
    expect((a.material as THREE.MeshStandardMaterial).normalScale.y).toBe(-1);
    expect(material.normalScale.y).toBe(1);
    await pool.dispose(); a.geometry.dispose(); b.geometry.dispose();
  });

  it('retries failed material and texture promises and restores the missing map', async () => {
    const source = await parser();
    const image = {close: vi.fn()};
    const texture = new THREE.Texture(image as unknown as HTMLImageElement);
    let attempt = 0;
    const loader = vi.spyOn(source.textureLoader, 'load').mockImplementation((_url: string, onLoad: any, _progress: any, onError: any) => {
      queueMicrotask(() => { if (++attempt === 1) onError?.(new Error('network')); else (onLoad as (value: THREE.Texture) => void)?.(texture); });
      return texture as never;
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pool = createReferenceMaterialPool(source);
    const first = pool.loadMaterial(0);
    await expect(first).rejects.toThrow('建筑纹理加载失败');
    const second = pool.loadMaterial(0);
    expect(second).not.toBe(first);
    const result = await second as THREE.MeshStandardMaterial;
    expect(result.map).toBe(texture); expect(result.map!.anisotropy).toBe(8);
    expect(loader).toHaveBeenCalledTimes(2);
    await pool.dispose(); expect(image.close).toHaveBeenCalledTimes(1);
  });

  it('shares exact shading variants across all thirteen real Meshopt modules', async () => {
    const root = 'public/assets/hogwarts-library/';
    const manifest: ReferenceLibraryManifest = JSON.parse(readFileSync(root + 'library-manifest.json', 'utf8'));
    const bank = await new GLTFLoader().parseAsync(readFileSync(root + 'materials.gltf', 'utf8'), '/assets/hogwarts-library/');
    // Parse real geometry/material definitions while substituting only image I/O.
    // This is a decode/ownership test, not a renderer or image-quality claim.
    vi.spyOn(bank.parser.textureLoader, 'load').mockImplementation((_url: string, onLoad: any) => {
      const texture = new THREE.Texture({close: vi.fn()} as unknown as HTMLImageElement);
      queueMicrotask(() => (onLoad as (value: THREE.Texture) => void)?.(texture));
      return texture as never;
    });
    const pool = createReferenceMaterialPool(bank.parser);
    const variants = new Map<string, THREE.Material>();
    let primitiveCount = 0;
    for (const chunk of manifest.chunks) {
      const path = new URL(chunk.url, 'https://bookkin.invalid/assets/hogwarts-library/').pathname;
      const source = readFileSync('public' + path);
      const data = new ArrayBuffer(source.byteLength); new Uint8Array(data).set(source);
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      loader.register(parser => {
        parser.assignFinalMaterial = mesh => pool.assignFinalMaterial(mesh);
        return {name: 'BOOKKIN_shared_material_bank', loadMaterial: index => pool.loadMaterial(index)};
      });
      const module = await loader.parseAsync(data, '/assets/hogwarts-library/modules/');
      const geometries = new Set<THREE.BufferGeometry>();
      const originals: {mesh: THREE.Mesh; index: number}[] = [];
      module.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        primitiveCount++; geometries.add(object.geometry);
        const material = object.material as THREE.Material;
        const index = bank.parser.associations.get(material)?.materials;
        expect(index).toBeDefined();
        const key = `${index}:${!object.geometry.attributes.tangent}:${!!object.geometry.attributes.color}:${!object.geometry.attributes.normal}`;
        if (variants.has(key)) expect(material).toBe(variants.get(key)); else variants.set(key, material);
        originals.push({mesh: object, index: index!});
      });
      for (const {mesh, index} of originals) {
        const original = await pool.loadMaterial(index) as THREE.MeshStandardMaterial;
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material.normalScale) expect(material.normalScale.y).toBe(original.normalScale.y * (mesh.geometry.attributes.tangent ? 1 : -1));
      }
      geometries.forEach(geometry => geometry.dispose());
    }
    expect(manifest.chunks).toHaveLength(13);
    expect(primitiveCount).toBe(manifest.chunks.reduce((sum, chunk) => sum + chunk.primitives, 0));
    expect(primitiveCount).toBe(140);
    expect(variants.size).toBe(28);
    await pool.dispose();
  });

  it('waits for pending loads and releases shared materials, textures and bitmaps once', async () => {
    const source = await parser();
    const image = {close: vi.fn()};
    const a = new THREE.Texture(image as unknown as HTMLImageElement), b = new THREE.Texture(image as unknown as HTMLImageElement);
    const material = new THREE.MeshStandardMaterial({map: a, normalMap: b});
    const delayed = deferred<THREE.Material>();
    vi.spyOn(source, 'loadMaterial').mockReturnValue(delayed.promise);
    const releaseMaterial = vi.spyOn(material, 'dispose'), releaseA = vi.spyOn(a, 'dispose'), releaseB = vi.spyOn(b, 'dispose');
    const pool = createReferenceMaterialPool(source);
    const loading = pool.loadMaterial(0); await Promise.resolve();
    const disposal = pool.dispose();
    expect(pool.dispose()).toBe(disposal); expect(releaseMaterial).not.toHaveBeenCalled();
    delayed.resolve(material); await loading; await disposal;
    expect(releaseMaterial).toHaveBeenCalledTimes(1); expect(releaseA).toHaveBeenCalledTimes(1); expect(releaseB).toHaveBeenCalledTimes(1);
    expect(image.close).toHaveBeenCalledTimes(1); expect(pool.diagnostics()).toEqual({materials: 0, textures: 0, pending: 0});
  });
});
