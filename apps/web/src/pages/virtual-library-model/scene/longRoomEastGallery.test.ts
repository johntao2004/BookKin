import * as THREE from 'three';
import {addEastGalleryConnection} from './longRoomEastGallery';
import {addLongRoomEastEnd} from './longRoomEastEnd';
import {createLibraryMaterials} from './materials';
import {LONG_ROOM as L,EAST_GALLERY_CONNECTION as E} from '../longRoomLayout';
import {collectCameraColliders,resolveCameraCollision} from '../../virtual-library-collision';

it('supports the descent into the upper room and guards every exposed platform edge',()=>{
 const root=new THREE.Group(),materials=createLibraryMaterials(new THREE.Texture(),false,'historic-oak');
 addEastGalleryConnection(root,materials);addLongRoomEastEnd(root,materials);root.updateMatrixWorld(true);
 const colliders=collectCameraColliders(root,'hall'),ray=new THREE.Raycaster();
 const points:THREE.Vector3[]=[];
 for(let z=E.center;z<=49;z+=0.04){
  const y=L.galleryY-(L.galleryY-E.upperFloor)*THREE.MathUtils.clamp((z-E.back)/(E.steps*E.going),0,1);
  const p=new THREE.Vector3(0,y,z);points.push(p);
  ray.set(p.clone().add(new THREE.Vector3(0,0.2,0)),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObject(root,true)[0];expect(hit,`missing support at ${z}, ${y}`).toBeDefined();
  expect(Math.abs(hit.point.y-y)).toBeLessThan(0.16);
  ray.set(p.clone().add(new THREE.Vector3(0,0.2,0)),new THREE.Vector3(0,1,0));
  const overhead=ray.intersectObject(root,true)[0];
  if(overhead)expect(overhead.point.y-y).toBeGreaterThan(2.2);
 }
 for(const path of [points,[...points].reverse()])for(let i=1;i<path.length;i++) {
  const a=path[i-1].clone().add(new THREE.Vector3(0,1.65,0)),b=path[i].clone().add(new THREE.Vector3(0,1.65,0));
  expect(resolveCameraCollision(a,b,colliders).blocked).toBe(false);
 }
 for(const x of [-4,0,4])expect(resolveCameraCollision({x,y:L.galleryY+1.65,z:E.center},
  {x,y:L.galleryY+1.65,z:E.front-0.5},colliders).blocked).toBe(true);
 for(const x of [-4,4])expect(resolveCameraCollision({x,y:L.galleryY+1.65,z:E.center},
  {x,y:L.galleryY+1.65,z:E.back+0.5},colliders).blocked).toBe(true);
 for(const x of [-1.4,1.4])expect(resolveCameraCollision({x:0,y:E.upperFloor+1.65,z:44.5},
  {x,y:E.upperFloor+1.65,z:44.5},colliders).blocked).toBe(true);
});
