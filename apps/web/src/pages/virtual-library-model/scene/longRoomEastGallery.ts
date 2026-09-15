import * as THREE from 'three';
import {LONG_ROOM as L,EAST_GALLERY_CONNECTION as E} from '../longRoomLayout';
import type {LibraryMaterials} from './materials';
import {markCameraCollider} from '../../virtual-library-collision';
import {createLongRoomBaluster,galleryBalusterPlacement} from './longRoomBaluster';

/** End circulation serving the Y1.003 doorway. Plan dimensions and transition
 * treads are adapted to the enlarged gallery, not surveyed historical joinery. */
export function addEastGalleryConnection(parent:THREE.Group,materials:LibraryMaterials) {
 const root=new THREE.Group();root.name='East gallery doorway connection';parent.add(root);
 root.userData.fidelity='source doorway topology; estimated enlarged bridge and level transition';
 const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);
  mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
 };
 const floor=(name:string,w:number,d:number,x:number,y:number,z:number)=>{
  const mesh=box(name,w,0.24,d,x,y-0.12,z,materials.floor);
  const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),uv=mesh.geometry.getAttribute('uv');
  for(let i=0;i<p.count;i++)if(n.getY(i)>0.5)uv.setXY(i,(p.getX(i)+x)/2.88,(p.getZ(i)+z)/4.8);
  uv.needsUpdate=true;
  markCameraCollider(mesh,{id:`east-gallery-${name}-${z}`,shape:'box',center:{x:0,y:0,z:0},size:{x:w,y:0.24,z:d}});
 };
 floor('East gallery crosswalk',L.galleryInnerX*2,E.back-E.front,0,L.galleryY,E.center);
 const baluster=createLongRoomBaluster();
 const guard=(x0:number,x1:number,z:number)=>{
  const width=x1-x0;
  box('East gallery handrail',width,0.13,0.24,(x0+x1)/2,L.galleryY+1.05,z,materials.woodWarm);
  box('East gallery lower rail',width,0.14,0.2,(x0+x1)/2,L.galleryY+0.1,z,materials.woodWarm);
  const count=Math.ceil(width/0.18),posts=new THREE.InstancedMesh(baluster,materials.woodWarm,count);
  posts.name='East gallery turned balusters';posts.castShadow=posts.receiveShadow=true;
  for(let i=0;i<count;i++)posts.setMatrixAt(i,galleryBalusterPlacement(x0+(i+0.5)*width/count,L.galleryY,z));
  root.add(posts);
  markCameraCollider(root,{id:`east-gallery-guard-${x0}-${z}`,shape:'box',center:{x:(x0+x1)/2,y:L.galleryY+1.1,z},size:{x:width,y:2.2,z:0.24}});
 };
 guard(-L.galleryInnerX,L.galleryInnerX,E.front);
 guard(-L.galleryInnerX,-E.width/2,E.back);guard(E.width/2,L.galleryInnerX,E.back);
 const rise=(L.galleryY-E.upperFloor)/E.steps;
 for(let i=0;i<E.steps;i++) {
  const y=L.galleryY-(i+1)*rise,z=E.back+(i+0.5)*E.going;
  // Small tread nosing overlaps the riser joint and avoids floating-point cracks.
  floor('East doorway transition tread',E.width,E.going+0.02,0,y,z);
  for(const side of [-1,1]) {
   const x=side*(E.width/2+0.08);
   box('East doorway transition side panel',0.12,1.05,E.going,x,y+0.525,z,materials.woodWarm);
   markCameraCollider(root,{id:`east-transition-guard-${side}-${i}`,shape:'box',center:{x,y:y+1.1,z},size:{x:0.12,y:2.2,z:E.going}});
  }
 }
}
