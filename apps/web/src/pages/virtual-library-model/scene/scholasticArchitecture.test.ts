import * as THREE from 'three';
import { collectCameraColliders } from '../../virtual-library-collision';
import { createChandelier } from './parts';
import { optimizeStaticMeshes } from './optimizeScene';
import type { LibraryMaterials } from './materials';
import { createScholasticVault } from './scholasticArchitecture';

function materials() {
  return Object.fromEntries(['stone', 'stoneDark', 'wood', 'woodDark', 'woodWarm', 'floor',
    'rug', 'brass', 'iron', 'leather', 'parchment', 'glass', 'lampGlass']
    .map(key => [key, new THREE.MeshStandardMaterial()])) as unknown as LibraryMaterials;
}

describe('collegiate architecture', () => {
  it('keeps scaled chandelier chains connected all the way to their actual ceiling', () => {
    for (const [height, scale, ceiling] of [[9.15, 1.45, 18.64], [4.2, 0.78, 6.25], [4.72, 0.68, 6.25]]) {
      const fixture = createChandelier(materials(), false, (ceiling - height) / scale);
      fixture.position.y = height;
      fixture.scale.setScalar(scale);
      fixture.updateMatrixWorld(true);
      const plate = fixture.getObjectByName('Chandelier ceiling mounting plate')!;
      expect(new THREE.Box3().setFromObject(plate).max.y).toBeCloseTo(ceiling, 5);
      const collar = fixture.getObjectByName('Chandelier suspension collar')!;
      const links = fixture.children.filter(child => child.name.startsWith('Chandelier chain link'));
      let previousTop = new THREE.Box3().setFromObject(collar).max.y;
      for (const link of links) {
        const bounds = new THREE.Box3().setFromObject(link);
        expect(bounds.min.y).toBeLessThan(previousTop);
        previousTop = bounds.max.y;
      }
      const shackle = fixture.getObjectByName('Chandelier ceiling shackle')!;
      expect(new THREE.Box3().setFromObject(shackle).min.y).toBeLessThan(previousTop);
    }
  });

  it('keeps the complete hall roof above every upper bookcase crown', () => {
    const root = createScholasticVault(materials());
    const bounds = new THREE.Box3().setFromObject(root);
    expect(bounds.min.y).toBeGreaterThan(11.4);
    expect(root.getObjectByName('Pointed hammerbeam truss 0')).toBeUndefined();
  });

  it('builds a closed finite vault with a bounded geometry and draw-call cost', () => {
    const root = createScholasticVault(materials());
    let triangles = 0;
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      triangles += (object.geometry.index?.count ?? positions.count) / 3;
    });
    expect(root.getObjectByName('Continuous curved oak vault lining')).toBeDefined();
    expect(triangles).toBeLessThan(500_000);
    const result = optimizeStaticMeshes(root, []);
    expect(result.batchMeshes + result.untouchedMeshes).toBeLessThan(12);
    expect(collectCameraColliders(root, 'hall')).toHaveLength(0);
  });
});
