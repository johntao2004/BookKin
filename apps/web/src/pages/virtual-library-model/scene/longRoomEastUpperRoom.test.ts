import {addLongRoomEastEnd} from './longRoomEastEnd';
import {LONG_ROOM as L} from '../longRoomLayout';
import * as THREE from 'three';
import {createFagelRoom} from './longRoomFagel';
import {EAST_UPPER_ROOM as R} from './longRoomEastUpperRoom';
import {createLibraryMaterials} from './materials';
import {collectCameraColliders,resolveCameraCollision} from '../../virtual-library-collision';

it('adds the upper room above Fagel with supported circulation, open core slab and closed guards',()=>{
 const root=createFagelRoom(createLibraryMaterials(new THREE.Texture(),false,'historic-oak'));root.updateMatrixWorld(true);
 const room=root.getObjectByName('East upper Early Printed Books room')!;
 expect(room.userData.sourceAreaM2).toBe(112);
 const floors:THREE.Object3D[]=[];room.traverse(o=>{if(o.name==='Upper pavilion floor around service core'||o.name==='Upper pavilion doorway threshold')floors.push(o);});
 const ray=new THREE.Raycaster(),colliders=collectCameraColliders(root,'hall');
 for(const x of [-7.8,-4,0,4,7.8])for(const z of [4.1,5.5,7.5]) {
  ray.set(new THREE.Vector3(x,R.floor+0.2,z),new THREE.Vector3(0,-1,0));
  expect(ray.intersectObjects(floors)[0]?.point.y).toBeCloseTo(R.floor);
  if(x<=0||z>=5.5)expect(resolveCameraCollision({x,y:R.floor+1.65,z:z-0.15},{x,y:R.floor+1.65,z},colliders).blocked).toBe(false);
 }
 ray.set(new THREE.Vector3(-5.5,R.floor+0.2,1.8),new THREE.Vector3(0,-1,0));
 expect(ray.intersectObjects(floors)).toHaveLength(0);
 expect(resolveCameraCollision({x:-5.5,y:R.floor+1.65,z:3.8},{x:-5.5,y:R.floor+1.65,z:2.8},colliders).blockedBy).toContain('Upper service core enclosure');
 expect(resolveCameraCollision({x:0,y:R.floor+1.65,z:0},{x:0,y:R.floor+1.65,z:1.2},colliders).blocked).toBe(false);
 // Window centers are apertures with glazing, not hidden solid wall faces.
 ray.set(new THREE.Vector3(0,R.floor+1.5,7),new THREE.Vector3(0,0,1));
 expect(ray.intersectObject(room,true)[0]?.object.name).toBe('High window diffused exterior daylight');
 expect(resolveCameraCollision({x:0,y:R.floor+1.5,z:7.8},{x:0,y:R.floor+1.5,z:9},colliders).blockedBy).toContain('glass');
});


it('opens the upper doorway through both pavilion and main hall walls while retaining solid jambs',()=>{
 const root=new THREE.Group();addLongRoomEastEnd(root,createLibraryMaterials(new THREE.Texture(),false,'historic-oak'));
 root.updateMatrixWorld(true);
 const colliders=collectCameraColliders(root,'hall'),ray=new THREE.Raycaster();
 // Visual rays include cornices: an invisible collider-only opening is insufficient.
 for(const x of [-0.45,0,0.45])for(const height of [0.1,0.4,1.65,2.1]) {
  const start=new THREE.Vector3(x,R.floor+height,L.length/2-0.8);
  ray.set(start,new THREE.Vector3(0,0,1));ray.far=1.5;
  expect(ray.intersectObject(root,true),`occluded upper portal at ${x}, ${height}`).toHaveLength(0);
 }
 for(const reverse of [false,true]) {
  const a={x:0,y:R.floor+1.65,z:L.length/2-0.8},b={...a,z:L.length/2+1.2};
  expect(resolveCameraCollision(reverse?b:a,reverse?a:b,colliders).blocked).toBe(false);
 }
 for(const x of [-1,1])expect(resolveCameraCollision(
  {x,y:R.floor+1.65,z:L.length/2-0.8},{x,y:R.floor+1.65,z:L.length/2+0.3},colliders).blocked).toBe(true);
});
