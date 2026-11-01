import * as THREE from 'three';

/**
 * Lossless display-only batching for the palace's static construction.
 *
 * Source meshes stay in their original hierarchy for collision, metadata and
 * cutaway ownership. Only their render layer mask is cleared. The proxy uses
 * the exact shared material, geometry and relative transform; it is explicitly
 * excluded from collision. Door leaves, transparent surfaces, reference
 * artwork and special surfaces remain ordinary meshes.
 *
 * Call after creating navigation/collision. Run restore() before rebuilding
 * construction or editing source geometry. Moving a containing visibility
 * root remains supported; editing an individual baked source requires rebuild.
 */
const FLAG_KEYS = ['keepSolidInFallback', 'preserveSurfaceInFallback', 'doorDetail'];
const GEOMETRY_FLAG_KEYS = ['retainDoorFrontFace', 'doorDetail'];
const SPECIAL_FLAGS = ['originalBrushwork', 'frontalProjectiveMapping', 'originalUserPhotograph', 'preserveSurfaceInFallback', 'backgroundOnly'];
const now = () => typeof performance === 'object' ? performance.now() : Date.now();
const isDescendant = (object, ancestor) => { for (let p = object; p; p = p.parent) if (p === ancestor) return true; return false; };
const materialArray = object => Array.isArray(object.material) ? object.material : [object.material];

export function snapshotRenderWork(root, camera = null) {
  const result = {objects: 0, meshes: 0, instancedMeshes: 0, instances: 0, draws: 0, triangles: 0, geometries: 0, materials: 0, groups: {}};
  const geometries = new Set(), materials = new Set();
  camera?.updateWorldMatrix(true, false);
  const frustum = camera ? new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)) : null;
  root.updateWorldMatrix(true, true);
  root.traverseVisible(object => {
    result.objects++;
    if (!object.isMesh || !object.geometry?.attributes?.position || !object.layers.test(camera?.layers ?? {mask: 1})) return;
    if (frustum && object.frustumCulled && !frustum.intersectsObject(object)) return;
    const count = object.isInstancedMesh ? object.count : 1;
    if (count <= 0) return;
    const materialList = materialArray(object), visibleMaterials = materialList.filter(material => material?.visible !== false);
    if (!visibleMaterials.length) return;
    const geometry = object.geometry;
    result.meshes++;
    if (object.isInstancedMesh) result.instancedMeshes++;
    result.instances += count;
    result.triangles += Math.min(geometry.index?.count ?? geometry.attributes.position.count, geometry.drawRange?.count ?? Infinity) / 3 * count;
    result.draws += Array.isArray(object.material) ? geometry.groups.filter(part => materialList[part.materialIndex]?.visible !== false).length : 1;
    geometries.add(geometry);
    for (const material of visibleMaterials) materials.add(material);
    let owner = object;
    while (owner.parent && owner.parent !== root) owner = owner.parent;
    const key = owner.name || owner.type;
    result.groups[key] = (result.groups[key] ?? 0) + 1;
  });
  result.geometries = geometries.size; result.materials = materials.size;
  return result;
}

function dataHash(array) {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619);
  return hash >>> 0;
}

function geometrySignature(geometry) {
  const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b));
  const parts = attributes.map(([name, attribute]) => `${name}:${attribute.array.constructor.name}:${attribute.itemSize}:${attribute.normalized}:${attribute.count}:${dataHash(attribute.array)}`);
  if (geometry.index) parts.push(`index:${geometry.index.array.constructor.name}:${geometry.index.count}:${dataHash(geometry.index.array)}`);
  parts.push(JSON.stringify(geometry.groups), JSON.stringify(geometry.drawRange));
  parts.push(JSON.stringify(GEOMETRY_FLAG_KEYS.map(key => geometry.userData?.[key] ?? null)));
  return parts.join('|');
}

function arraysEqual(a, b) {
  if (!a || !b || a.constructor !== b.constructor || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

function equivalentGeometry(a, b) {
  if (a === b) return true;
  const names = Object.keys(a.attributes), others = Object.keys(b.attributes);
  if (names.length !== others.length || !!a.index !== !!b.index) return false;
  if (a.index && !arraysEqual(a.index.array, b.index.array)) return false;
  for (const name of names) {
    const x = a.attributes[name], y = b.attributes[name];
    if (!y || x.itemSize !== y.itemSize || x.normalized !== y.normalized || !arraysEqual(x.array, y.array)) return false;
  }
  return JSON.stringify(a.groups) === JSON.stringify(b.groups) && JSON.stringify(a.drawRange) === JSON.stringify(b.drawRange)
    && GEOMETRY_FLAG_KEYS.every(key => a.userData?.[key] === b.userData?.[key]);
}

function canBatch(mesh, doors) {
  if (!mesh.isMesh || mesh.isInstancedMesh || !mesh.visible || mesh.layers.mask !== 1 || mesh.children.length) return false;
  if (!mesh.geometry?.attributes?.position || Object.keys(mesh.geometry.morphAttributes).length || mesh.morphTargetInfluences) return false;
  if (Object.values(mesh.geometry.attributes).some(attribute => attribute.isInterleavedBufferAttribute)) return false;
  if (SPECIAL_FLAGS.some(key => mesh.userData?.[key]) || mesh.userData?.type === 'closed-roof-shell' || mesh.geometry.userData?.type === 'closed-roof-shell') return false;
  if (materialArray(mesh).some(material => !material || material.transparent || material.opacity < 1 || material.visible === false || material.isShaderMaterial)) return false;
  if (doors.some(door => isDescendant(mesh, door)) || mesh.matrixWorld.determinant() <= 0) return false;
  for (let node = mesh.parent; node; node = node.parent) if (node.visible === false) return false;
  return true;
}

export async function batchStaticLibrary(library, {
  cellSize = 12, cellHeight = 6, minimumInstances = 3, maximumInstances = 1024,
  splitInstances = true, trackSources = false,
  yieldBudgetMs = 8, onProgress, yieldTask = () => globalThis.scheduler?.yield?.() ?? new Promise(resolve => setTimeout(resolve, 0)),
} = {}) {
  if (!library?.group) throw new TypeError('batchStaticLibrary requires a library');
  const started = now(), before = snapshotRenderWork(library.group);
  const roots = [...new Set([
    library.architecture?.group, library.architecture?.roof, library.architecture?.ceiling, library.architecture?.envelope,
    library.furniture?.group, library.entrance?.group, library.ceremonial?.group, library.courtyard?.group,
  ].filter(Boolean))];
  const rootSet = new Set(roots), inverses = new Map(roots.map(root => [root, root.matrixWorld.clone().invert()]));
  const doors = library.entrance?.doors ?? [], sources = [], batches = [], frozen = [], canonical = new Map(), signatures = new Map(), buckets = new Map();
  const originalMasks = new Map(), sourceRecords = [], packed = [], centers = new THREE.Vector3(), temp = new THREE.Matrix4();
  const instanceMatrix = new THREE.Matrix4(), tint = new THREE.Color();
  let splitSourceMeshes = 0;
  let lastYield = now(), scanned = 0, canonicalId = 0;
  const cooperate = async phase => {
    if (now() - lastYield < yieldBudgetMs) return;
    onProgress?.({phase, scanned, sources: sources.length, batches: batches.length});
    await yieldTask(); lastYield = now();
  };
  library.group.traverse(object => sources.push(object));
  if (splitInstances) for (const source of sources) {
    if (!source.isInstancedMesh || source.count < 12 || source.layers.mask !== 1 || !source.visible || source.children.length) continue;
    if (SPECIAL_FLAGS.some(key => source.userData?.[key]) || source.morphTexture || doors.some(door => isDescendant(source, door))) continue;
    if (materialArray(source).some(material => !material || material.transparent || material.opacity < 1 || material.isShaderMaterial)) continue;
    if (!source.boundingBox) source.computeBoundingBox();
    const worldBox = source.boundingBox.clone().applyMatrix4(source.matrixWorld), size = worldBox.getSize(new THREE.Vector3());
    if (size.x < cellSize * 1.5 && size.z < cellSize * 1.5 && size.y < cellHeight * 1.5) continue;
    if (!source.geometry.boundingSphere) source.geometry.computeBoundingSphere();
    const groups = new Map();
    for (let i = 0; i < source.count; i++) {
      source.getMatrixAt(i, instanceMatrix); temp.multiplyMatrices(source.matrixWorld, instanceMatrix);
      centers.copy(source.geometry.boundingSphere.center).applyMatrix4(temp);
      const key = `${Math.floor(centers.x / cellSize)},${Math.floor(centers.y / cellHeight)},${Math.floor(centers.z / cellSize)}`;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i);
    }
    if (groups.size <= 1) continue;
    // Spatial blocks share one draw submission. A literal mesh per block was
    // benchmarked and rejected: it tripled far-view draw calls. Pack only the
    // conservative visible blocks into this same source-sized instance buffer.
    const proxy = new THREE.InstancedMesh(source.geometry, source.material, source.count);
    proxy.name = `Static_V14_Packed_${source.name}`;
    proxy.position.copy(source.position); proxy.quaternion.copy(source.quaternion); proxy.scale.copy(source.scale);
    proxy.matrix.copy(source.matrix); proxy.matrixAutoUpdate = false;
    proxy.castShadow = source.castShadow; proxy.receiveShadow = source.receiveShadow; proxy.renderOrder = source.renderOrder; proxy.frustumCulled = source.frustumCulled;
    proxy.userData = {staticRenderProxy: true, collision: 'none', sourceCount: source.count, spatialBlockCount: groups.size};
    for (const key of FLAG_KEYS) if (source.userData[key] !== undefined) proxy.userData[key] = source.userData[key];
    const chunks = [], allMatrices = new Float32Array(source.count * 16), allColors = source.instanceColor ? new Float32Array(source.count * 3) : null;
    let write = 0;
    for (const [cell, indices] of groups) {
      const chunkBox = new THREE.Box3(), offset = write;
      for (const originalIndex of indices) {
        source.getMatrixAt(originalIndex, instanceMatrix); proxy.setMatrixAt(write, instanceMatrix);
        allMatrices.set(instanceMatrix.elements, write * 16);
        if (source.instanceColor) { source.getColorAt(originalIndex, tint); proxy.setColorAt(write, tint); allColors.set(tint.toArray(), write * 3); }
        chunkBox.union(source.geometry.boundingBox.clone().applyMatrix4(instanceMatrix));
        if (trackSources) sourceRecords.push({source, originalIndex, proxy, instanceIndex: write, owner: source.parent});
        write++;
      }
      chunks.push({cell, offset, count: indices.length, sphere: chunkBox.getBoundingSphere(new THREE.Sphere())});
    }
    proxy.instanceMatrix.setUsage(THREE.DynamicDrawUsage); proxy.instanceMatrix.needsUpdate = true;
    if (proxy.instanceColor) { proxy.instanceColor.setUsage(THREE.DynamicDrawUsage); proxy.instanceColor.needsUpdate = true; }
    proxy.computeBoundingBox(); proxy.computeBoundingSphere();
    source.parent.add(proxy); batches.push(proxy);
    packed.push({proxy, chunks, allMatrices, allColors, active: chunks.map(() => true)});
    originalMasks.set(source, source.layers.mask); source.layers.mask = 0; splitSourceMeshes++;
    await cooperate('split-instance');
  }
  for (const mesh of sources) {
    scanned++;
    if (!canBatch(mesh, doors)) { if ((scanned & 127) === 0) await cooperate('classify'); continue; }
    let owner = mesh.parent;
    while (owner && !rootSet.has(owner)) owner = owner.parent;
    if (!owner) continue;
    let entry = signatures.get(mesh.geometry);
    if (!entry) {
      const signature = geometrySignature(mesh.geometry), matches = canonical.get(signature) ?? [];
      entry = matches.find(candidate => equivalentGeometry(candidate.geometry, mesh.geometry));
      if (!entry) { entry = {id: canonicalId++, geometry: mesh.geometry}; matches.push(entry); canonical.set(signature, matches); }
      signatures.set(mesh.geometry, entry);
    }
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    centers.copy(mesh.geometry.boundingSphere.center).applyMatrix4(mesh.matrixWorld);
    const cell = `${Math.floor(centers.x / cellSize)},${Math.floor(centers.y / cellHeight)},${Math.floor(centers.z / cellSize)}`;
    const metadata = FLAG_KEYS.map(key => mesh.userData?.[key] ?? null);
    const key = [owner.uuid, cell, entry.id, materialArray(mesh).map(material => material.uuid).join(','), mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, mesh.frustumCulled, JSON.stringify(metadata)].join('|');
    if (!buckets.has(key)) buckets.set(key, {owner, geometry: entry.geometry, items: [], cell});
    buckets.get(key).items.push(mesh);
    if ((scanned & 127) === 0) await cooperate('classify');
  }
  for (const bucket of buckets.values()) {
    if (bucket.items.length < minimumInstances) continue;
    for (let offset = 0; offset < bucket.items.length; offset += maximumInstances) {
      const items = bucket.items.slice(offset, offset + maximumInstances), first = items[0];
      const proxy = new THREE.InstancedMesh(bucket.geometry, first.material, items.length);
      proxy.name = `Static_V14_${bucket.owner.name}_${bucket.cell}_${batches.length}`;
      proxy.castShadow = first.castShadow; proxy.receiveShadow = first.receiveShadow; proxy.renderOrder = first.renderOrder; proxy.frustumCulled = first.frustumCulled;
      proxy.userData = {staticRenderProxy: true, collision: 'none', sourceCount: items.length, cell: bucket.cell};
      for (const key of FLAG_KEYS) if (first.userData[key] !== undefined) proxy.userData[key] = first.userData[key];
      const inverse = inverses.get(bucket.owner);
      for (let i = 0; i < items.length; i++) {
        const source = items[i];
        temp.multiplyMatrices(inverse, source.matrixWorld);
        proxy.setMatrixAt(i, temp);
        originalMasks.set(source, source.layers.mask); source.layers.mask = 0;
        if (trackSources) sourceRecords.push({source, proxy, instanceIndex: i, owner: bucket.owner});
      }
      proxy.instanceMatrix.needsUpdate = true; proxy.computeBoundingBox(); proxy.computeBoundingSphere();
      proxy.updateMatrix(); proxy.matrixAutoUpdate = false;
      bucket.owner.add(proxy); batches.push(proxy);
    }
    await cooperate('instance');
  }
  // Freeze only mesh-local TRS composition. World matrices still follow their
  // parents; door leaves and their descendants remain fully dynamic.
  for (const object of sources) {
    if (!object.isMesh || doors.some(door => isDescendant(object, door)) || !object.matrixAutoUpdate) continue;
    object.updateMatrix(); frozen.push(object); object.matrixAutoUpdate = false;
  }
  library.group.updateWorldMatrix(true, true);
  const after = snapshotRenderWork(library.group), stats = {
    before, after, replacedMeshes: originalMasks.size, batches: batches.length,
    canonicalGeometries: canonicalId, splitSourceMeshes, frozenLocalMatrices: frozen.length,
    spatialBlocks: packed.reduce((sum, item) => sum + item.chunks.length, 0),
    packedInstances: packed.reduce((sum, item) => sum + item.proxy.count, 0),
    durationMs: Math.round((now() - started) * 100) / 100,
    drawReduction: before.draws ? 1 - after.draws / before.draws : 0,
    lossless: true, detailReduction: false,
  };
  let restored = false;
  const viewMatrix = new THREE.Matrix4(), frustum = new THREE.Frustum();
  let lastViewSignature = null, lastWorldSignature = null, lastUpdate = null;
  const update = (camera, {full = false} = {}) => {
    if (restored) return {changed: false, requiresRefine: false};
    const began = now();
    camera.updateWorldMatrix(true, false);
    viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    for (const root of roots) root.updateWorldMatrix(true, false);
    const worldSignature = roots.flatMap(root => root.matrixWorld.elements);
    const worldChanged = !lastWorldSignature || worldSignature.some((value, i) => value !== lastWorldSignature[i]);
    const signature = [full, ...viewMatrix.elements, ...worldSignature];
    if (lastViewSignature && signature.every((value, i) => value === lastViewSignature[i])) return {...lastUpdate, changed: false, cached: true, matrixBytesCopied: 0, durationMs: now() - began};
    lastViewSignature = signature;
    frustum.setFromProjectionMatrix(viewMatrix);
    if (worldChanged) {
      for (const {proxy, chunks} of packed) {
        proxy.updateWorldMatrix(true, false);
        for (const chunk of chunks) chunk.worldSphere = chunk.sphere.clone().applyMatrix4(proxy.matrixWorld);
      }
      lastWorldSignature = worldSignature;
    }
    let changed = false, activeInstances = 0, activeChunks = 0, totalChunks = 0, matrixBytesCopied = 0;
    for (const item of packed) {
      const {proxy, chunks} = item;
      const active = chunks.map(chunk => full || frustum.intersectsSphere(chunk.worldSphere));
      const different = active.some((value, i) => value !== item.active[i]);
      totalChunks += chunks.length;
      for (let i = 0; i < chunks.length; i++) if (active[i]) { activeChunks++; activeInstances += chunks[i].count; }
      if (!different) continue;
      let write = 0;
      for (let i = 0; i < chunks.length; i++) {
        if (!active[i]) continue;
        const chunk = chunks[i];
        proxy.instanceMatrix.array.set(item.allMatrices.subarray(chunk.offset * 16, (chunk.offset + chunk.count) * 16), write * 16);
        if (item.allColors) proxy.instanceColor.array.set(item.allColors.subarray(chunk.offset * 3, (chunk.offset + chunk.count) * 3), write * 3);
        write += chunk.count;
      }
      proxy.count = write; proxy.instanceMatrix.clearUpdateRanges();
      if (write) proxy.instanceMatrix.addUpdateRange(0, write * 16);
      proxy.instanceMatrix.needsUpdate = true;
      if (proxy.instanceColor) { proxy.instanceColor.clearUpdateRanges(); if (write) proxy.instanceColor.addUpdateRange(0, write * 3); proxy.instanceColor.needsUpdate = true; }
      item.active = active; changed = true; matrixBytesCopied += write * (item.allColors ? 76 : 64);
    }
    lastUpdate = {changed, requiresRefine: full && packed.length > 0, activeInstances, activeChunks, totalChunks, matrixBytesCopied, durationMs: now() - began};
    return lastUpdate;
  };
  const restore = () => {
    if (restored) return; restored = true;
    for (const [source, mask] of originalMasks) source.layers.mask = mask;
    for (const source of frozen) source.matrixAutoUpdate = true;
    for (const proxy of batches) { proxy.removeFromParent(); proxy.dispose(); }
  };
  return {stats, batches, sourceRecords, diagnostics: trackSources ? packed : undefined, update, restore, dispose: restore};
}
