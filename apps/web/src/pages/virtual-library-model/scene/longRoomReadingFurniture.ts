import * as THREE from 'three';
import {PALETTE} from '../config';
import type {LibraryMaterials} from './materials';
import {markCameraCollider} from '../../virtual-library-collision';
import {alignLongRoomBoardGrain} from './longRoomTimber';

/** 2017 University Times EPB photograph: timber tables, grey desk mats,
 * dark green seats and paired foam book supports. Placement follows the south
 * fitting zone of Y1.003; count, sizes and hidden construction are estimates. */
export const READING_FURNITURE={rows:[1.6,3.8,6,8.2],stations:[1.95,3.65],depth:0.9,length:3.4,height:0.76} as const;
export function createEastReadingFurniture(materials:LibraryMaterials,floor:number) {
 const root=new THREE.Group();root.name='East upper reference reading furniture';root.position.y=floor;
 root.userData={fidelity:'photo-derived appearance; estimated dimensions and plan interpretation',
  source:'https://universitytimes.ie/wp-content/uploads/2017/04/EarlyPrintedBooksSmall.jpg',interactive:false};
 const mat=new THREE.MeshStandardMaterial({color:PALETTE.stone,roughness:0.95});
 const upholstery=new THREE.MeshStandardMaterial({color:PALETTE.green,roughness:0.94});
 const foam=new THREE.MeshStandardMaterial({color:PALETTE.parchment,roughness:1});
 const rounded=(w:number,d:number,r:number,thickness:number)=>{
  const s=new THREE.Shape();s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);
  s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);
  s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:false,curveSegments:8});g.rotateX(-Math.PI/2);return g;
 };
 const top=rounded(READING_FURNITURE.depth,READING_FURNITURE.length,0.035,0.045);
 const pad=rounded(0.72,1.35,0.018,0.008),seat=rounded(0.44,0.46,0.055,0.04);
 const back=rounded(0.32,0.46,0.045,0.035);back.rotateZ(Math.PI/2);
 const wedge=new THREE.Shape();wedge.moveTo(0,0);wedge.lineTo(0.24,0);wedge.lineTo(0.24,0.13);wedge.lineTo(0,0.025);wedge.closePath();
 const support=new THREE.ExtrudeGeometry(wedge,{depth:0.32,bevelEnabled:true,bevelSize:0.006,bevelThickness:0.006,bevelSegments:2});
 const cylinder=new THREE.CylinderGeometry(0.014,0.014,1,12);
 const mesh=<G extends THREE.BufferGeometry>(name:string,g:G,m:THREE.Material,x:number,y:number,z:number)=>{
  const o=new THREE.Mesh(g,m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;
 };
 const timber=(name:string,w:number,h:number,d:number,x:number,y:number,z:number)=>{
  const o=mesh(name,new THREE.BoxGeometry(w,h,d),materials.woodWarm,x,y,z);alignLongRoomBoardGrain(o);return o;
 };
 const tube=(a:THREE.Vector3,b:THREE.Vector3)=>{
  const o=mesh('Reading chair tubular frame',cylinder,materials.iron,0,0,0);o.position.copy(a).add(b).multiplyScalar(0.5);
  o.scale.y=a.distanceTo(b);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
 };
 for(const x of READING_FURNITURE.rows) {
  mesh('Reading table rounded timber top',top,materials.woodWarm,x,0.715,2.8);
  for(const side of [-1,1]) {
   timber('Reading table apron',0.065,0.14,3.22,x+side*0.365,0.65,2.8);
   for(const end of [-1,1])timber('Reading table leg',0.075,0.7,0.075,x+side*0.355,0.35,2.8+end*1.55);
  }
  // Eye-level proxy prevents walking through furniture even though the visible
  // table itself is below the camera's collision radius.
  markCameraCollider(root,{id:`east-reading-table-${x}`,shape:'box',center:{x,y:1.1,z:2.8},size:{x:0.9,y:2.2,z:3.4}});
  for(const z of READING_FURNITURE.stations) {
   mesh('Reading desk grey protective mat',pad,mat,x,0.761,z);
   for(const side of [-1,1]) {
    const cradle=mesh('Paired foam book cradle',support,foam,x+side*0.16,0.775,z+side*0.012);
    cradle.rotation.y=-side*Math.PI/2;
   }
   const chairX=x-0.72;
   mesh('Reading chair green seat',seat,upholstery,chairX,0.44,z);
   mesh('Reading chair green back',back,upholstery,chairX-0.235,0.86,z);
   for(const lateral of [-1,1]) {
    tube(new THREE.Vector3(chairX+0.17,0.04,z+lateral*0.19),new THREE.Vector3(chairX+0.17,0.46,z+lateral*0.19));
    tube(new THREE.Vector3(chairX-0.2,0.04,z+lateral*0.19),new THREE.Vector3(chairX-0.25,0.99,z+lateral*0.19));
   }
   markCameraCollider(root,{id:`east-reading-chair-${x}-${z}`,shape:'box',center:{x:chairX,y:1.1,z},size:{x:0.5,y:2.2,z:0.5}});
  }
 }
 return root;
}
