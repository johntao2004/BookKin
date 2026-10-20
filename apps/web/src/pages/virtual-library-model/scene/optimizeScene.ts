import * as THREE from 'three';
import { packGeometry, unpackGeometry } from './staticBatchData';
import { requestStaticBatch } from './staticBatchWorker';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

interface GeometryBatch {
  container: THREE.Object3D;
  material: THREE.Material;
  meshes: THREE.Mesh[];
  castShadow: boolean;
  receiveShadow: boolean;
  vertices: number;
}

// 限制矩阵烘焙与合并的工作量，避免在单个任务中将整座大厅的重复雕刻合成包含数百万顶点的缓冲区。
// Bound both matrix baking and merging work, rather than merging an entire
// hall's repeated carving into one multi-million-vertex buffer in a single task.
export const STATIC_BATCH_VERTEX_LIMIT = 65_536;

export interface SceneOptimizationResult {
  sourceMeshes: number;
  batchMeshes: number;
  untouchedMeshes: number;
}

// 在书库构建完成后按材质合并静态不透明几何体。环境本身不移动，因此可将数百个书架与家具网格合为少量大型缓冲区提交，同时保留可编辑的构建器。
/**
 * Collapses static opaque geometry by material after the library is built.
 * The environment never moves, so hundreds of shelf/furniture meshes can be
 * submitted as a handful of large buffers without losing editable builders.
 */
function* optimizeStaticMeshSteps(
  root: THREE.Group,
  interactiveRoots: THREE.Object3D[],
  useWorker = false,
): Generator<string | {batch: GeometryBatch}, SceneOptimizationResult, THREE.BufferGeometry | null | undefined> {
  root.updateMatrixWorld(true);
  yield 'static-world-matrices';

  const interactionOwners = new Map<THREE.Object3D, THREE.Object3D>();
  interactiveRoots.forEach((interactiveRoot) => {
    interactiveRoot.traverse((object) => interactionOwners.set(object, interactiveRoot));
  });

  const batches: GeometryBatch[] = [];
  const currentBatches = new Map<string, GeometryBatch>();
  let untouchedMeshes = 0;

  const objects: THREE.Object3D[] = [];
  root.traverse(object => objects.push(object));
  yield 'static-traversal';
  let processed = 0;
  let preparedVertices = 0;
  for (const object of objects) {
    if (++processed % 128 === 0 || preparedVertices >= STATIC_BATCH_VERTEX_LIMIT) {
      preparedVertices = 0;
      yield 'static-grouping';
    }
    if (!(object instanceof THREE.Mesh)) continue;
    if (object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh) {
      untouchedMeshes += 1;
      continue;
    }
    if (
      Array.isArray(object.material) ||
      (object.material.transparent && object.material.userData.batchTransparent !== true)
    ) {
      untouchedMeshes += 1;
      continue;
    }

    const material = object.material;
    const vertices = object.geometry.getAttribute('position')?.count ?? 0;
    // 已有的大型网格可原样渲染；不要仅为与较小邻接网格合并，就在无工作量上限的准备阶段复制并烘焙它。
    // An already large mesh can render unchanged; do not clone and bake it in
    // an unbounded preparation slice just to merge it with a smaller neighbour.
    if (vertices === 0 || vertices > STATIC_BATCH_VERTEX_LIMIT) {
      untouchedMeshes += 1;
      continue;
    }
    if (preparedVertices + vertices > STATIC_BATCH_VERTEX_LIMIT) {
      preparedVertices = 0;
      yield 'static-grouping';
    }
    const container = interactionOwners.get(object) ?? root;
    const attributeSignature = Object.keys(object.geometry.attributes).sort().join(',');
    const key = `${container.uuid}:${material.uuid}:${object.castShadow}:${object.receiveShadow}:${attributeSignature}:${object.geometry.index ? 'indexed' : 'plain'}`;
    let batch = currentBatches.get(key);
    if (!batch || batch.vertices + vertices > STATIC_BATCH_VERTEX_LIMIT) {
      batch = {
        container,
        material,
        meshes: [],
        castShadow: false,
        receiveShadow: false,
        vertices: 0,
      };
      batches.push(batch);
      currentBatches.set(key, batch);
    }
    batch.meshes.push(object);
    batch.vertices += vertices;
    preparedVertices += vertices;
    batch.castShadow ||= object.castShadow;
    batch.receiveShadow ||= object.receiveShadow;
  }
  // 分组后不再保留引用每个源对象的第二份列表。
  // Do not retain a second reference list to every source after grouping.
  objects.length = 0;
  yield 'static-grouping';

  let sourceMeshes = 0;
  let batchMeshes = 0;
  for (const batch of batches) {
    if (batch.meshes.length < 2) {
      untouchedMeshes += batch.meshes.length;
      batch.meshes.length = 0;
      continue;
    }

    // 同一时刻仅由一个有界批次持有变换后的副本。此前分组阶段会先复制整个大厅，之后才有批次释放副本。
    // Only one bounded batch owns transformed copies at a time. Previously the
    // grouping pass cloned the entire hall before any batch released its copies.
    let mergedGeometry: THREE.BufferGeometry | null | undefined;
    const workerCompatible = batch.meshes.every(mesh => Object.keys(mesh.geometry.morphAttributes).length === 0
      && Object.values(mesh.geometry.attributes).every(attribute => attribute instanceof THREE.BufferAttribute
        && !(attribute instanceof THREE.InstancedBufferAttribute)
        && !(attribute instanceof THREE.Float16BufferAttribute) && attribute.gpuType === THREE.FloatType));
    if (useWorker && workerCompatible) mergedGeometry = yield {batch};
    if (mergedGeometry === undefined) {
      const inverseContainer = batch.container.matrixWorld.clone().invert();
      const toContainer = new THREE.Matrix4();
      const geometries: THREE.BufferGeometry[] = [];
      try {
        let copyTaskStart = performance.now(), copiedSinceCheck = 0;
        for (const mesh of batch.meshes) {
          // clone() 会先调用具体几何体的构造器（包括程序化细分），再覆盖其缓冲区；批处理只需要数据。
          // clone() invokes the concrete geometry constructor (including procedural
          // tessellation) before overwriting its buffers. A batch only needs data.
          const geometry = new THREE.BufferGeometry().copy(mesh.geometry);
          // 只有最终合并缓冲区需要包围范围。源对象已有包围范围时，避免 applyMatrix4 再次扫描每份副本。
          // Only the final merged buffer needs bounds; avoid scanning every copy
          // again in applyMatrix4 when its source already has computed bounds.
          geometry.boundingBox = null;
          geometry.boundingSphere = null;
          geometries.push(geometry);
          geometry.applyMatrix4(toContainer.multiplyMatrices(inverseContainer, mesh.matrixWorld));
          if (++copiedSinceCheck === 16) {
            copiedSinceCheck = 0;
            if (performance.now() - copyTaskStart >= 8) {
              yield 'static-copy-transform';
              copyTaskStart = performance.now();
            }
          }
        }
        // 在当前批次仍归此 try/finally 管理时让出执行权。中止构建会释放副本，但不触碰源网格。
        // Yield while the current batch is still owned by this try/finally. An
        // aborted build releases the copies without touching the source meshes.
        yield 'static-copy-transform';
        mergedGeometry = mergeGeometries(geometries, false);
      } finally {
        for (const geometry of geometries) geometry.dispose();
        geometries.length = 0;
      }
    }
    if (!mergedGeometry) {
      untouchedMeshes += batch.meshes.length;
      batch.meshes.length = 0;
      continue;
    }

    batch.meshes.forEach((mesh) => {
      if (mesh.userData.cameraColliderDescriptors) {
        // 合并渲染几何体时保留碰撞元数据及其局部变换。
        // Keep collision metadata and its local transform when render geometry is merged.
        const collisionAnchor = new THREE.Group();
        collisionAnchor.copy(mesh, false);
        collisionAnchor.name = `${mesh.name} collision anchor`;
        mesh.parent?.add(collisionAnchor);
      }
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
    });
    if (!mergedGeometry.boundingBox) mergedGeometry.computeBoundingBox();
    if (!mergedGeometry.boundingSphere) mergedGeometry.computeBoundingSphere();
    const mergedMesh = new THREE.Mesh(mergedGeometry, batch.material);
    mergedMesh.name = `Static geometry batch ${batchMeshes + 1}`;
    mergedMesh.castShadow = batch.castShadow;
    mergedMesh.receiveShadow = batch.receiveShadow;
    batch.container.add(mergedMesh);
    sourceMeshes += batch.meshes.length;
    batch.meshes.length = 0;
    batchMeshes += 1;
    yield 'static-merge-attach';
  }

  return { sourceMeshes, batchMeshes, untouchedMeshes };
}

export function optimizeStaticMeshes(root: THREE.Group, interactiveRoots: THREE.Object3D[]): SceneOptimizationResult {
  const steps=optimizeStaticMeshSteps(root,interactiveRoots);
  let step=steps.next();
  while(!step.done) step=steps.next();
  return step.value;
}

export async function optimizeStaticMeshesProgressively(root: THREE.Group, interactiveRoots: THREE.Object3D[],
  signal: AbortSignal, onSlice: (milliseconds: number, stage: string) => void): Promise<SceneOptimizationResult> {
  let worker: Worker | null = null;
  let useWorker = typeof Worker !== 'undefined';
  const steps=optimizeStaticMeshSteps(root,interactiveRoots, useWorker);
  let taskStart = performance.now();
  let prepared: THREE.BufferGeometry | null | undefined;
  try {
    while(true) {
      signal.throwIfAborted();
      const start=performance.now();
      const input = prepared; prepared = undefined;
      const step=steps.next(input);
      if (!step.done && typeof step.value !== 'string') {
        const batch = step.value.batch;
        // 在注册请求监听器之前立即创建，防止场景遍历期间过早触发的模块加载错误无人接收。
        // Create immediately before registering request listeners, so an early
        // module-load error cannot fire unnoticed during scene traversal.
        if (useWorker && !worker) {
          try { worker = new Worker(new URL('./staticBatch.worker.ts', import.meta.url), {type: 'module'}); }
          catch { useWorker = false; onSlice(0, 'static-worker-unavailable'); }
        }
        if (worker) {
          const inverse = batch.container.matrixWorld.clone().invert();
          const payload = batch.meshes.map(mesh => ({geometry: packGeometry(mesh.geometry),
            matrix: new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld).toArray()}));
          onSlice(performance.now() - start, 'static-worker-dispatch');
          try {
            const dispatchStart = performance.now();
            const request = requestStaticBatch(worker, payload, signal);
            onSlice(performance.now() - dispatchStart, 'static-worker-post');
            const data = await request;
            prepared = data ? unpackGeometry(data) : null;
            onSlice(0, 'static-worker-batch');
          } catch (error) {
            if (signal.aborted) throw error;
            worker.terminate(); worker = null; useWorker = false;
            onSlice(0, 'static-worker-fallback');
            // 返回 undefined 时，为此尚未修改的批次恢复完全相同的同步处理路径。
            // Undefined resumes the exact synchronous path for this untouched batch.
          }
        }
        taskStart = performance.now();
        continue;
      }
      onSlice(performance.now()-start, step.done ? 'static-complete' : step.value as string);
      if(step.done) return step.value;
      if (performance.now() - taskStart >= 8) {
        await new Promise<void>(resolve=>setTimeout(resolve,0));
        taskStart = performance.now();
      }
    }
  } finally { prepared?.dispose(); steps.return(undefined as never); worker?.terminate(); }
}
