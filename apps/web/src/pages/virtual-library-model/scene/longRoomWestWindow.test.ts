import * as THREE from 'three';
import { createWestStairEnclosure } from './longRoomWestEnclosure';
import { collectCameraColliders, resolveCameraCollision } from '../../virtual-library-collision';

it('opens both surveyed first-flight high windows and retains independent glazing collision',()=>{
  const root=createWestStairEnclosure(new THREE.MeshStandardMaterial(),new THREE.MeshStandardMaterial(),false);
  root.updateMatrixWorld(true);
  const colliders=collectCameraColliders(root,'hall');
  // Actual wall-space rays check the opening, not just the sash mesh counts.
  for(const [index,z] of [4.325,0.925].entries()) {
    const ray=new THREE.Raycaster(new THREE.Vector3(-1,7.9,z),new THREE.Vector3(-1,0,0),0,3);
    expect(ray.intersectObject(root)[0]?.object.name).toBe('High window diffused exterior daylight');
    const collision=resolveCameraCollision({x:-2.9,y:7.9,z},{x:-3.9,y:7.9,z},colliders);
    expect(collision.blocked).toBe(true);
    expect(collision.blockedBy).toBe(`west-high-window-glazing-${index}`);
  }
  // The lower opening passes through the rusticated finish as well as the wall core.
  const lower=new THREE.Raycaster(new THREE.Vector3(-1,3.5,1.065),new THREE.Vector3(-1,0,0),0,3);
  expect(lower.intersectObject(root)[0]?.object.name).toBe('High window diffused exterior daylight');
  const lowerCollision=resolveCameraCollision({x:-2.9,y:3.775,z:1.065},{x:-3.9,y:3.775,z:1.065},colliders);
  expect(lowerCollision.blockedBy).toBe('west-lower-window-glazing');
  const door=new THREE.Raycaster(new THREE.Vector3(-1,1.65,4.325),new THREE.Vector3(-1,0,0),0,3);
  expect(door.intersectObject(root)).toHaveLength(0);
  // The former invented central rear window must now be solid plaster.
  const rear=new THREE.Raycaster(new THREE.Vector3(0.3,7.9,0),new THREE.Vector3(0,0,-1),0,3);
  expect(rear.intersectObject(root)[0]?.object.name).toBe('Continuous plaster wall pier');
});
