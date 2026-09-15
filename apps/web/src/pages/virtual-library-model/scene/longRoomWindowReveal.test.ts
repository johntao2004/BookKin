import * as THREE from 'three';
import { createLongRoomWindowReveal } from './longRoomWindowReveal';

it('has three physical recessed fields on both sides of the splayed window return', () => {
  const height = 3.85;
  const reveal = createLongRoomWindowReveal(height, new THREE.MeshStandardMaterial());
  reveal.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const ray = new THREE.Raycaster(new THREE.Vector3(0, (row + 0.5) * height / 3, side), new THREE.Vector3(0, 0, -side));
      const recessed = ray.intersectObject(reveal)[0];
      ray.ray.origin.x = 0.24;
      const frame = ray.intersectObject(reveal)[0];
      expect(recessed.object.name).toBe('Recessed window return field');
      expect(frame.object.name).toBe('Beveled window return frame');
      expect(recessed.distance - frame.distance).toBeGreaterThan(0.018);
    }
  }
});
