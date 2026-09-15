import * as THREE from 'three';
import {addLongRoomEastEnd} from './longRoomEastEnd';
import {createLibraryMaterials} from './materials';
import {LONG_ROOM as L,EAST_SERVICE_ACCESS as A} from '../longRoomLayout';
import {collectCameraColliders,resolveCameraCollision} from '../../virtual-library-collision';

it('connects the independent side door to the upper room through open slabs with standing headroom',()=>{
 const root=new THREE.Group(),materials=createLibraryMaterials(new THREE.Texture(),false,'historic-oak');addLongRoomEastEnd(root,materials);
 const approach=new THREE.Mesh(new THREE.BoxGeometry(2,0.18,1.2),materials.floor);approach.position.set(A.x,-0.09,L.length/2-0.6);root.add(approach);
 root.updateMatrixWorld(true);
 const core=root.getObjectByName('East first to second floor service core')!;
 const source=core.userData.walkingSamples as {x:number;y:number;z:number}[];
 const points:THREE.Vector3[]=[];
 for(let i=1;i<source.length;i++) {
  const a=source[i-1],b=source[i],length=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),n=Math.max(1,Math.ceil(length/0.04));
  for(let j=0;j<n;j++)points.push(new THREE.Vector3(a.x+(b.x-a.x)*j/n,a.y+(b.y-a.y)*j/n,L.length/2+a.z+(b.z-a.z)*j/n));
 }
 const colliders=collectCameraColliders(root,'hall'),ray=new THREE.Raycaster();
 for(const reverse of [false,true]) {
  let previous:THREE.Vector3|null=null;
  for(const p of reverse?[...points].reverse():points) {
   ray.set(p.clone().add(new THREE.Vector3(0,0.2,0)),new THREE.Vector3(0,-1,0));
   const floor=ray.intersectObject(root,true)[0];expect(floor,`missing floor ${p.toArray()}`).toBeDefined();
   expect(Math.abs(floor.point.y-p.y),`floor mismatch ${p.toArray()}`).toBeLessThan(0.2);
   ray.set(p.clone().add(new THREE.Vector3(0,0.2,0)),new THREE.Vector3(0,1,0));const overhead=ray.intersectObject(root,true)[0];
   if(overhead)expect(overhead.point.y-p.y,`headroom ${p.toArray()}: ${overhead.object.name}`).toBeGreaterThan(2);
   const eye=p.clone().add(new THREE.Vector3(0,1.65,0));const safe=resolveCameraCollision(previous??eye,eye,colliders);
   expect(safe.blocked,`blocked ${p.toArray()}: ${safe.blockedBy}`).toBe(false);previous=eye;
  }
 }
 expect(Math.min(...source.map(p=>p.y))).toBe(0);
});
