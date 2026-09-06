import * as THREE from 'three';
import { createFireplaceFire } from './fireplaceFire';
import { optimizeStaticMeshes } from './optimizeScene';

describe('hearth fire volume', () => {
  it('stays inside the opening and behind the grate, with coals on the hearth', () => {
    const fire = createFireplaceFire();
    const volume = fire.group.getObjectByName('Volumetric hearth flames')!;
    const bounds = new THREE.Box3().setFromObject(volume);
    expect(bounds.min.x).toBeGreaterThan(-1.05);
    expect(bounds.max.x).toBeLessThan(1.05);
    expect(bounds.min.y).toBeGreaterThan(0.22);
    expect(bounds.max.y).toBeLessThan(1.84);
    expect(bounds.min.z).toBeGreaterThan(-0.84);
    expect(bounds.max.z).toBeLessThan(-0.37);
    const coals = new THREE.Box3().setFromObject(fire.group.getObjectByName('Grounded glowing coals')!);
    expect(coals.min.y).toBeCloseTo(0.22, 5);
    expect(fire.group.children.some(object => object instanceof THREE.Sprite)).toBe(false);
  });

  it('animates the fire density after batching without moving its base or bounds', () => {
    const fire = createFireplaceFire();
    const volume = fire.group.getObjectByName('Volumetric hearth flames') as THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>;
    const bounds = new THREE.Box3().setFromObject(volume);
    optimizeStaticMeshes(fire.group, []);
    fire.animate(5.5);
    expect(volume.material.uniforms.uTime.value).toBe(5.5);
    expect(new THREE.Box3().setFromObject(volume).equals(bounds)).toBe(true);
    expect(volume.parent).toBe(fire.group);
  });
});
