import * as THREE from 'three';
import { createLongRoomSpiralStair } from './longRoomStair';

it('keeps human tread rise and headroom when connecting either room scale', () => {
  const material = new THREE.MeshStandardMaterial();
  for (const height of [5.8, 8.3]) {
    const stair = createLongRoomSpiralStair(material, {height});
    expect(stair.userData.rise).toBeLessThanOrEqual(0.185);
    expect(stair.userData.headroomPerTurn).toBeGreaterThan(2.2);
    expect(stair.userData.stepCount * stair.userData.rise).toBeCloseTo(height);
    expect(stair.userData.railedStepCount).toBe(stair.userData.stepCount - 1);
    expect(stair.userData.placement).toBe('unassigned-alcove');
    const bounds = new THREE.Box3().setFromObject(stair);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.y).toBeCloseTo(height + 1.02);
    expect(stair.children.length).toBeLessThanOrEqual(2);
    stair.traverse(object => {
      if (object instanceof THREE.Mesh) {
        const positions = object.geometry.getAttribute('position');
        expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
        object.geometry.dispose();
      }
    });
  }
  material.dispose();
});
