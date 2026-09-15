import * as THREE from 'three';
import {createWestUpperRooms,WEST_UPPER_ROOMS as R,WEST_UPPER_TRANSITION as T} from './longRoomWestUpperRooms';
import {LONG_ROOM as L} from '../longRoomLayout';
import {createLibraryMaterials} from './materials';
import {collectCameraColliders,resolveCameraCollision} from '../../virtual-library-collision';

it('supports west storage floor, partition doorways and solid window boundaries',()=>{
  const root=createWestUpperRooms(createLibraryMaterials(undefined,false,'historic-oak'));
  root.updateMatrixWorld(true);const colliders=collectCameraColliders(root,'hall'),ray=new THREE.Raycaster();
  for(const [x,z] of [[5,-4.5],[-4,-3],[-4,-7],[-7.5,-3]]) {
    ray.set(new THREE.Vector3(x,R.floor+.2,z-45),new THREE.Vector3(0,-1,0));
    expect(ray.intersectObject(root,true)[0].point.y).toBeCloseTo(R.floor);
    ray.set(new THREE.Vector3(x,R.floor+.2,z-45),new THREE.Vector3(0,1,0));
    expect(ray.intersectObject(root,true)[0].point.y-R.floor).toBeGreaterThan(2.9);
  }
  for(const [a,b] of [
    [{x:-1.5,z:-2.1},{x:-2.5,z:-2.1}],
    [{x:-5.8,z:-3},{x:-6.8,z:-3}],
    [{x:-5.4,z:-4.8},{x:-5.4,z:-5.7}],
  ])for(const reverse of [false,true]) {
    const from={...a,y:R.floor+1.65,z:a.z-45},to={...b,y:R.floor+1.65,z:b.z-45};
    expect(resolveCameraCollision(reverse?to:from,reverse?from:to,colliders).blocked).toBe(false);
  }
  expect(resolveCameraCollision({x:-1.5,y:R.floor+1.65,z:-49},{x:-2.5,y:R.floor+1.65,z:-49},colliders).blocked).toBe(true);
  expect(resolveCameraCollision({x:0,y:R.floor+1.65,z:-53},{x:0,y:R.floor+1.65,z:-54},colliders).blocked).toBe(true);
});

it('supports every west entrance tread and keeps the descending doorway clear',()=>{
  const root=createWestUpperRooms(createLibraryMaterials(undefined,false,'historic-oak'));
  root.updateMatrixWorld(true);
  const colliders=collectCameraColliders(root,'hall'),ray=new THREE.Raycaster();
  const rise=(L.galleryY-R.floor)/T.steps;
  let previous={x:0,y:L.galleryY+1.65,z:-45};
  for(let i=0;i<T.steps;i++) {
    const floor=L.galleryY-(i+1)*rise,z=-45-.1-(i+.5)*T.going;
    ray.set(new THREE.Vector3(0,floor+.1,z),new THREE.Vector3(0,-1,0));
    expect(ray.intersectObject(root,true)[0].point.y).toBeCloseTo(floor);
    const next={x:0,y:floor+1.65,z};
    expect(resolveCameraCollision(previous,next,colliders)).toMatchObject({blocked:false,blockedBy:null});
    expect(resolveCameraCollision(next,previous,colliders).blocked).toBe(false);
    previous=next;
  }
  expect(resolveCameraCollision(previous,{...previous,z:-46.5},colliders).blocked).toBe(false);
  expect(resolveCameraCollision(previous,{...previous,x:1.2},colliders).blocked).toBe(true);
});
