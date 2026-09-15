import * as THREE from 'three';
import { optimizeStaticMeshes, optimizeStaticMeshesProgressively, STATIC_BATCH_VERTEX_LIMIT } from './optimizeScene';

describe('bounded static mesh batching', () => {
  it('copies tessellated buffers without rebuilding their procedural geometry or changing attributes', () => {
    let constructions = 0;
    class CountedSphere extends THREE.SphereGeometry {
      constructor() { super(1, 24, 16); constructions++; }
    }
    const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const expected: THREE.BufferGeometry[] = [];
    for (let index = 0; index < 2; index++) {
      const geometry = new CountedSphere();
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(index * 3, 2, -1);
      mesh.rotation.set(0.2, 0.3, -0.1); mesh.scale.set(1, 2, 0.5);
      mesh.updateMatrix(); root.add(mesh);
      expected.push(new THREE.BufferGeometry().copy(geometry).applyMatrix4(mesh.matrix));
    }
    try {
      const result = optimizeStaticMeshes(root, []);
      expect(constructions).toBe(2);
      expect(result.batchMeshes).toBe(1);
      const merged = (root.children[0] as THREE.Mesh).geometry;
      for (const name of ['position', 'normal', 'uv']) {
        const actual = merged.getAttribute(name).array;
        const wanted = expected.flatMap(geometry => Array.from(geometry.getAttribute(name).array));
        expect(Array.from(actual)).toEqual(wanted);
      }
      expect(merged.boundingBox).not.toBeNull();
      expect(merged.boundingSphere).not.toBeNull();
    } finally {
      expected.forEach(geometry => geometry.dispose());
      root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      material.dispose();
    }
  });

  it('releases prepared copies when cancelled before merging and leaves source meshes intact', async () => {
    const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const originals = [new THREE.PlaneGeometry(), new THREE.PlaneGeometry()];
    originals.forEach(geometry => root.add(new THREE.Mesh(geometry, material)));
    const sourceDisposals = originals.map(geometry => vi.spyOn(geometry, 'dispose'));
    const copy = THREE.BufferGeometry.prototype.copy, copies: THREE.BufferGeometry[] = [];
    const copyDisposals = vi.fn();
    const copySpy = vi.spyOn(THREE.BufferGeometry.prototype, 'copy').mockImplementation(function(this: THREE.BufferGeometry, source: THREE.BufferGeometry) {
      const result = copy.call(this, source); copies.push(result); result.addEventListener('dispose', copyDisposals); return result;
    });
    const controller = new AbortController(), phases: string[] = [];
    try {
      await expect(optimizeStaticMeshesProgressively(root, [], controller.signal, (_ms, phase) => {
        phases.push(phase);
        if (phase === 'static-copy-transform') controller.abort();
      })).rejects.toMatchObject({name: 'AbortError'});
      expect(copies).toHaveLength(2);
      expect(copyDisposals).toHaveBeenCalledTimes(2);
      expect(phases).not.toContain('static-merge-attach');
      expect(root.children).toHaveLength(2);
      root.children.forEach((object,index) => expect((object as THREE.Mesh).geometry).toBe(originals[index]));
      sourceDisposals.forEach(dispose => expect(dispose).not.toHaveBeenCalled());
    } finally {
      copySpy.mockRestore(); sourceDisposals.forEach(dispose => dispose.mockRestore());
      originals.forEach(geometry => geometry.dispose()); material.dispose();
    }
  });

  it('bounds live transformed copies to one batch instead of cloning the whole scene', () => {
    const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    for (let index = 0; index < 8; index++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,3,128,128), material);
      mesh.position.x = index * 3; root.add(mesh);
    }
    let liveVertices = 0, peakVertices = 0;
    const original = THREE.BufferGeometry.prototype.copy;
    const copySpy = vi.spyOn(THREE.BufferGeometry.prototype, 'copy').mockImplementation(function(this: THREE.BufferGeometry, source: THREE.BufferGeometry) {
      const geometry = original.call(this, source), count = geometry.getAttribute('position').count;
      liveVertices += count; peakVertices = Math.max(peakVertices, liveVertices);
      geometry.addEventListener('dispose', () => { liveVertices -= count; });
      return geometry;
    });
    try {
      const result = optimizeStaticMeshes(root, []);
      expect(result.sourceMeshes).toBe(8);
      expect(peakVertices).toBeGreaterThan(0);
      expect(peakVertices).toBeLessThanOrEqual(STATIC_BATCH_VERTEX_LIMIT);
      expect(liveVertices).toBe(0);
    } finally {
      copySpy.mockRestore();
      root.traverse(object => {if (object instanceof THREE.Mesh) object.geometry.dispose();});
      material.dispose();
    }
  });

  it('bounds merged vertex buffers without losing triangles or world placement', () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial();
    let triangles = 0;
    for (let i = 0; i < 8; i++) {
      const geometry = new THREE.PlaneGeometry(2, 3, 128, 128);
      triangles += geometry.index!.count / 3;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(i * 3, i / 4, 0); root.add(mesh);
    }
    const before = new THREE.Box3().setFromObject(root);
    const result = optimizeStaticMeshes(root, []);
    expect(result.sourceMeshes).toBe(8);
    expect(result.batchMeshes).toBeGreaterThan(1);
    const meshes = root.children as THREE.Mesh[];
    expect(meshes.every(mesh => mesh.geometry.getAttribute('position').count <= STATIC_BATCH_VERTEX_LIMIT)).toBe(true);
    expect(meshes.reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3, 0)).toBe(triangles);
    const after = new THREE.Box3().setFromObject(root);
    expect(after.min.distanceTo(before.min)).toBeLessThan(0.00001);
    expect(after.max.distanceTo(before.max)).toBeLessThan(0.00001);
    const ray = new THREE.Raycaster(new THREE.Vector3(9, 0.75, 2), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(root, true)[0]?.distance).toBeCloseTo(2);
    meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose();
  });

  it('leaves an oversized source mesh intact instead of baking it into an oversized batch', () => {
    const root = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(2, 3, 256, 256);
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geometry, material); root.add(mesh);
    const result = optimizeStaticMeshes(root, []);
    expect(result.untouchedMeshes).toBe(1);
    expect(root.children[0]).toBe(mesh);
    expect(mesh.geometry).toBe(geometry);
    geometry.dispose(); material.dispose();
  });
});
