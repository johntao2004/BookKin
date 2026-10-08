import * as THREE from 'three';
import { GLTFLoader, type GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createReferenceChunkBatcher } from './referenceLibraryChunkBatches';
import { REFERENCE_LIBRARY } from '../hogwartsLibraryLayout';

export const REFERENCE_LIBRARY_MANIFEST_URL = REFERENCE_LIBRARY.manifestUrl;
const MAX_CONCURRENT_LOADS = 2;
const EVICT_AFTER_MS = 15_000;
const POINT_NEIGHBORHOOD = 5;
const CAMERA_NEIGHBORHOOD = 7;
type Point = {x: number; y: number; z: number};
type VectorTuple = [number, number, number];

export interface ReferenceLibraryChunk {
  id: string;
  url: string;
  bytes: number;
  sha256: string;
  triangles: number;
  primitives: number;
  decodedGeometryBytes: number;
  bounds: {min: VectorTuple; max: VectorTuple};
  core: boolean;
  startup: boolean;
}
export interface ReferenceLibraryManifest {
  version: 1;
  revision: string;
  materialsUrl: string;
  materialCapacityLimits?: {name: string; vertices: number; indices: number}[];
  chunks: ReferenceLibraryChunk[];
}
export interface ReferenceLibraryStreamingOptions {
  parent: THREE.Group;
  manager: THREE.LoadingManager;
  signal: AbortSignal;
  multiDraw: boolean;
  onChange?: () => void;
  onError?: (error: Error, chunkId?: string) => void;
  onSlice?: (milliseconds: number, stage: string) => void;
}
export interface ReferenceLibraryStreaming {
  updateView(camera: THREE.Camera, shadowCameras?: readonly THREE.Camera[]): void;
  /** World-space destination. Keep the previous pin until its replacement is ready. */
  ensurePoint(point: Point): Promise<void>;
  retryFailed(): Promise<void>;
  diagnostics(): ReferenceLibraryStreamingDiagnostics;
  /** Detaches immediately; resolves once pending decodes and shared disposal finish. */
  dispose(): Promise<void>;
}
export interface ReferenceLibraryStreamingDiagnostics {
  revision: string;
  phase: 'loading' | 'ready' | 'streaming' | 'consolidating' | 'error' | 'disposed';
  totalModules: number;
  residentModules: number;
  startupModules: number;
  startupResidentModules: number;
  allDetailsResident: boolean;
  requiredModules: number;
  fallbackResidencyLocked: boolean;
  consolidationError: string | null;
  loadingModules: number;
  queuedModules: number;
  failedModules: number;
  maxConcurrentLoads: number;
  peakConcurrentLoads: number;
  residentBytes: number;
  residentGeometryBytes: number;
  residentTriangles: number;
  totalBytes: number;
  downloadedBytes: number;
  shadowRequiredModules: number;
  pinnedModules: number;
  failures: {id: string; url: string; message: string}[];
  modules: {id: string; state: ChunkState; visible: boolean; shadowRequired: boolean; pinned: boolean}[];
  sharedResources: {materials: number; textures: number; pending: number};
  batching: ReturnType<ReturnType<typeof createReferenceChunkBatcher>['diagnostics']>;
}

type ChunkState = 'unloaded' | 'queued' | 'loading' | 'resident' | 'failed';
interface ChunkRecord {
  manifest: ReferenceLibraryChunk;
  bounds: THREE.Box3;
  state: ChunkState;
  priority: number;
  lastWantedAt: number;
  visible: boolean;
  shadowRequired: boolean;
  error?: Error;
  promise?: Promise<void>;
  resolve?: () => void;
  reject?: (error: unknown) => void;
}

function assetUrl(path: string, base: string = REFERENCE_LIBRARY_MANIFEST_URL) {
  const url = new URL(path, new URL(base, 'https://bookkin.invalid'));
  // Generated modules and textures must stay in this local asset namespace.
  if (url.origin !== 'https://bookkin.invalid' || !url.pathname.startsWith('/assets/hogwarts-library/')
    || url.hash || [...url.searchParams.keys()].some(key => key !== 'v')
    || url.searchParams.getAll('v').length > 1
    || (url.searchParams.has('v') && !/^[A-Za-z\d-]{1,80}$/.test(url.searchParams.get('v')!))) {
    throw new Error(`建筑模块地址无效: ${path}`);
  }
  return url.pathname + url.search;
}

export function validateReferenceLibraryManifest(value: unknown): asserts value is ReferenceLibraryManifest {
  if (!value || typeof value !== 'object') throw new Error('建筑模块清单不可读取');
  const manifest = value as ReferenceLibraryManifest;
  if (manifest.version !== 1 || typeof manifest.revision !== 'string' || !manifest.revision.trim()
    || typeof manifest.materialsUrl !== 'string' || !Array.isArray(manifest.chunks)
    || !manifest.chunks.length) throw new Error('建筑模块清单版本或结构无效');
  assetUrl(manifest.materialsUrl);
  if (manifest.materialCapacityLimits !== undefined) {
    if (!Array.isArray(manifest.materialCapacityLimits)) throw new Error('建筑材质容量清单无效');
    const names = new Set<string>();
    for (const limit of manifest.materialCapacityLimits) {
      if (!limit || typeof limit.name !== 'string' || !limit.name || names.has(limit.name)
        || ![limit.vertices, limit.indices].every(n => Number.isSafeInteger(n) && n >= 0)) {
        throw new Error('建筑材质容量清单无效');
      }
      names.add(limit.name);
    }
  }
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const chunk of manifest.chunks) {
    if (!chunk || typeof chunk.id !== 'string' || !chunk.id || ids.has(chunk.id)
      || typeof chunk.url !== 'string' || typeof chunk.sha256 !== 'string' || !/^[a-f\d]{64}$/i.test(chunk.sha256)
      || typeof chunk.core !== 'boolean' || typeof chunk.startup !== 'boolean'
      || ![chunk.bytes, chunk.triangles, chunk.primitives, chunk.decodedGeometryBytes]
        .every(n => Number.isSafeInteger(n) && n >= 0) || chunk.bytes === 0
      || !chunk.bounds || ![chunk.bounds.min, chunk.bounds.max]
        .every(point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite))
      || chunk.bounds.min.some((n, index) => n > chunk.bounds.max[index])) {
      throw new Error('建筑模块标识、尺寸或统计无效');
    }
    const url = assetUrl(chunk.url);
    if (urls.has(url)) throw new Error('建筑模块地址重复');
    ids.add(chunk.id); urls.add(url);
  }
  if (!manifest.chunks.some(chunk => chunk.core)) throw new Error('建筑核心模块缺失');
}

function asError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
function abortError() { return new DOMException('建筑加载已取消', 'AbortError'); }
function disposeGeometry(root: THREE.Object3D, extra = new Set<THREE.BufferGeometry>()) {
  root.traverse(object => {
    if (object instanceof THREE.Mesh) extra.add(object.geometry);
  });
  extra.forEach(geometry => geometry.dispose());
  extra.clear(); root.removeFromParent();
}
function observe(action: (() => void) | undefined) {
  // UI observers cannot take ownership of, or break cleanup for, loaded resources.
  try { action?.(); } catch (error) { console.error('Reference library observer failed', error); }
}

/**
 * Three r185 keeps rejected image/dependency promises and converts an image error
 * to a null map. Guard those cache boundaries so retry really restores textures.
 * Keep this narrow adapter covered when updating the installed Three version.
 */
type ParserCaches = GLTFParser & {
  cache: {remove(key: string): void};
  sourceCache: Record<number, Promise<THREE.Texture>>;
  textureCache: Record<string, Promise<THREE.Texture | null>>;
};

export function createReferenceMaterialPool(parser: GLTFParser) {
  const internal = parser as ParserCaches;
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const promises = new Map<number, Promise<THREE.Material>>();
  const pending = new Set<Promise<unknown>>();
  let closing = false;
  let disposal: Promise<void> | undefined;
  function track<T>(promise: Promise<T>) {
    pending.add(promise);
    void promise.then(() => pending.delete(promise), () => pending.delete(promise));
    return promise;
  }
  function ownMaterial(material: THREE.Material) {
    materials.add(material);
    if (material instanceof THREE.MeshStandardMaterial && material.map) material.map.anisotropy = 8;
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    return material;
  }
  const originalImage = parser.loadImageSource.bind(parser);
  parser.loadImageSource = (source, loader) => {
    if (closing) return Promise.reject(abortError());
    const original = originalImage(source, loader);
    return track(original.then(texture => { textures.add(texture); return texture; }, error => {
      if (internal.sourceCache[source] === original) delete internal.sourceCache[source];
      throw error;
    }));
  };
  const originalTextureImage = parser.loadTextureImage.bind(parser);
  parser.loadTextureImage = (index, source, loader) => {
    if (closing) return Promise.reject(abortError());
    const original = originalTextureImage(index, source, loader);
    return track(original.then(texture => {
      if (texture) { textures.add(texture); return texture; }
      const definition = parser.json.textures[index];
      const image = parser.json.images[source];
      const key = `${image.uri || image.bufferView}:${definition.sampler}`;
      if (internal.textureCache[key] === original) delete internal.textureCache[key];
      throw new Error(`建筑纹理加载失败: ${image.uri ?? source}`);
    }));
  };
  const originalDependency = parser.getDependency.bind(parser);
  parser.getDependency = (type, index) => closing ? Promise.reject(abortError()) : track(Promise.resolve(originalDependency(type, index)).then(value => {
    if (value instanceof THREE.Texture) textures.add(value);
    return value;
  }, error => {
    internal.cache.remove(`${type}:${index}`);
    throw error;
  }));
  const originalAssignTexture = parser.assignTexture.bind(parser);
  parser.assignTexture = (...args) => track(originalAssignTexture(...args).then(texture => {
    if (texture) textures.add(texture);
    return texture;
  }));

  function loadMaterial(index: number): Promise<THREE.Material> {
    if (closing) return Promise.reject(abortError());
    const cached = promises.get(index);
    if (cached) return cached;
    // Deliberately call the canonical parser, not each module's material parser.
    const promise = track(Promise.resolve().then(() => {
      if (closing) throw abortError();
      return parser.loadMaterial(index);
    }).then(ownMaterial));
    promises.set(index, promise);
    void promise.catch(() => { if (promises.get(index) === promise) promises.delete(index); });
    return promise;
  }
  function assignFinalMaterial(mesh: THREE.Mesh) {
    // GLTFLoader clones materials for vertex colors/missing tangents. Use ONE
    // parser cache for those variants as well as for the original material.
    parser.assignFinalMaterial(mesh);
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(ownMaterial);
  }
  function abort() {
    if (closing) return;
    closing = true;
    // This loader is owned by the bank. Aborting the shared LoadingManager
    // would also cancel unrelated catalog textures. Do not abort on eviction.
    if (parser.textureLoader instanceof THREE.ImageBitmapLoader) parser.textureLoader.abort();
  }
  function dispose() {
    if (disposal) return disposal;
    abort();
    disposal = (async () => {
      while (pending.size) await Promise.allSettled([...pending]);
      const images = new Set<{close(): void}>();
      const rememberImage = (value: unknown) => {
        if (Array.isArray(value)) value.forEach(rememberImage);
        else if (value && typeof (value as {close?: unknown}).close === 'function') images.add(value as {close(): void});
      };
      materials.forEach(material => material.dispose());
      textures.forEach(texture => { rememberImage(texture.source.data); texture.dispose(); });
      images.forEach(image => image.close());
      materials.clear(); textures.clear(); promises.clear();
    })();
    return disposal;
  }
  return {loadMaterial, assignFinalMaterial, abort, dispose,
    diagnostics: () => ({materials: materials.size, textures: textures.size, pending: pending.size})};
}

async function loadMaterialBank(manager: THREE.LoadingManager, url: string, signal: AbortSignal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`建筑共享材质加载失败 (${response.status})`);
  const data = await response.text();
  signal.throwIfAborted();
  const json = JSON.parse(data);
  // The bank loads textures lazily. A hidden model here would defeat streaming.
  if (json.meshes?.length || json.nodes?.length || json.buffers?.length || json.images?.some((image: {uri?: string}) => !image.uri)) {
    throw new Error('建筑共享材质库必须只包含材质与外部纹理');
  }
  for (const image of json.images ?? []) assetUrl(image.uri, url);
  const gltf = await new GLTFLoader(manager).parseAsync(data, url.slice(0, url.lastIndexOf('/') + 1));
  signal.throwIfAborted();
  return createReferenceMaterialPool(gltf.parser);
}

/** Exact spatial modules, shared shading, bounded work; no model simplification. */
export async function createReferenceLibraryStreaming(options: ReferenceLibraryStreamingOptions): Promise<ReferenceLibraryStreaming> {
  const {parent, manager, signal} = options;
  signal.throwIfAborted();
  let manifest: ReferenceLibraryManifest;
  let bank: ReturnType<typeof createReferenceMaterialPool>;
  try {
    const response = await fetch(REFERENCE_LIBRARY_MANIFEST_URL, {signal});
    if (!response.ok) throw new Error(`建筑模块清单加载失败 (${response.status})`);
    const value: unknown = await response.json();
    validateReferenceLibraryManifest(value);
    manifest = value;
    bank = await loadMaterialBank(manager, assetUrl(manifest.materialsUrl), signal);
  } catch (error) {
    if (!signal.aborted) observe(() => options.onError?.(asError(error)));
    throw error;
  }
  const batcher = createReferenceChunkBatcher(parent, {multiDraw: options.multiDraw, materialCapacityLimits: manifest.materialCapacityLimits});
  const abort = new AbortController();
  const records = manifest.chunks.map(chunk => ({manifest: chunk,
    bounds: new THREE.Box3(new THREE.Vector3(...chunk.bounds.min), new THREE.Vector3(...chunk.bounds.max)),
    state: 'unloaded' as ChunkState, priority: Infinity, lastWantedAt: performance.now(),
    visible: false, shadowRequired: false} as ChunkRecord));
  const queue: ChunkRecord[] = [];
  const jobs = new Set<Promise<void>>();
  const pendingPins = new Map<string, number>();
  let pins = new Set<string>();
  let pinGeneration = 0;
  let active = 0, peak = 0, downloadedBytes = 0;
  let disposed = false, initialized = false, fallbackResidencyLocked = false, consolidating = false;
  let consolidation: Promise<void> | undefined;
  let consolidationError: Error | undefined;
  let disposal: Promise<void> | undefined;
  let evictionTimer: ReturnType<typeof setTimeout> | undefined;
  const notify = () => observe(options.onChange);
  const isPinned = (record: ChunkRecord) => pins.has(record.manifest.id) || (pendingPins.get(record.manifest.id) ?? 0) > 0;
  const wanted = (record: ChunkRecord) => record.manifest.core || (!initialized && record.manifest.startup)
    || record.visible || record.shadowRequired || isPinned(record);

  function updateEviction() {
    if (evictionTimer !== undefined) clearTimeout(evictionTimer);
    evictionTimer = undefined;
    if (disposed || fallbackResidencyLocked) return;
    const now = performance.now();
    let next = Infinity, changed = false;
    for (const record of records) {
      if (wanted(record)) record.lastWantedAt = now;
      if (record.state !== 'resident' || wanted(record)) continue;
      const remaining = record.lastWantedAt + EVICT_AFTER_MS - now;
      if (remaining > 0) next = Math.min(next, remaining);
      else {
        batcher.remove(record.manifest.id);
        record.state = 'unloaded'; record.promise = undefined;
        changed = true;
      }
    }
    if (changed) notify();
    if (Number.isFinite(next)) evictionTimer = setTimeout(updateEviction, Math.max(1, next));
  }

  async function loadChunk(record: ChunkRecord) {
    const started = performance.now();
    const url = assetUrl(record.manifest.url);
    const response = await fetch(url, {signal: abort.signal});
    if (!response.ok) throw new Error(`建筑模块加载失败: ${record.manifest.id} (${response.status})`);
    const bytes = await response.arrayBuffer();
    abort.signal.throwIfAborted();
    if (bytes.byteLength !== record.manifest.bytes) throw new Error(`建筑模块大小与版本不一致: ${record.manifest.id}`);
    // LAN HTTP may not expose SubtleCrypto. Size/revision checks still apply;
    // the generated delivery manifest additionally records every SHA-256.
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
      if (hash !== record.manifest.sha256.toLowerCase()) throw new Error(`建筑模块校验失败: ${record.manifest.id}`);
    }
    abort.signal.throwIfAborted();
    downloadedBytes += bytes.byteLength;
    observe(() => options.onSlice?.(performance.now() - started, 'reference-module-fetch-wall'));
    const geometry = new Set<THREE.BufferGeometry>();
    const geometryJobs = new Set<Promise<THREE.BufferGeometry[]>>();
    let group: THREE.Group | undefined;
    let consumed = false;
    try {
      const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
      loader.register(parser => {
        const original = parser.loadGeometries.bind(parser);
        parser.loadGeometries = primitives => {
          const job = original(primitives).then(values => { values.forEach(value => geometry.add(value)); return values; });
          geometryJobs.add(job);
          void job.then(() => geometryJobs.delete(job), () => geometryJobs.delete(job));
          return job;
        };
        parser.assignFinalMaterial = mesh => bank.assignFinalMaterial(mesh);
        return {name: 'BOOKKIN_shared_material_bank', loadMaterial: index => bank.loadMaterial(index)};
      });
      const decodeStarted = performance.now();
      const gltf = await loader.parseAsync(bytes, url.slice(0, url.lastIndexOf('/') + 1));
      group = gltf.scene;
      abort.signal.throwIfAborted();
      group.name = `Reference library module: ${record.manifest.id}`;
      group.traverse(object => {
        if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
      });
      observe(() => options.onSlice?.(performance.now() - decodeStarted, 'reference-module-decode-wall'));
      const attachStarted = performance.now();
      abort.signal.throwIfAborted();
      await batcher.addProgressively(record.manifest.id, group, {
        signal: abort.signal,
        onSlice: (milliseconds, stage) => observe(() => options.onSlice?.(milliseconds, stage)),
      });
      consumed = true; // The batcher owns originals and generated geometry now.
      geometry.clear();
      abort.signal.throwIfAborted();
      record.state = 'resident'; record.lastWantedAt = performance.now();
      observe(() => options.onSlice?.(performance.now() - attachStarted, 'reference-module-attach-wall'));
    } finally {
      // A material failure may precede geometry decoding in GLTFLoader's
      // Promise.all. Settle those decodes before disposing an unmounted chunk.
      while (geometryJobs.size) await Promise.allSettled([...geometryJobs]);
      if (!consumed) disposeGeometry(group ?? new THREE.Group(), geometry);
    }
  }

  function consolidateWhenIdle() {
    if (disposed || options.multiDraw || consolidation || active || queue.length
      || records.some(record => record.state !== 'resident')) return;
    // Fallback material merging trades per-module eviction for fewer submissions.
    // Never mutate chunk ownership again after this irreversible, bounded step.
    fallbackResidencyLocked = true; consolidating = true;
    if (evictionTimer !== undefined) clearTimeout(evictionTimer);
    evictionTimer = undefined;
    const started = performance.now();
    consolidation = batcher.consolidateFallback().catch(error => {
      if (!disposed) {
        consolidationError = asError(error);
        observe(() => options.onError?.(consolidationError!, 'fallback-consolidation'));
      }
    }).finally(() => {
      consolidating = false;
      if (!disposed) {
        observe(() => options.onSlice?.(performance.now() - started, 'reference-fallback-consolidation-wall'));
        notify();
      }
    });
    notify();
  }

  function pump() {
    if (disposed) return;
    queue.sort((a, b) => a.priority - b.priority);
    while (active < MAX_CONCURRENT_LOADS && queue.length) {
      const record = queue.shift()!;
      active++; peak = Math.max(peak, active); record.state = 'loading';
      const job = loadChunk(record).then(() => record.resolve?.(), error => {
        if (disposed) record.state = 'unloaded';
        else {
          record.state = 'failed'; record.error = asError(error);
          observe(() => options.onError?.(record.error!, record.manifest.id));
        }
        record.reject?.(disposed ? abortError() : error);
      }).finally(() => {
        active--; jobs.delete(job);
        record.resolve = undefined; record.reject = undefined;
        if (!disposed) { updateEviction(); pump(); notify(); }
      });
      jobs.add(job);
    }
    consolidateWhenIdle();
    notify();
  }

  function request(record: ChunkRecord, priority: number, retry = false): Promise<void> {
    if (disposed) return Promise.reject(abortError());
    if (record.state === 'resident') return Promise.resolve();
    if (record.state === 'failed' && !retry) return Promise.reject(record.error);
    record.priority = Math.min(record.priority, priority);
    if (record.state === 'queued' || record.state === 'loading') { pump(); return record.promise!; }
    record.state = 'queued'; record.error = undefined;
    record.promise = new Promise<void>((resolve, reject) => { record.resolve = resolve; record.reject = reject; });
    // Background visibility requests have no awaited caller. Retain the original
    // rejection for ensurePoint/startup/retry without unhandled promise noise.
    void record.promise.catch(() => undefined);
    queue.push(record); pump();
    return record.promise;
  }

  function updateView(camera: THREE.Camera, shadowCameras: readonly THREE.Camera[] = []) {
    if (disposed) return;
    parent.updateWorldMatrix(true, false);
    const frustumFor = (value: THREE.Camera) => {
      value.updateWorldMatrix(true, false);
      return new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(value.projectionMatrix, value.matrixWorldInverse), value.coordinateSystem, value.reversedDepth);
    };
    const frustum = frustumFor(camera);
    const shadows = shadowCameras.map(frustumFor);
    const position = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    for (const record of records) {
      const worldBounds = record.bounds.clone().applyMatrix4(parent.matrixWorld);
      record.visible = frustum.intersectsBox(worldBounds) || worldBounds.distanceToPoint(position) <= CAMERA_NEIGHBORHOOD;
      record.shadowRequired = shadows.some(shadow => shadow.intersectsBox(worldBounds));
      if (wanted(record)) void request(record, isPinned(record) ? 0 : record.visible ? 2 : 3).catch(() => undefined);
    }
    updateEviction();
  }

  async function ensurePoint(point: Point) {
    if (disposed) throw abortError();
    if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('建筑目标坐标无效');
    parent.updateWorldMatrix(true, false);
    const local = parent.worldToLocal(new THREE.Vector3(point.x, point.y, point.z));
    let neighborhood = records.filter(record => record.bounds.distanceToPoint(local) <= POINT_NEIGHBORHOOD);
    if (!neighborhood.length) neighborhood = [...records].sort((a, b) => a.bounds.distanceToPoint(local) - b.bounds.distanceToPoint(local)).slice(0, 1);
    const generation = ++pinGeneration;
    neighborhood.forEach(record => pendingPins.set(record.manifest.id, (pendingPins.get(record.manifest.id) ?? 0) + 1));
    try {
      await Promise.all(neighborhood.map(record => request(record, 0)));
      if (disposed) throw abortError();
      if (generation === pinGeneration) pins = new Set(neighborhood.map(record => record.manifest.id));
    } finally {
      neighborhood.forEach(record => {
        const count = (pendingPins.get(record.manifest.id) ?? 1) - 1;
        if (count) pendingPins.set(record.manifest.id, count); else pendingPins.delete(record.manifest.id);
      });
      updateEviction();
    }
  }

  async function retryFailed() {
    if (disposed) throw abortError();
    await Promise.all(records.filter(record => record.state === 'failed').map(record => request(record, 0, true)));
  }

  function diagnostics(): ReferenceLibraryStreamingDiagnostics {
    const resident = records.filter(record => record.state === 'resident');
    const failures = records.filter(record => record.state === 'failed')
      .map(record => ({id: record.manifest.id, url: assetUrl(record.manifest.url), message: record.error?.message ?? '建筑模块加载失败'}));
    return {revision: manifest.revision,
      phase: disposed ? 'disposed' : failures.length || consolidationError ? 'error' : !initialized ? 'loading'
        : consolidating ? 'consolidating' : active || queue.length ? 'streaming' : 'ready',
      totalModules: records.length, residentModules: resident.length,
      startupModules: records.filter(record => record.manifest.core || record.manifest.startup).length,
      startupResidentModules: resident.filter(record => record.manifest.core || record.manifest.startup).length,
      allDetailsResident: resident.length === records.length, requiredModules: records.filter(wanted).length,
      fallbackResidencyLocked, consolidationError: consolidationError?.message ?? null,
      loadingModules: active, queuedModules: queue.length,
      failedModules: failures.length, maxConcurrentLoads: MAX_CONCURRENT_LOADS, peakConcurrentLoads: peak,
      residentBytes: resident.reduce((total, record) => total + record.manifest.bytes, 0),
      residentGeometryBytes: resident.reduce((total, record) => total + record.manifest.decodedGeometryBytes, 0),
      residentTriangles: resident.reduce((total, record) => total + record.manifest.triangles, 0),
      totalBytes: records.reduce((total, record) => total + record.manifest.bytes, 0), downloadedBytes,
      shadowRequiredModules: records.filter(record => record.shadowRequired).length,
      pinnedModules: records.filter(isPinned).length, failures,
      modules: records.map(record => ({id: record.manifest.id, state: record.state, visible: record.visible,
        shadowRequired: record.shadowRequired, pinned: isPinned(record)})),
      sharedResources: bank.diagnostics(), batching: batcher.diagnostics()};
  }

  function dispose() {
    if (disposal) return disposal;
    disposed = true; abort.abort(); bank.abort();
    signal.removeEventListener('abort', onAbort);
    if (evictionTimer !== undefined) clearTimeout(evictionTimer);
    for (const record of queue.splice(0)) { record.state = 'unloaded'; record.reject?.(abortError()); }
    // Immediate detach prevents the outer scene disposer from also owning maps.
    batcher.dispose();
    records.filter(record => record.state === 'resident').forEach(record => { record.state = 'unloaded'; });
    disposal = (async () => {
      await Promise.allSettled([...jobs]);
      await consolidation;
      await bank.dispose();
      pins.clear(); pendingPins.clear();
    })();
    return disposal;
  }
  function onAbort() { void dispose(); }
  signal.addEventListener('abort', onAbort, {once: true});
  const controller: ReferenceLibraryStreaming = {updateView, ensurePoint, retryFailed, diagnostics, dispose};
  try {
    signal.throwIfAborted();
    await Promise.all(records.filter(record => record.manifest.core || record.manifest.startup)
      .map(record => request(record, record.manifest.core ? 0 : 1)));
    signal.throwIfAborted();
    initialized = true; updateEviction(); notify();
    return controller;
  } catch (error) {
    await dispose();
    throw error;
  }
}
