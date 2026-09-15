import * as THREE from 'three';
import { bakeStaticBatch, type StaticBatchInput } from './staticBatchData';
import { optimizeStaticMeshes, optimizeStaticMeshesProgressively } from './optimizeScene';

let mode: 'success' | 'error' | 'pending' = 'success';
const terminated = vi.fn();
class TestWorker extends EventTarget {
  terminate = terminated;
  postMessage(input: StaticBatchInput[]) {
    if (mode === 'pending') return;
    const owned = structuredClone(input);
    queueMicrotask(() => {
      if (mode === 'error') this.dispatchEvent(new Event('error'));
      else this.dispatchEvent(new MessageEvent('message', {data: {geometry: bakeStaticBatch(owned)}}));
    });
  }
}
function fixture() {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const owner = new THREE.Group(); owner.position.set(3, 2, -1); owner.rotation.y = 0.3; root.add(owner);
  const geometry = new THREE.BoxGeometry();
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute(new Uint8Array(geometry.attributes.position.count * 3).fill(128), 3, true));
  for (let index = 0; index < 2; index++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(index * 2, 0.5, 1); mesh.rotation.x = 0.25; mesh.scale.set(1, 2, 0.5); owner.add(mesh);
  }
  return {root, owner, material};
}
function dispose(value: ReturnType<typeof fixture>) {
  value.root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); }); value.material.dispose();
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); terminated.mockClear(); mode = 'success'; });

it('matches synchronous batching of shared template buffers and interactive-owner coordinates through the worker protocol', async () => {
  vi.stubGlobal('Worker', TestWorker);
  const expected = fixture(), actual = fixture();
  try {
    optimizeStaticMeshes(expected.root, [expected.owner]);
    const phases: string[] = [];
    await optimizeStaticMeshesProgressively(actual.root, [actual.owner], new AbortController().signal, (_ms, phase) => phases.push(phase));
    const a = (actual.owner.children[0] as THREE.Mesh).geometry;
    const b = (expected.owner.children[0] as THREE.Mesh).geometry;
    for (const name of Object.keys(b.attributes)) {
      expect(Array.from(a.attributes[name].array)).toEqual(Array.from(b.attributes[name].array));
      expect(a.attributes[name].normalized).toBe(b.attributes[name].normalized);
    }
    expect(Array.from(a.index!.array)).toEqual(Array.from(b.index!.array));
    expect(a.boundingBox).toEqual(b.boundingBox); expect(a.boundingSphere).toEqual(b.boundingSphere);
    expect(phases).toContain('static-worker-batch'); expect(phases).not.toContain('static-copy-transform');
    expect(terminated).toHaveBeenCalledTimes(1);
  } finally { dispose(expected); dispose(actual); }
});

it('falls back with original meshes intact when the worker fails', async () => {
  vi.stubGlobal('Worker', TestWorker); mode = 'error';
  const value = fixture(), phases: string[] = [];
  try {
    const result = await optimizeStaticMeshesProgressively(value.root, [value.owner], new AbortController().signal, (_ms, phase) => phases.push(phase));
    expect(result.sourceMeshes).toBe(2); expect(value.owner.children).toHaveLength(1);
    expect(phases).toContain('static-worker-fallback'); expect(phases).toContain('static-copy-transform');
    expect(terminated).toHaveBeenCalledTimes(1);
  } finally { dispose(value); }
});

it('terminates an in-flight worker on cancellation without removing or detaching source buffers', async () => {
  vi.stubGlobal('Worker', TestWorker); mode = 'pending';
  const value = fixture(), controller = new AbortController();
  const originals = value.owner.children.map(child => (child as THREE.Mesh).geometry);
  const disposals = originals.map(geometry => vi.spyOn(geometry, 'dispose'));
  try {
    const result = optimizeStaticMeshesProgressively(value.root, [value.owner], controller.signal, (_ms, phase) => {
      if (phase === 'static-worker-dispatch') queueMicrotask(() => controller.abort());
    });
    await expect(result).rejects.toMatchObject({name: 'AbortError'});
    expect(value.owner.children).toHaveLength(2);
    originals.forEach((geometry, index) => {
      expect((value.owner.children[index] as THREE.Mesh).geometry).toBe(geometry);
      expect(geometry.attributes.position.array.byteLength).toBeGreaterThan(0);
      expect(disposals[index]).not.toHaveBeenCalled();
    });
    expect(terminated).toHaveBeenCalledTimes(1);
  } finally { disposals.forEach(spy => spy.mockRestore()); dispose(value); }
});
