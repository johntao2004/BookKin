import * as THREE from 'three';
import { createWestStairCeilingRelief } from './longRoomWestCeiling';

it('faces the occupied room, fits the ceiling and preserves the photographed open centre', () => {
  const root=createWestStairCeilingRelief(new THREE.MeshStandardMaterial());
  root.rotation.x=Math.PI/2;root.position.set(0,8.49,1.775);root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root);
  expect(bounds.min.x).toBeGreaterThan(-3.28);expect(bounds.max.x).toBeLessThan(3.28);
  expect(bounds.min.z).toBeGreaterThan(-1.93);expect(bounds.max.z).toBeLessThan(5.48);
  expect(bounds.max.y).toBeLessThanOrEqual(8.5);expect(bounds.min.y).toBeGreaterThan(8.3);
  const ray=new THREE.Raycaster(new THREE.Vector3(0,7,1.775),new THREE.Vector3(0,1,0));
  expect(ray.intersectObject(root)).toHaveLength(0);
  // The four inner flowers must be visible from below with ordinary front-face materials.
  for(const [x,z] of [[0,1.83],[0,-1.83],[1.83,0],[-1.83,0]]) {
    ray.ray.origin.set(x,7,1.775+z*1.13);
    expect(ray.intersectObject(root).length).toBeGreaterThan(0);
  }
  for(const x of [-0.79,0.79]) for(const z of [-0.79,0.79]) {
    ray.ray.origin.set(x,7,1.775+z*1.13);
    expect(ray.intersectObject(root).length).toBeGreaterThan(0);
  }
});
