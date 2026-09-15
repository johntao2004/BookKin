import * as THREE from 'three';
import { createLongRoomSashes } from './longRoomSash';

it('recesses eighteen panes behind two staggered sash frames without an open meeting seam', () => {
  const height = 3.85, wood = new THREE.MeshStandardMaterial(), glass = new THREE.MeshStandardMaterial();
  const root = createLongRoomSashes(height, wood, glass); root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  try {
    for (let level = 0; level < 2; level++) {
      const sash = root.children[level];
      const sashHeight = height / 2 + 0.0475;
      for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
        const y = sash.position.y + 0.0475 + (sashHeight - 0.095) * (row + 0.5) / 3;
        ray.set(new THREE.Vector3(-1.49 / 2 + 1.49 * (column + 0.5) / 3, y, 1), new THREE.Vector3(0, 0, -1));
        const hit = ray.intersectObject(root, true)[0];
        expect(hit.object.name).toBe('Nine individually recessed sash panes');
        expect(hit.point.z).toBeCloseTo(level ? 0 : 0.075, 5);
      }
    }
    for (const x of [-0.7, 0, 0.7]) {
      ray.set(new THREE.Vector3(x, height / 2, 1), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObject(root, true)[0].object.name).toBe('Sash frame and glazing bars');
    }
    const lowerFrame = new THREE.Box3().setFromObject(root.children[0].children[0]);
    const upperFrame = new THREE.Box3().setFromObject(root.children[1].children[0]);
    expect(lowerFrame.min.z).toBeGreaterThan(upperFrame.max.z);
    expect(lowerFrame.max.y).toBeGreaterThan(upperFrame.min.y);
  } finally {
    root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    wood.dispose(); glass.dispose();
  }
});
