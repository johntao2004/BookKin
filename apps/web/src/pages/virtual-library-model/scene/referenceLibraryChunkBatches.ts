import * as THREE from 'three';

interface Pool {
  key: string;
  mesh: THREE.BatchedMesh;
  vertices: number;
  indices: number;
  instances: number;
  vertexCapacity: number;
  indexCapacity: number;
}

interface Allocation {
  pool: Pool;
  geometryId: number;
  vertices: number;
  indices: number;
}

interface Chunk {
  root: THREE.Group;
  allocations: Allocation[];
  geometries: Set<THREE.BufferGeometry>;
  bounds: THREE.Box3;
  triangles: number;
  primitives: number;
  drawSubmissions: number;
  independentPrimitives: number;
  independentDrawSubmissions: number;
  fallback: boolean;
  fallbackReason: string | null;
}

const describeBounds = (box: THREE.Box3) => box.isEmpty() ? null : {
  min: box.min.toArray(), max: box.max.toArray(),
};

function geometryArrays(geometry: THREE.BufferGeometry) {
  const arrays = new Set<THREE.TypedArray>();
  if (geometry.index) arrays.add(geometry.index.array);
  for (const attribute of Object.values(geometry.attributes)) {
    arrays.add(attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data.array : attribute.array);
  }
  for (const attributes of Object.values(geometry.morphAttributes)) {
    for (const attribute of attributes) arrays.add(attribute.array);
  }
  return arrays;
}

function primitiveStats(mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  const count = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0;
  const start = Math.max(0, geometry.drawRange.start);
  const end = Math.min(count, start + geometry.drawRange.count);
  const instances = mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
  const groups = Array.isArray(mesh.material) ? geometry.groups : [{start, count: end - start, materialIndex: 0}];
  let triangles = 0, primitives = 0, drawSubmissions = 0;
  for (const group of groups) {
    const material = Array.isArray(mesh.material) ? mesh.material[group.materialIndex ?? 0] : mesh.material;
    if (!material) continue;
    const length = Math.max(0, Math.min(end, group.start + group.count) - Math.max(start, group.start));
    if (length === 0) continue;
    triangles += length / 3 * instances;
    primitives++;
    drawSubmissions += material.transparent && material.side === THREE.DoubleSide && !material.forceSinglePass ? 2 : 1;
  }
  return {triangles, primitives, drawSubmissions};
}

function signature(mesh: THREE.Mesh) {
  const attributes = Object.entries(mesh.geometry.attributes).sort(([a], [b]) => a.localeCompare(b))
    .map(([name, attribute]) => {
      const a = attribute as THREE.BufferAttribute;
      return `${name}:${a.array.constructor.name}:${a.itemSize}:${a.normalized}:${a.gpuType}`;
    }).join('|');
  return `${(mesh.material as THREE.Material).uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.layers.mask}:${mesh.renderOrder}:${!!mesh.geometry.index}:${attributes}`;
}

function unsupportedReason(mesh: THREE.Mesh, matrix: THREE.Matrix4) {
  if (mesh instanceof THREE.InstancedMesh || mesh instanceof THREE.SkinnedMesh || mesh instanceof THREE.BatchedMesh) return 'specialized-mesh';
  if (Array.isArray(mesh.material)) return 'multiple-materials';
  if (mesh.material instanceof THREE.ShaderMaterial) return 'custom-shader';
  if (mesh.material.transparent) return 'transparent-material';
  if (mesh.customDepthMaterial || mesh.customDistanceMaterial) return 'custom-shadow-material';
  if (Object.keys(mesh.geometry.morphAttributes).length) return 'morph-attributes';
  if (!mesh.frustumCulled) return 'custom-culling';
  if (matrix.determinant() <= 0) return 'non-positive-transform';
  if (!mesh.geometry.getAttribute('position')?.count) return 'missing-position';
  if (mesh.geometry.drawRange.start !== 0 || (Number.isFinite(mesh.geometry.drawRange.count)
    && mesh.geometry.drawRange.count !== (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count))) return 'partial-draw-range';
  if (Object.values(mesh.geometry.attributes).some(attribute => !(attribute instanceof THREE.BufferAttribute)
    || attribute instanceof THREE.InstancedBufferAttribute || attribute instanceof THREE.Float16BufferAttribute
    || attribute.gpuType !== THREE.FloatType)) return 'specialized-attributes';
  // Native BatchedMesh callbacks must remain in control of its draw list.
  if (mesh.onBeforeRender !== THREE.Mesh.prototype.onBeforeRender || mesh.onBeforeShadow !== THREE.Mesh.prototype.onBeforeShadow) return 'custom-render-callback';
  return null;
}

interface MergeSource { mesh: THREE.Mesh; matrix: THREE.Matrix4; chunk: Chunk }

/** Direct typed-array concatenation avoids cloning every source and avoids the
 * temporary JavaScript number[] index list used by a generic geometry merge. */
function mergeSources(sources: MergeSource[]) {
  const first = sources[0].mesh.geometry;
  const vertices = sources.reduce((sum, {mesh}) => sum + mesh.geometry.getAttribute('position').count, 0);
  const indices = sources.reduce((sum, {mesh}) => sum + (mesh.geometry.index?.count ?? 0), 0);
  const geometry = new THREE.BufferGeometry();
  try {
    for (const [name, value] of Object.entries(first.attributes)) {
      const attribute = value as THREE.BufferAttribute;
      const ArrayType = attribute.array.constructor as THREE.TypedArrayConstructor;
      const target = new THREE.BufferAttribute(new ArrayType(vertices * attribute.itemSize), attribute.itemSize, attribute.normalized);
      target.gpuType = attribute.gpuType;
      geometry.setAttribute(name, target);
    }
    if (first.index) geometry.setIndex(new THREE.BufferAttribute(vertices > 65_535 ? new Uint32Array(indices) : new Uint16Array(indices), 1));
    let vertexOffset = 0, indexOffset = 0;
    const identity = new THREE.Matrix4();
    for (const {mesh, matrix} of sources) {
      const count = mesh.geometry.getAttribute('position').count;
      // This view owns no new typed arrays. Transform only this source's slice.
      const view = new THREE.BufferGeometry();
      for (const [name, value] of Object.entries(mesh.geometry.attributes)) {
        const attribute = value as THREE.BufferAttribute;
        const target = geometry.getAttribute(name) as THREE.BufferAttribute;
        const start = vertexOffset * attribute.itemSize;
        target.array.set(attribute.array, start);
        view.setAttribute(name, new THREE.BufferAttribute(target.array.subarray(start, start + count * attribute.itemSize), attribute.itemSize, attribute.normalized));
      }
      if (!matrix.equals(identity)) view.applyMatrix4(matrix);
      if (mesh.geometry.index && geometry.index) {
        for (let i = 0; i < mesh.geometry.index.count; i++) geometry.index.array[indexOffset + i] = mesh.geometry.index.getX(i) + vertexOffset;
        indexOffset += mesh.geometry.index.count;
      }
      vertexOffset += count;
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  } catch (error) { geometry.dispose(); throw error; }
}

/**
 * Owns static chunk geometries, never shared materials or textures. add() consumes
 * the supplied group on success. Its geometry must not be shared outside this
 * helper. Chunk transforms/visibility are snapshots; remove/add to change them.
 * Call only between renders. multiDraw must come from the actual renderer's
 * WEBGL_multi_draw capability, not a browser-name guess.
 */
export function createReferenceChunkBatcher(parent: THREE.Group, options: {
  multiDraw: boolean;
  materialCapacityLimits?: readonly {name: string; vertices: number; indices: number}[]
    | Readonly<Record<string, {vertices: number; indices: number}>>;
}) {
  const chunks = new Map<string, Chunk>();
  const pools = new Map<string, Pool>();
  const consolidatedMeshes = new Set<THREE.Mesh>();
  let disposed = false;
  let fallbackEvictionLocked = false, consolidatedFallback = false, consolidationInProgress = false;
  let consolidationCpuMs = 0, consolidationPeakGeometryBytes = 0;
  let consolidation: Promise<void> | null = null;
  let pendingSourceGeometryBytes = 0, mutationPeakGeometryBytes = 0, lastAddCpuMs = 0, maxAddCpuMs = 0, maxRemoveCpuMs = 0;
  let maxAddSliceCpuMs = 0, pendingAddCount = 0, adding = false;
  let pendingRoot: THREE.Group | null = null;
  let additionQueue: Promise<void> = Promise.resolve();
  const capacityLimits = new Map<string, {vertices: number; indices: number}>(Array.isArray(options.materialCapacityLimits)
    ? options.materialCapacityLimits.map(limit => [limit.name, limit])
    : Object.entries(options.materialCapacityLimits ?? {}));

  function recordCopyPeak(reference: THREE.BufferGeometry, vertices: number, indices: number) {
    const bytes = Object.values(reference.attributes).reduce((sum, attribute) =>
      sum + vertices * attribute.itemSize * (attribute as THREE.BufferAttribute).array.BYTES_PER_ELEMENT, 0)
      + (reference.index ? indices * (vertices > 65_535 ? 4 : 2) : 0);
    mutationPeakGeometryBytes = Math.max(mutationPeakGeometryBytes,
      diagnostics().allocatedGeometryBytes + pendingSourceGeometryBytes + bytes);
  }

  function refreshBounds(pool: Pool) {
    pool.mesh.computeBoundingBox();
    pool.mesh.computeBoundingSphere();
  }

  function reclaim(pool: Pool) {
    if (pool.instances === 0) {
      pool.mesh.removeFromParent();
      pool.mesh.dispose();
      pools.delete(pool.key);
      return;
    }
    // deleteGeometry alone neither reuses holes nor releases geometry buffers.
    pool.mesh.optimize();
    const vertices = pool.vertices * 2 <= pool.vertexCapacity ? Math.ceil(pool.vertices * 1.25) : pool.vertexCapacity;
    const indices = pool.indices * 2 <= pool.indexCapacity ? Math.ceil(pool.indices * 1.25) : pool.indexCapacity;
    if (vertices !== pool.vertexCapacity || indices !== pool.indexCapacity) {
      recordCopyPeak(pool.mesh.geometry, vertices, indices);
      pool.mesh.setGeometrySize(vertices, indices);
      pool.vertexCapacity = vertices;
      pool.indexCapacity = indices;
    }
    // Instance IDs stay stable. Their small data textures retain peak capacity
    // until the entire pool is disposed; this is exposed in diagnostics.
    refreshBounds(pool);
  }

  function releaseAllocations(allocations: Allocation[]) {
    const affected = new Set<Pool>();
    for (const allocation of allocations) {
      const {pool, geometryId, vertices, indices} = allocation;
      pool.mesh.deleteGeometry(geometryId); // Also deletes its associated instance.
      pool.vertices -= vertices;
      pool.indices -= indices;
      pool.instances--;
      affected.add(pool);
    }
    affected.forEach(reclaim);
  }

  function reserve(key: string, source: THREE.Mesh, vertices: number, indices: number, instances: number) {
    let pool = pools.get(key);
    const limit = capacityLimits.get((source.material as THREE.Material).name);
    const neededVertices = (pool?.vertices ?? 0) + vertices, neededIndices = (pool?.indices ?? 0) + indices;
    if (limit && (neededVertices > limit.vertices || neededIndices > limit.indices)) throw new Error('Reference material geometry exceeds its manifest capacity');
    if (!pool) {
      recordCopyPeak(source.geometry, vertices, indices);
      const mesh = new THREE.BatchedMesh(instances, vertices, indices, source.material as THREE.Material);
      mesh.name = 'Reference chunk material pool';
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      mesh.layers.mask = source.layers.mask;
      mesh.renderOrder = source.renderOrder;
      mesh.perObjectFrustumCulled = true;
      mesh.userData.referenceChunkBatch = true;
      pool = {key, mesh, vertices: 0, indices: 0, instances: 0, vertexCapacity: vertices, indexCapacity: indices};
      pools.set(key, pool);
      parent.add(mesh);
    } else {
      const vertexCapacity = neededVertices > pool.vertexCapacity
        ? Math.min(limit?.vertices ?? Infinity, Math.max(neededVertices, Math.ceil(pool.vertexCapacity * 1.5))) : pool.vertexCapacity;
      const indexCapacity = neededIndices > pool.indexCapacity
        ? Math.min(limit?.indices ?? Infinity, Math.max(neededIndices, Math.ceil(pool.indexCapacity * 1.5))) : pool.indexCapacity;
      if (vertexCapacity !== pool.vertexCapacity || indexCapacity !== pool.indexCapacity) {
        recordCopyPeak(source.geometry, vertexCapacity, indexCapacity);
        pool.mesh.setGeometrySize(vertexCapacity, indexCapacity);
        pool.vertexCapacity = vertexCapacity;
        pool.indexCapacity = indexCapacity;
      }
      if (pool.instances + instances > pool.mesh.maxInstanceCount) {
        pool.mesh.setInstanceCount(Math.max(pool.instances + instances, Math.ceil(pool.mesh.maxInstanceCount * 1.5)));
      }
    }
    return pool;
  }

  function* addSteps(id: string, group: THREE.Group): Generator<void, void, unknown> {
    if (disposed) throw new Error('Reference chunk batcher is disposed');
    if (adding) throw new Error('Reference chunk addition is in progress; use addProgressively to queue additions');
    if (fallbackEvictionLocked) throw new Error('Reference fallback consolidation requires full residency; chunks cannot be added');
    if (chunks.has(id)) throw new Error(`Reference chunk is already loaded: ${id}`);
    let sliceStarted = performance.now(), cpuMs = 0;
    const finishSlice = () => {
      const duration = performance.now() - sliceStarted;
      cpuMs += duration; maxAddSliceCpuMs = Math.max(maxAddSliceCpuMs, duration);
    };
    adding = true; pendingRoot = group;
    const previousParent = group.parent;
    parent.add(group);
    parent.updateWorldMatrix(true, true);
    const inverse = parent.matrixWorld.clone().invert();
    const sources: {mesh: THREE.Mesh; matrix: THREE.Matrix4; visible: boolean; key: string}[] = [];
    const chunk: Chunk = {root: group, allocations: [], geometries: new Set(), bounds: new THREE.Box3(),
      triangles: 0, primitives: 0, drawSubmissions: 0, independentPrimitives: 0, independentDrawSubmissions: 0, fallback: !options.multiDraw,
      fallbackReason: options.multiDraw ? null : 'WEBGL_multi_draw-unavailable'};
    const touchedPools = new Set<Pool>();
    try {
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const matrix = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
        let visible = object.visible;
        for (let owner = object.parent; owner && owner !== parent; owner = owner.parent) visible &&= owner.visible;
        const reason = unsupportedReason(object, matrix);
        if (reason) { chunk.fallback = true; chunk.fallbackReason ??= reason; }
        sources.push({mesh: object, matrix, visible, key: reason ? '' : signature(object)});
        chunk.geometries.add(object.geometry);
        const stats = primitiveStats(object);
        chunk.triangles += stats.triangles; chunk.primitives += stats.primitives;
        chunk.drawSubmissions += stats.drawSubmissions;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        // GLTFLoader also derives its conservative sphere directly from accessor
        // bounds. Avoid BatchedMesh rescanning every vertex when only a box exists.
        if (!object.geometry.boundingSphere && object.geometry.boundingBox) {
          object.geometry.boundingSphere = object.geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
        }
        if (object.geometry.boundingBox) chunk.bounds.union(object.geometry.boundingBox.clone().applyMatrix4(matrix));
      });
      const sourceArrays = new Set<THREE.TypedArray>();
      chunk.geometries.forEach(geometry => geometryArrays(geometry).forEach(array => sourceArrays.add(array)));
      pendingSourceGeometryBytes = [...sourceArrays].reduce((sum, array) => sum + array.byteLength, 0);
      mutationPeakGeometryBytes = Math.max(mutationPeakGeometryBytes, diagnostics().allocatedGeometryBytes + pendingSourceGeometryBytes);
      if (chunk.fallback) {
        chunk.independentPrimitives = chunk.primitives;
        chunk.independentDrawSubmissions = chunk.drawSubmissions;
      }
      if (!chunk.fallback) {
        const requests = new Map<string, {source: THREE.Mesh; vertices: number; indices: number; instances: number; sources: typeof sources}>();
        for (const entry of sources) {
          const {mesh, key} = entry;
          const request = requests.get(key) ?? {source: mesh, vertices: 0, indices: 0, instances: 0, sources: []};
          request.vertices += mesh.geometry.getAttribute('position').count;
          request.indices += mesh.geometry.index?.count ?? 0;
          request.instances++;
          request.sources.push(entry);
          requests.set(key, request);
        }
        const visibility: {pool: Pool; instanceId: number; visible: boolean}[] = [];
        for (const [key, request] of requests) {
          const pool = reserve(key, request.source, request.vertices, request.indices, request.instances);
          touchedPools.add(pool);
          for (const {mesh, matrix, visible} of request.sources) {
            const geometryId = pool.mesh.addGeometry(mesh.geometry);
            try {
              const instanceId = pool.mesh.addInstance(geometryId);
              pool.mesh.setMatrixAt(instanceId, matrix);
              // Originals remain visible throughout a progressive copy. Swap
              // once, after every material succeeds, without a duplicate frame.
              pool.mesh.setVisibleAt(instanceId, false);
              visibility.push({pool, instanceId, visible});
            } catch (error) { pool.mesh.deleteGeometry(geometryId); throw error; }
            const vertices = mesh.geometry.getAttribute('position').count, indices = mesh.geometry.index?.count ?? 0;
            pool.vertices += vertices; pool.indices += indices; pool.instances++;
            chunk.allocations.push({pool, geometryId, vertices, indices});
          }
          refreshBounds(pool);
          finishSlice();
          yield;
          sliceStarted = performance.now();
          if (disposed) throw new Error('Reference chunk batcher was disposed during progressive addition');
        }
        for (const {pool, instanceId, visible} of visibility) pool.mesh.setVisibleAt(instanceId, visible);
        // Only release the originals after every copy and bounds calculation
        // succeeded, so a failed add leaves the caller's source group usable.
        sources.forEach(({mesh}) => mesh.removeFromParent());
        chunk.geometries.forEach(geometry => geometry.dispose());
        chunk.geometries.clear();
      }
      chunks.set(id, chunk);
    } catch (error) {
      if (!disposed) {
        releaseAllocations(chunk.allocations);
        for (const pool of touchedPools) if (pools.has(pool.key)) reclaim(pool);
      }
      group.removeFromParent();
      if (!disposed) previousParent?.add(group);
      throw error;
    } finally {
      pendingSourceGeometryBytes = 0;
      adding = false; pendingRoot = null;
      finishSlice(); lastAddCpuMs = cpuMs;
      maxAddCpuMs = Math.max(maxAddCpuMs, lastAddCpuMs);
    }
  }

  function add(id: string, group: THREE.Group) {
    const steps = addSteps(id, group);
    while (!steps.next().done) { /* Synchronous compatibility path. */ }
  }

  /** Serialized async additions yield between individual material copies. A
   * failed/disposed uncommitted group remains caller-owned, as with add(). */
  function addProgressively(id: string, group: THREE.Group, progress: {
    signal?: AbortSignal;
    onSlice?: (milliseconds: number, stage: string) => void;
  } = {}) {
    pendingAddCount++;
    const task = additionQueue.then(async () => {
      const steps = addSteps(id, group);
      const advance = () => {
        const started = performance.now();
        const step = steps.next();
        // Observers run only while rollback is still possible, before commit.
        if (!step.done) progress.onSlice?.(performance.now() - started, 'reference-chunk-material-copy');
        return step;
      };
      try {
        progress.signal?.throwIfAborted();
        let step = advance();
        while (!step.done) {
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          progress.signal?.throwIfAborted();
          step = advance();
        }
      } catch (error) {
        // Throw into a paused transaction so its catch performs rollback; a
        // plain generator.return() would run finally without deleting copies.
        try { steps.throw(error); } catch { /* Preserve the original failure. */ }
        throw error;
      } finally { steps.return(); }
    });
    additionQueue = task.catch(() => undefined);
    void task.then(() => { pendingAddCount--; }, () => { pendingAddCount--; });
    return task;
  }

  function remove(id: string) {
    if (fallbackEvictionLocked && chunks.has(id)) throw new Error('Reference fallback consolidation requires full residency; dispose the scene to release it');
    const chunk = chunks.get(id);
    if (!chunk) return false;
    const started = performance.now();
    releaseAllocations(chunk.allocations);
    chunk.root.removeFromParent();
    chunk.geometries.forEach(geometry => geometry.dispose());
    chunk.geometries.clear(); chunk.allocations.length = 0;
    chunks.delete(id);
    maxRemoveCpuMs = Math.max(maxRemoveCpuMs, performance.now() - started);
    return true;
  }

  function diagnostics() {
    const arrays = new Set<THREE.TypedArray>(), backingBuffers = new Set<ArrayBufferLike>();
    const bounds = new THREE.Box3();
    let residentTriangles = 0, residentPrimitives = 0, fallbackPrimitives = 0, fallbackDrawSubmissions = 0;
    const modules = [...chunks.entries()].map(([id, chunk]) => {
      residentTriangles += chunk.triangles; residentPrimitives += chunk.primitives;
      fallbackPrimitives += chunk.independentPrimitives;
      fallbackDrawSubmissions += chunk.independentDrawSubmissions;
      bounds.union(chunk.bounds);
      chunk.geometries.forEach(geometry => geometryArrays(geometry).forEach(array => arrays.add(array)));
      return {id, triangles: chunk.triangles, primitives: chunk.primitives, fallback: chunk.fallback,
        fallbackReason: chunk.fallbackReason, independentPrimitives: chunk.independentPrimitives, bounds: describeBounds(chunk.bounds)};
    });
    for (const mesh of consolidatedMeshes) geometryArrays(mesh.geometry).forEach(array => arrays.add(array));
    fallbackPrimitives += consolidatedMeshes.size;
    fallbackDrawSubmissions += consolidatedMeshes.size;
    const capacities = [...pools.values()].map(pool => {
      const ownedArrays = geometryArrays(pool.mesh.geometry);
      ownedArrays.forEach(array => arrays.add(array));
      return {material: pool.mesh.material.name, materialId: pool.mesh.material.uuid, instances: pool.instances,
        instanceCapacity: pool.mesh.maxInstanceCount, vertices: pool.vertices, vertexCapacity: pool.vertexCapacity,
        indices: pool.indices, indexCapacity: pool.indexCapacity,
        allocatedGeometryBytes: [...ownedArrays].reduce((total, array) => total + array.byteLength, 0),
        bounds: pool.mesh.boundingBox ? describeBounds(pool.mesh.boundingBox) : null};
    });
    for (const array of arrays) backingBuffers.add(array.buffer);
    // Formula matches the installed Three.js 0.185.1 BatchedMesh. These CPU
    // arrays/data textures are separate from geometry, and are not a GPU-memory
    // measurement. Instance capacity is intentionally visible rather than hidden.
    const estimatedBatchAuxiliaryBytes = [...pools.values()].reduce((total, {mesh}) => {
      const count = mesh.maxInstanceCount;
      const matrixSide = Math.max(4, Math.ceil(Math.sqrt(count * 4) / 4) * 4);
      return total + matrixSide ** 2 * 16 + Math.ceil(Math.sqrt(count)) ** 2 * 4 + count * 8;
    }, 0);
    return {
      mode: options.multiDraw ? 'multi-draw' as const : 'independent-meshes' as const,
      residentModules: chunks.size, residentTriangles, residentPrimitives,
      batchCount: pools.size + consolidatedMeshes.size, fallbackPrimitives,
      // Architecture is opaque. This is a topology/submission bound for ONE
      // pass, not renderer.info.render.calls or a frame/shadow total.
      possiblePrimitiveDrawCount: [...pools.values()].reduce((sum, pool) => sum + pool.instances, 0) + fallbackPrimitives,
      singlePassDrawUpperBound: pools.size + fallbackDrawSubmissions,
      allocatedGeometryBufferCount: arrays.size,
      allocatedGeometryBytes: [...arrays].reduce((total, array) => total + array.byteLength, 0),
      uniqueGeometryBackingBufferCount: backingBuffers.size,
      geometryBackingBytes: [...backingBuffers].reduce((total, buffer) => total + buffer.byteLength, 0),
      estimatedBatchAuxiliaryBytes, bounds: describeBounds(bounds), modules, capacities,
      consolidatedFallback, consolidatedBatchCount: consolidatedMeshes.size, consolidationInProgress,
      fallbackEvictionLocked, consolidationCpuMs, consolidationPeakGeometryBytes,
      lastAddCpuMs, maxAddCpuMs, maxAddSliceCpuMs, maxRemoveCpuMs, mutationPeakGeometryBytes, pendingAddCount, adding,
    };
  }

  /** One-shot, full-resident fallback. It intentionally trades per-chunk culling
   * and eviction for material-level submission counts. Each material is committed
   * atomically, then yields. On failure the existing mixed scene stays usable but
   * locked; callers may retain it or dispose/reload, never mutate stale metadata. */
  function consolidateFallback(): Promise<void> {
    if (disposed) return Promise.reject(new Error('Reference chunk batcher is disposed'));
    if (options.multiDraw) return Promise.resolve();
    if (consolidation) return consolidation;
    if (adding || pendingAddCount) return Promise.reject(new Error('Reference chunk additions must finish before fallback consolidation'));
    fallbackEvictionLocked = true;
    consolidationInProgress = true;
    consolidation = (async () => {
      try {
        const preparedAt = performance.now();
        const requests = new Map<string, MergeSource[]>();
        parent.updateWorldMatrix(true, true);
        const inverse = parent.matrixWorld.clone().invert();
        for (const chunk of chunks.values()) chunk.root.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const matrix = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
          if (unsupportedReason(object, matrix)) return;
          let visible = object.visible;
          for (let owner = object.parent; owner && owner !== parent; owner = owner.parent) visible &&= owner.visible;
          // Hidden/static pieces remain separate; merging must not reveal them.
          if (!visible) return;
          const key = signature(object), request = requests.get(key) ?? [];
          request.push({mesh: object, matrix, chunk}); requests.set(key, request);
        });
        consolidationPeakGeometryBytes = diagnostics().allocatedGeometryBytes;
        consolidationCpuMs += performance.now() - preparedAt;
        for (const sources of requests.values()) {
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          if (disposed) throw new Error('Reference chunk batcher was disposed during fallback consolidation');
          const started = performance.now();
          const source = sources[0].mesh;
          const geometry = mergeSources(sources);
          const copiedBytes = [...geometryArrays(geometry)].reduce((sum, array) => sum + array.byteLength, 0);
          consolidationPeakGeometryBytes = Math.max(consolidationPeakGeometryBytes, diagnostics().allocatedGeometryBytes + copiedBytes);
          const merged = new THREE.Mesh(geometry, source.material);
          merged.name = 'Reference full-resident material batch';
          merged.castShadow = source.castShadow; merged.receiveShadow = source.receiveShadow;
          merged.layers.mask = source.layers.mask; merged.renderOrder = source.renderOrder;
          merged.userData.referenceChunkBatch = true;
          parent.add(merged); consolidatedMeshes.add(merged);
          const candidates = new Set<THREE.BufferGeometry>(), affected = new Set<Chunk>();
          for (const {mesh, chunk} of sources) {
            const stats = primitiveStats(mesh);
            chunk.independentPrimitives -= stats.primitives;
            chunk.independentDrawSubmissions -= stats.drawSubmissions;
            candidates.add(mesh.geometry); affected.add(chunk); mesh.removeFromParent();
          }
          for (const chunk of affected) {
            chunk.geometries.clear();
            chunk.root.traverse(object => { if (object instanceof THREE.Mesh) chunk.geometries.add(object.geometry); });
          }
          for (const geometry of candidates) {
            if (![...chunks.values()].some(chunk => chunk.geometries.has(geometry))) geometry.dispose();
          }
          // Dropping references matters: dispose() alone does not release CPU
          // arrays still reachable from our pending request list.
          sources.length = 0;
          consolidationCpuMs += performance.now() - started;
        }
        consolidatedFallback = true;
      } finally { consolidationInProgress = false; }
    })();
    return consolidation;
  }

  function dispose() {
    if (disposed) return;
    pendingRoot?.removeFromParent();
    // Dispose pools once; repeated remove() would compact soon-to-be-dead data.
    for (const pool of pools.values()) { pool.mesh.removeFromParent(); pool.mesh.dispose(); }
    pools.clear();
    for (const mesh of consolidatedMeshes) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    consolidatedMeshes.clear();
    const geometries = new Set<THREE.BufferGeometry>();
    for (const chunk of chunks.values()) {
      chunk.root.removeFromParent(); chunk.geometries.forEach(geometry => geometries.add(geometry));
    }
    geometries.forEach(geometry => geometry.dispose());
    chunks.clear(); disposed = true;
  }

  return {add, addProgressively, remove, diagnostics, consolidateFallback, dispose};
}
