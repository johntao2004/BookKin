import * as THREE from 'three';
import {createEastReadingFurniture,READING_FURNITURE as F} from './longRoomReadingFurniture';
import {createLibraryMaterials} from './materials';
import {collectCameraColliders,resolveCameraCollision} from '../../virtual-library-collision';

it('keeps entry and cross aisles open while blocking furniture and placing cradles on desk mats',()=>{
 const floor=5.49,root=createEastReadingFurniture(createLibraryMaterials(new THREE.Texture(),false,'historic-oak'),floor);
 root.updateMatrixWorld(true);const colliders=collectCameraColliders(root,'hall'),ray=new THREE.Raycaster();
 for(const x of [0,2.44,4.64,6.84]) {
  let previous={x,y:floor+1.65,z:5.2};
  for(let z=5.16;z>=1;z-=0.04){const eye={x,y:floor+1.65,z};expect(resolveCameraCollision(previous,eye,colliders).blocked,`aisle ${x},${z}`).toBe(false);previous=eye;}
 }
 for(const x of F.rows) {
  expect(resolveCameraCollision({x,y:floor+1.65,z:5.2},{x,y:floor+1.65,z:4},colliders).blockedBy).toContain('east-reading-table');
  expect(resolveCameraCollision({x:x-1.4,y:floor+1.65,z:3.65},{x:x-0.9,y:floor+1.65,z:3.65},colliders).blockedBy).toContain('east-reading-chair');
  for(const z of F.stations) {
   ray.set(new THREE.Vector3(x,floor+1.2,z+0.15),new THREE.Vector3(0,-1,0));
   const hits=ray.intersectObject(root,true);expect(hits[0].object.name).toBe('Paired foam book cradle');
   expect(hits.some(hit=>hit.object.name==='Reading desk grey protective mat')).toBe(true);
  }
 }
});
