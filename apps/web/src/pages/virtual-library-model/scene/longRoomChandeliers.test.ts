import * as THREE from 'three';
import { longRoomBayZ } from '../longRoomLayout';
import { collectCameraColliders } from '../../virtual-library-collision';
import type { LibraryMaterials } from './materials';
import {
  addLongRoomCrystalChandeliers,
  LONG_ROOM_CRYSTAL_CHANDELIER_BAYS,
  LONG_ROOM_CRYSTAL_CHANDELIER_CEILING_Y,
  LONG_ROOM_CRYSTAL_CHANDELIER_POSITIONS,
} from './longRoomChandeliers';

function materials() {
  return Object.fromEntries([
    'stone', 'stoneDark', 'wood', 'woodDark', 'woodWarm', 'floor', 'rug', 'brass', 'iron',
    'leather', 'parchment', 'glass', 'lampGlass',
  ].map(key => [key, new THREE.MeshStandardMaterial()])) as unknown as LibraryMaterials;
}

describe('Long Room crystal ceiling lighting', () => {
  it('anchors a refined chandelier rhythm to alternating vault bays', () => {
    const root = new THREE.Group();
    addLongRoomCrystalChandeliers(root, materials());
    root.updateMatrixWorld(true);
    const fixtures = root.children.filter(child => child.name === 'Long Room crystal chandelier');

    expect(fixtures).toHaveLength(LONG_ROOM_CRYSTAL_CHANDELIER_BAYS.length);
    expect(LONG_ROOM_CRYSTAL_CHANDELIER_POSITIONS).toHaveLength(fixtures.length);
    expect(fixtures.map(fixture => fixture.position.z)).toEqual(
      LONG_ROOM_CRYSTAL_CHANDELIER_BAYS.map(bay => longRoomBayZ(bay)),
    );
    for (const fixture of fixtures) {
      const plate = fixture.getObjectByName('Crystal chandelier ceiling mounting plate');
      expect(plate).toBeDefined();
      expect(new THREE.Box3().setFromObject(plate!).max.y).toBeCloseTo(
        LONG_ROOM_CRYSTAL_CHANDELIER_CEILING_Y,
        4,
      );
      expect(fixture.getObjectByName('Crystal chandelier central pendant')).toBeDefined();
      expect(fixture.getObjectByName('Crystal chandelier suspension chain')).toBeDefined();
      expect(fixture.getObjectByName('Crystal chandelier shallow ceiling canopy')).toBeUndefined();
      expect(fixture.getObjectByName('Crystal chandelier canopy rim')).toBeUndefined();
      const stem = fixture.getObjectByName('Crystal chandelier central stem')!;
      const collar = fixture.getObjectByName('Crystal chandelier suspension collar')!;
      expect(new THREE.Box3().setFromObject(stem).max.y)
        .toBeGreaterThanOrEqual(new THREE.Box3().setFromObject(collar).min.y);
    }

    expect(collectCameraColliders(root, 'hall')).toHaveLength(fixtures.length);
  });
});
