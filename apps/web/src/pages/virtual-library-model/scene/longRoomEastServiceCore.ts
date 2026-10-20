import * as THREE from 'three';
import type {LibraryMaterials} from './materials';
import {EAST_UPPER_ROOM as U} from './longRoomEastUpperRoom';
import {EAST_SERVICE_ACCESS as A} from '../longRoomLayout';
import {createEastServiceStair} from './longRoomEastServiceStair';
import {markCameraCollider} from '../../virtual-library-collision';

// 仅连接一层至二层；资料中的其他楼层仅供审阅。
/** First-to-second-floor connection only. Other source storeys remain review-only. */
export function createEastServiceCore(materials:LibraryMaterials) {
 const root=new THREE.Group();root.name='East first to second floor service core';
 const stair=createEastServiceStair(materials,[0,U.floor]);root.add(stair);
 const C=U.core,finish=materials.parchment.clone();finish.roughness=0.94;
 const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material=finish)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.name=name;mesh.position.set(x,y,z);
  mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  markCameraCollider(mesh,{id:`east-service-core-${name}-${x}-${z}`,shape:'box',center:{x:0,y:0,z:0},size:{x:w,y:h,z:d}});
 };
 for(const x of [C.north,C.south])box('Lower service core side wall',0.12,U.floor,C.east-C.west,x,U.floor/2,(C.east+C.west)/2);
 box('Lower service core east wall',C.south-C.north,U.floor,0.12,(C.south+C.north)/2,U.floor/2,C.east);
 box('Service stair entry threshold',A.width,0.16,1.5,A.x,-0.08,0.55,materials.floor);
 // 北侧区域仍为电梯预留；封闭通往井道空洞的入口。
 // The northern portion remains reserved for the lift; close access to its void.
 box('Service core lift reservation',1.38,U.ceiling,C.east-C.west,-8.35,U.ceiling/2,(C.east+C.west)/2);
 const route=stair.userData.walkingSamples as {x:number;y:number;z:number}[];
 // 书柜加深后，起点须避开过道端壁柱的相机净空，同时保持在服务门洞靠大厅一侧。
 // Start beyond the aisle-end pilaster's camera clearance after the cases
 // were deepened, while remaining on the hall side of the service doorway.
 root.userData.walkingSamples=[{x:A.x,y:0,z:-0.6},{x:A.x,y:0,z:1.1},...route,
  {x:A.x,y:U.floor,z:2.5},{x:A.x,y:U.floor,z:3.5},{x:A.x,y:U.floor,z:4.5}];
 return root;
}
