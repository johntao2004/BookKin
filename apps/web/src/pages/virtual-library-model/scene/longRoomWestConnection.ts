import {createWestUpperRooms} from './longRoomWestUpperRooms';
import { createHenryJonesRoom } from './longRoomHenryJones';
import * as THREE from 'three';
import { LONG_ROOM } from '../longRoomLayout';
import { markCameraCollider } from '../../virtual-library-collision';
import { addLongRoomWestEnd } from './longRoomEastEnd';
import { createWestStairStudySteps } from './longRoomWestStairStudy';
import type { LibraryMaterials } from './materials';

/** Provisional connection, with the historic stair arrival at Long Room floor zero.
 * Used for guided navigation; the pavilion placement remains unmeasured. */
export const WEST_CONNECTION = {
  offsetX:-2.08, offsetY:-5.4, offsetZ:-LONG_ROOM.length/2-1.2-5.72,
  passageWidth:1.04, passageHeight:2.35, passageLength:1.3,
} as const;

export function* createWestConnectionSteps(materials:LibraryMaterials, includeHallFloor = true, includeLower = true, includeUpper = true): Generator<string, THREE.Group> {
  const root=new THREE.Group(); root.name='West pavilion and Long Room connection study';
  root.userData.fidelity='unmeasured-threshold-alignment-hypothesis';
  const stair=includeLower ? yield* createWestStairStudySteps(materials,false) : createWestLevelPassage(materials);
  stair.position.set(WEST_CONNECTION.offsetX,WEST_CONNECTION.offsetY,WEST_CONNECTION.offsetZ); root.add(stair);
  const room=createHenryJonesRoom(materials); room.position.copy(stair.position); root.add(room);
  yield 'construction-west-henry-jones-room';
  if (includeUpper) root.add(createWestUpperRooms(materials));
  yield 'construction-west-upper-storage';
  addLongRoomWestEnd(root,materials,true,includeUpper,!includeUpper);
  yield 'construction-west-hall-portal';
  const surfaces=new THREE.Group(); surfaces.name='West connection walking surfaces'; root.add(surfaces);
  const box=(parent:THREE.Group,name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material); mesh.name=name;
    mesh.position.set(x,y,z); mesh.castShadow=mesh.receiveShadow=true; parent.add(mesh); return mesh;
  };
  const endZ=-LONG_ROOM.length/2;
  const passageDepth=includeUpper?1.3:1.1;
  const passageZ=includeUpper?endZ-0.55:endZ-0.7;
  box(surfaces,'Continuous west connection threshold',1.04,0.12,includeHallFloor?1.3:passageDepth,0,-0.06,passageZ,materials.floor);
  if(includeHallFloor) box(surfaces,'Short Long Room arrival floor study',3.5,0.12,3,0,-0.06,endZ+1.5,materials.floor);
  for(const side of [-1,1]) {
    const wall=box(root,'West connection passage lining',0.12,2.35,passageDepth,side*0.58,1.175,passageZ,materials.parchment);
    markCameraCollider(wall,{id:`west-connection-lining-${side}`,shape:'box',center:{x:0,y:0,z:0},size:{x:0.12,y:2.35,z:passageDepth}});
  }
  box(root,'West connection passage ceiling',1.28,0.12,passageDepth,0,2.41,passageZ,materials.parchment);
  return root;
}

export function createWestConnectionStudy(materials: LibraryMaterials, includeHallFloor = true) {
  const steps = createWestConnectionSteps(materials, includeHallFloor);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

/** User-requested level connection: no stairwell or lower storey in the live hall. */
function createWestLevelPassage(materials:LibraryMaterials) {
  const root=new THREE.Group();root.name='West level passage without lower storey';
  const floor=5.4,height=5.05;
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    markCameraCollider(mesh,{id:`west-level-${name}-${x}-${z}`,shape:'box',center:{x:0,y:0,z:0},size:{x:w,y:h,z:d}});
  };
  box('Continuous west level floor',2.36,.18,2.12,2.34,floor-.09,4.78,materials.floor);
  box('West level ceiling',2.36,.18,2.12,2.34,floor+height+.09,4.78,materials.parchment);
  box('West level side wall',.24,height,2.12,1.16,floor+height/2,4.78,materials.parchment);
  box('West level back wall',2.36,height,.24,2.34,floor+height/2,3.72,materials.parchment);
  for(const [a,b] of [[1.16,1.56],[2.6,3.52]])
    box('West level entrance pier',b-a,height,.24,(a+b)/2,floor+height/2,5.84,materials.parchment);
  box('West level entrance head',1.04,height-2.35,.24,2.08,floor+(height+2.35)/2,5.84,materials.parchment);
  for(const [a,b] of [[-2.05,4.12],[5.16,5.84]])
    box('West level room pier',.24,height,b-a,3.4,floor+height/2,(a+b)/2,materials.parchment);
  box('West level room head',.24,height-2.35,1.04,3.4,floor+(height+2.35)/2,4.64,materials.parchment);
  return root;
}
