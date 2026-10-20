// 验证搜索球的位置、比例、碰撞与可点晶体一致，不只检查外观尺寸。
// Checks search-orb position/scale, collider and clickable crystal agree rather than only visual size.
import * as THREE from 'three';
import { createMagicCatalogOrb } from './catalogTerminal';
import { collectCameraColliders } from '../../virtual-library-collision';
import { disposeScene } from '../../virtual-library-scene';
import type { LibraryMaterials } from './materials';

describe('magic catalog search orb', () => {
  it('stands enlarged in the former central globe position with a matching collision and clickable crystal', () => {
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const materials = {brass: new THREE.MeshStandardMaterial(), woodDark: new THREE.MeshStandardMaterial()} as LibraryMaterials;
    const root = new THREE.Scene();
    try {
      const orb = createMagicCatalogOrb(materials);
      root.add(orb);
      root.updateMatrixWorld(true);
      expect(orb.position.toArray()).toEqual([0, 0, 8]);
      expect(orb.scale.toArray()).toEqual([2.6, 2.6, 2.6]);
      const crystal = orb.getObjectByName('Smoky amber crystal with celestial inlay');
      expect(crystal).toBeDefined();
      const center = crystal!.getWorldPosition(new THREE.Vector3());
      const origin = new THREE.Vector3(0, 1.78, 15.345);
      const ray = new THREE.Raycaster(origin, center.clone().sub(origin).normalize());
      expect(ray.intersectObject(orb, true).length).toBeGreaterThan(0);
      const colliders = collectCameraColliders(root, "hall");
      const collider = colliders.find(c => c.id === 'catalog-orb');
      expect(collider?.shape).toBe('box');
      if (collider?.shape !== 'box') throw new Error('Missing orb collision');
      expect(collider.x).toBe(0);
      expect(collider.z).toBe(8);
      expect(collider.halfX).toBeCloseTo(0.975);
      expect(collider.halfY).toBeCloseTo(1.339);
    } finally {
      disposeScene(root);
      context.mockRestore();
    }
  });
});
