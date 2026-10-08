import * as THREE from 'three';
import { createReferenceChunkBatcher } from './referenceLibraryChunkBatches';

function chunk(material: THREE.Material, x = 0, geometry: THREE.BufferGeometry = new THREE.BoxGeometry()) {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = x;
  mesh.castShadow = mesh.receiveShadow = true;
  root.add(mesh);
  return {root, mesh, geometry};
}

function poolMeshes(parent: THREE.Group) {
  return parent.children.filter((object): object is THREE.BatchedMesh => object instanceof THREE.BatchedMesh);
}

describe('reference library chunk geometry ownership', () => {
  it('uses independently cullable original meshes without multi draw and never disposes shared materials/textures', () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial({map: new THREE.Texture()});
    const materialDispose = vi.spyOn(material, 'dispose'), textureDispose = vi.spyOn(material.map!, 'dispose');
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: false});
    const a = chunk(material), b = chunk(material, 3);
    const disposedA = vi.spyOn(a.geometry, 'dispose'), disposedB = vi.spyOn(b.geometry, 'dispose');
    batcher.add('a', a.root); batcher.add('b', b.root);
    expect(a.mesh.parent).toBe(a.root);
    expect(batcher.diagnostics()).toMatchObject({residentModules: 2, residentTriangles: 24, residentPrimitives: 2,
      batchCount: 0, fallbackPrimitives: 2, singlePassDrawUpperBound: 2, allocatedGeometryBufferCount: 8});
    expect(a.mesh.frustumCulled).toBe(true);
    expect(batcher.remove('a')).toBe(true);
    expect(disposedA).toHaveBeenCalledTimes(1);
    expect(disposedB).not.toHaveBeenCalled();
    expect(b.root.parent).toBe(parent);
    expect(batcher.remove('missing')).toBe(false);
    batcher.dispose(); batcher.dispose();
    expect(disposedB).toHaveBeenCalledTimes(1);
    expect(materialDispose).not.toHaveBeenCalled(); expect(textureDispose).not.toHaveBeenCalled();
    expect(batcher.diagnostics().allocatedGeometryBytes).toBe(0);
    expect(parent.children).toHaveLength(0);
    materialDispose.mockRestore(); textureDispose.mockRestore(); material.map!.dispose(); material.dispose();
  });

  it('preserves exact position, normal, UV, triangle indices and local transforms in canonical material pools', () => {
    const parent = new THREE.Group(); parent.position.set(9, 1, -3); parent.rotation.y = 0.3;
    const material = new THREE.MeshStandardMaterial();
    const a = chunk(material, 2), b = chunk(material, -7);
    a.root.position.set(0, 3, -2); a.mesh.rotation.z = .2; a.mesh.scale.set(1, 2, 1);
    const arrays = Object.fromEntries(Object.entries(a.geometry.attributes).map(([name, value]) => [name, Array.from(value.array)]));
    const indices = Array.from(a.geometry.index!.array);
    const originalDispose = vi.spyOn(a.geometry, 'dispose');
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: true});
    parent.add(a.root); parent.updateMatrixWorld(true);
    const expectedMatrix = parent.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    batcher.add('a', a.root); batcher.add('b', b.root);
    const [pool] = poolMeshes(parent);
    expect(poolMeshes(parent)).toHaveLength(1);
    expect(pool.perObjectFrustumCulled).toBe(true);
    expect(pool.castShadow && pool.receiveShadow).toBe(true);
    for (const name of Object.keys(arrays)) expect(Array.from(pool.geometry.getAttribute(name).array).slice(0, arrays[name].length)).toEqual(arrays[name]);
    expect(Array.from(pool.geometry.index!.array).slice(0, indices.length)).toEqual(indices);
    const actualMatrix = pool.getMatrixAt(0, new THREE.Matrix4());
    actualMatrix.elements.forEach((value, index) => expect(value).toBeCloseTo(expectedMatrix.elements[index], 6));
    expect(originalDispose).toHaveBeenCalledTimes(1);
    expect(a.root.children).toHaveLength(0);
    expect(batcher.diagnostics()).toMatchObject({residentTriangles: 24, residentPrimitives: 2, batchCount: 1,
      fallbackPrimitives: 0, singlePassDrawUpperBound: 1});
    expect(pool.boundingBox!.min.x).toBeLessThan(-6);
    batcher.remove('b');
    expect(pool.boundingBox!.min.x).toBeGreaterThan(0);
    expect(batcher.diagnostics().residentTriangles).toBe(12);
    batcher.dispose(); material.dispose();
  });

  it('compacts and shrinks after substantial eviction, then reuses the remaining pool without reviving deleted chunks', () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: true});
    for (let i = 0; i < 12; i++) batcher.add(String(i), chunk(material, i * 2).root);
    const before = batcher.diagnostics(), [pool] = poolMeshes(parent);
    const poolDispose = vi.spyOn(pool, 'dispose');
    for (let i = 0; i < 11; i++) batcher.remove(String(i));
    const after = batcher.diagnostics();
    expect(after.allocatedGeometryBytes).toBeLessThan(before.allocatedGeometryBytes / 3);
    expect(after.capacities[0].vertexCapacity).toBeLessThanOrEqual(48);
    expect(after.capacities[0].vertices).toBe(24);
    expect(after.capacities[0].instanceCapacity).toBe(before.capacities[0].instanceCapacity);
    expect(after.bounds!.min[0]).toBeCloseTo(21.5);
    expect(poolDispose).not.toHaveBeenCalled();
    batcher.add('new', chunk(material, -8).root);
    expect(batcher.diagnostics()).toMatchObject({residentModules: 2, residentTriangles: 24, batchCount: 1});
    expect(pool.boundingBox!.min.x).toBeCloseTo(-8.5);
    batcher.remove('11'); batcher.remove('new');
    expect(poolDispose).toHaveBeenCalledTimes(1);
    expect(batcher.diagnostics()).toMatchObject({residentModules: 0, residentTriangles: 0, batchCount: 0,
      allocatedGeometryBytes: 0, estimatedBatchAuxiliaryBytes: 0});
    batcher.dispose(); material.dispose();
  });

  it('rebuilds per-object visibility for main and shadow cameras without losing offscreen shadow casters', () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: true});
    batcher.add('left', chunk(material, -20).root); batcher.add('right', chunk(material, 20).root);
    const [pool] = poolMeshes(parent);
    parent.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    camera.position.set(-20, 0, 8); camera.lookAt(-20, 0, 0); camera.updateMatrixWorld(true);
    const renderer = {} as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    pool.onBeforeRender(renderer, scene, camera, pool.geometry, material, null!);
    const drawCount = () => (pool as unknown as {_multiDrawCount: number})._multiDrawCount;
    expect(drawCount()).toBe(1);
    const shadow = new THREE.OrthographicCamera(-50, 50, 10, -10, .1, 100);
    shadow.position.set(0, 0, 8); shadow.lookAt(0, 0, 0); shadow.updateMatrixWorld(true);
    pool.onBeforeShadow(renderer, scene, camera, shadow, pool.geometry, material, null!);
    expect(drawCount()).toBe(2);
    pool.onBeforeRender(renderer, scene, camera, pool.geometry, material, null!);
    expect(drawCount()).toBe(1);
    batcher.dispose(); material.dispose();
  });

  it('keeps unsupported transparent geometry intact and separates incompatible state/attribute pools', () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const transparent = new THREE.MeshStandardMaterial({transparent: true, opacity: .5});
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: true});
    const a = chunk(material), b = chunk(material), c = chunk(material), d = chunk(transparent);
    b.mesh.castShadow = false; c.geometry.deleteAttribute('uv');
    batcher.add('a', a.root); batcher.add('b', b.root); batcher.add('c', c.root); batcher.add('d', d.root);
    expect(poolMeshes(parent)).toHaveLength(3);
    expect(d.mesh.parent).toBe(d.root);
    expect(batcher.diagnostics()).toMatchObject({residentPrimitives: 4, batchCount: 3, fallbackPrimitives: 1});
    expect(batcher.diagnostics().modules.find(module => module.id === 'd')!.fallbackReason).toBe('transparent-material');
    batcher.dispose(); material.dispose(); transparent.dispose();
  });

  it('rejects duplicate chunk IDs and rolls back a failed add without disposing its original geometry', () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: true});
    batcher.add('first', chunk(material).root);
    const b = chunk(material), disposed = vi.spyOn(b.geometry, 'dispose');
    expect(() => batcher.add('first', b.root)).toThrow('already loaded');
    expect(b.root.parent).toBeNull();
    const originalAdd = THREE.BatchedMesh.prototype.addInstance;
    const fail = vi.spyOn(THREE.BatchedMesh.prototype, 'addInstance').mockImplementationOnce(() => {throw new Error('test allocation failure');});
    expect(() => batcher.add('failed', b.root)).toThrow('test allocation failure');
    expect(b.root.parent).toBeNull(); expect(b.mesh.parent).toBe(b.root);
    expect(disposed).not.toHaveBeenCalled();
    expect(batcher.diagnostics()).toMatchObject({residentModules: 1, residentTriangles: 12});
    fail.mockImplementation(originalAdd); fail.mockRestore();
    batcher.add('recovered', b.root);
    expect(batcher.diagnostics().residentTriangles).toBe(24);
    batcher.dispose();
    expect(() => batcher.add('late', new THREE.Group())).toThrow('disposed');
    material.dispose();
  });

  it('safely changes index width while growing, shrinking and repeatedly reloading geometry', () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: true});
    const make = (count: number) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { positions[i * 3] = i % 3; positions[i * 3 + 1] = Math.floor(i / 3) % 3; }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from({length: count}, (_, index) => index), 1));
      return chunk(material, 0, geometry).root;
    };
    batcher.add('small', make(3));
    for (let cycle = 0; cycle < 5; cycle++) {
      batcher.add('large', make(66_000));
      expect(poolMeshes(parent)[0].geometry.index!.array).toBeInstanceOf(Uint32Array);
      expect(batcher.diagnostics().residentTriangles).toBe(22_001);
      batcher.remove('large');
      expect(poolMeshes(parent)[0].geometry.index!.array).toBeInstanceOf(Uint16Array);
      expect(Array.from(poolMeshes(parent)[0].geometry.index!.array).slice(0, 3)).toEqual([0, 1, 2]);
      expect(batcher.diagnostics().capacities[0].vertexCapacity).toBeLessThanOrEqual(4);
      expect(batcher.diagnostics().residentTriangles).toBe(1);
    }
    batcher.dispose(); material.dispose();
  });

  it('consolidates the full fallback scene by material without changing attributes or indices and locks chunk eviction', async () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const materialDispose = vi.spyOn(material, 'dispose');
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: false});
    const a = chunk(material, 2), b = chunk(material, -3);
    b.mesh.rotation.set(.1, .2, .3);
    const geometries = [a.geometry, b.geometry];
    const sourceDisposals = geometries.map(geometry => vi.spyOn(geometry, 'dispose'));
    const expected = [a, b].map(({mesh, geometry}) => {
      mesh.updateMatrix(); return new THREE.BufferGeometry().copy(geometry).applyMatrix4(mesh.matrix);
    });
    batcher.add('a', a.root); batcher.add('b', b.root);
    const before = batcher.diagnostics().allocatedGeometryBytes;
    await batcher.consolidateFallback();
    const after = batcher.diagnostics();
    expect(after).toMatchObject({consolidatedFallback: true, fallbackEvictionLocked: true, consolidationInProgress: false,
      residentModules: 2, residentTriangles: 24, residentPrimitives: 2, batchCount: 1, fallbackPrimitives: 1,
      singlePassDrawUpperBound: 1, possiblePrimitiveDrawCount: 1});
    expect(after.consolidationPeakGeometryBytes).toBe(before + after.allocatedGeometryBytes);
    expect(after.consolidationCpuMs).toBeGreaterThan(0);
    const merged = parent.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh;
    for (const name of ['position', 'normal', 'uv']) {
      expect(Array.from(merged.geometry.getAttribute(name).array)).toEqual(expected.flatMap(geometry => Array.from(geometry.getAttribute(name).array)));
    }
    expect(Array.from(merged.geometry.index!.array)).toEqual([
      ...Array.from(a.geometry.index!.array), ...Array.from(b.geometry.index!.array, index => index + a.geometry.getAttribute('position').count),
    ]);
    expect(merged.castShadow && merged.receiveShadow).toBe(true);
    sourceDisposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
    expect(() => batcher.remove('a')).toThrow('full residency');
    expect(() => batcher.add('late', new THREE.Group())).toThrow('cannot be added');
    expect(batcher.diagnostics().residentModules).toBe(2);
    await batcher.consolidateFallback(); // One-shot idempotent completion.
    expect(batcher.diagnostics().batchCount).toBe(1);
    const mergedDispose = vi.spyOn(merged.geometry, 'dispose');
    batcher.dispose(); expect(mergedDispose).toHaveBeenCalledTimes(1);
    expect(batcher.diagnostics().allocatedGeometryBytes).toBe(0);
    expect(materialDispose).not.toHaveBeenCalled();
    expected.forEach(geometry => geometry.dispose()); materialDispose.mockRestore(); material.dispose();
  });

  it('does not reveal hidden geometry during fallback consolidation, and leaves native multi draw adaptive', async () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const fallback = createReferenceChunkBatcher(parent, {multiDraw: false});
    const a = chunk(material), hidden = chunk(material, 10); hidden.root.visible = false;
    fallback.add('visible', a.root); fallback.add('hidden', hidden.root);
    await fallback.consolidateFallback();
    expect(hidden.mesh.parent).toBe(hidden.root); expect(hidden.root.visible).toBe(false);
    expect(fallback.diagnostics()).toMatchObject({consolidatedBatchCount: 1, fallbackPrimitives: 2});
    fallback.dispose();
    const native = createReferenceChunkBatcher(parent, {multiDraw: true});
    native.add('a', chunk(material).root); await native.consolidateFallback();
    expect(native.diagnostics().fallbackEvictionLocked).toBe(false);
    expect(native.remove('a')).toBe(true);
    native.dispose(); material.dispose();
  });

  it('retains usable originals on a failed merge and safely disposes while consolidation is yielding', async () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: false});
    const a = chunk(material), dispose = vi.spyOn(a.geometry, 'dispose');
    batcher.add('a', a.root);
    const fail = vi.spyOn(THREE.BufferGeometry.prototype, 'computeBoundingSphere').mockImplementationOnce(() => { throw new Error('test merge failure'); });
    await expect(batcher.consolidateFallback()).rejects.toThrow('test merge failure');
    fail.mockRestore();
    expect(a.mesh.parent).toBe(a.root); expect(dispose).not.toHaveBeenCalled();
    expect(batcher.diagnostics()).toMatchObject({fallbackEvictionLocked: true, consolidatedFallback: false,
      consolidationInProgress: false, residentTriangles: 12});
    expect(() => batcher.remove('a')).toThrow('full residency');
    batcher.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
    const cancelled = createReferenceChunkBatcher(parent, {multiDraw: false});
    const b = chunk(material), disposedB = vi.spyOn(b.geometry, 'dispose');
    cancelled.add('b', b.root);
    const pending = cancelled.consolidateFallback();
    cancelled.dispose();
    await expect(pending).rejects.toThrow('disposed during fallback consolidation');
    expect(disposedB).toHaveBeenCalledTimes(1);
    expect(parent.children).toHaveLength(0);
    expect(cancelled.diagnostics().allocatedGeometryBytes).toBe(0);
    material.dispose();
  });

  it('caps adaptive growth at manifest totals without allocating those totals upfront', () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial(); material.name = 'canonical-oak';
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: true,
      materialCapacityLimits: [{name: material.name, vertices: 120, indices: 180}]});
    batcher.add('0', chunk(material).root);
    expect(batcher.diagnostics().capacities[0]).toMatchObject({vertices: 24, vertexCapacity: 24, indices: 36, indexCapacity: 36});
    for (let i = 1; i < 5; i++) batcher.add(String(i), chunk(material, i).root);
    expect(batcher.diagnostics().capacities[0]).toMatchObject({vertices: 120, vertexCapacity: 120, indices: 180, indexCapacity: 180});
    const extra = chunk(material);
    expect(() => batcher.add('excess', extra.root)).toThrow('manifest capacity');
    expect(extra.mesh.parent).toBe(extra.root); expect(extra.root.parent).toBeNull();
    const d = batcher.diagnostics();
    expect(d.residentTriangles).toBe(60);
    expect(d.maxAddCpuMs).toBeGreaterThan(0);
    expect(d.mutationPeakGeometryBytes).toBeGreaterThan(d.allocatedGeometryBytes);
    extra.geometry.dispose(); batcher.dispose(); material.dispose();
  });

  it('serializes progressive additions, keeping originals visible and copied instances hidden until atomic commit', async () => {
    const parent = new THREE.Group(), a = new THREE.MeshStandardMaterial(), b = new THREE.MeshStandardMaterial();
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: true});
    const first = chunk(a), secondPart = chunk(b), second = chunk(a, 5);
    first.root.add(secondPart.mesh);
    const phases: string[] = [], durations: number[] = [];
    const one = batcher.addProgressively('one', first.root, {onSlice: (ms, stage) => {
      phases.push(stage); durations.push(ms);
      expect(first.root.children).toHaveLength(2);
      expect(batcher.diagnostics().residentModules).toBe(0);
      for (const pool of poolMeshes(parent)) expect(pool.getVisibleAt(0)).toBe(false);
      expect(second.root.parent).toBeNull();
    }});
    const two = batcher.addProgressively('two', second.root);
    await Promise.all([one, two]);
    expect(phases).toHaveLength(2); expect(durations.every(ms => ms >= 0)).toBe(true);
    expect(batcher.diagnostics()).toMatchObject({residentModules: 2, residentTriangles: 36, pendingAddCount: 0, adding: false});
    expect(batcher.diagnostics().maxAddSliceCpuMs).toBeGreaterThan(0);
    expect(first.root.children).toHaveLength(0); expect(second.root.children).toHaveLength(0);
    poolMeshes(parent).forEach(pool => expect(pool.getVisibleAt(0)).toBe(true));
    batcher.dispose(); a.dispose(); b.dispose();
  });

  it('rolls back progressive cancellation without losing existing modules or disposing uncommitted originals', async () => {
    const parent = new THREE.Group(), a = new THREE.MeshStandardMaterial(), b = new THREE.MeshStandardMaterial();
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: true});
    batcher.add('existing', chunk(a).root);
    const next = chunk(a, 3), second = chunk(b); next.root.add(second.mesh);
    const disposedA = vi.spyOn(next.geometry, 'dispose'), disposedB = vi.spyOn(second.geometry, 'dispose');
    const controller = new AbortController();
    await expect(batcher.addProgressively('cancelled', next.root, {signal: controller.signal,
      onSlice: () => controller.abort()})).rejects.toMatchObject({name: 'AbortError'});
    expect(batcher.diagnostics()).toMatchObject({residentModules: 1, residentTriangles: 12, pendingAddCount: 0, batchCount: 1});
    expect(next.root.parent).toBeNull(); expect(next.root.children).toHaveLength(2);
    expect(disposedA).not.toHaveBeenCalled(); expect(disposedB).not.toHaveBeenCalled();
    await batcher.addProgressively('retry', next.root);
    expect(batcher.diagnostics().residentTriangles).toBe(36);
    batcher.dispose(); a.dispose(); b.dispose();
  });

  it('safely disposes while a progressive copy is paused and leaves the failed source caller-owned', async () => {
    const parent = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const batcher = createReferenceChunkBatcher(parent, {multiDraw: true});
    const source = chunk(material), sourceDispose = vi.spyOn(source.geometry, 'dispose');
    await expect(batcher.addProgressively('pending', source.root, {onSlice: () => batcher.dispose()}))
      .rejects.toThrow('disposed during progressive addition');
    expect(parent.children).toHaveLength(0);
    expect(source.root.children).toHaveLength(1);
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(batcher.diagnostics()).toMatchObject({allocatedGeometryBytes: 0, pendingAddCount: 0});
    source.geometry.dispose(); material.dispose();
  });
});
