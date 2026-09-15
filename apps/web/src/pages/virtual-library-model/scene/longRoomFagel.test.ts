import * as THREE from 'three';
import {createFagelRoom} from './longRoomFagel';
import {createLibraryMaterials} from './materials';
import {collectCameraColliders,resolveCameraCollision} from '../../virtual-library-collision';

it('supports the central route through both Fagel partitions while blocking the cases',()=>{
  const root=createFagelRoom(createLibraryMaterials(new THREE.Texture(),false,'historic-oak'));root.updateMatrixWorld(true);
  const colliders=collectCameraColliders(root,'hall'),ray=new THREE.Raycaster();
  for(let x=0;x<=8.7;x+=0.08) {
    ray.set(new THREE.Vector3(x,1.65,4.5),new THREE.Vector3(0,-1,0));
    expect(ray.intersectObjects([root.getObjectByName('Fagel room floor')!,root.getObjectByName('East circulation floor')!])[0]?.point.y).toBeCloseTo(0,4);
    const safe=resolveCameraCollision({x:x-0.08,y:1.65,z:4.5},{x,y:1.65,z:4.5},colliders);
    expect(safe.blocked).toBe(false);
  }
  for(const x of [2,5.665]) {
    const safe=resolveCameraCollision({x:x-0.5,y:1.65,z:3},{x:x+0.5,y:1.65,z:3},colliders);
    expect(safe.blocked).toBe(true);
  }
  expect(root.userData.sourceAreaM2).toBe(55);
  const books=root.getObjectByName('Fagel anonymous historical volumes') as THREE.InstancedMesh;
  expect(books.count).toBe(1000);
  expect(books.userData.interactive).toBe(false);
});
