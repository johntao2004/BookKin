import {EAST_UPPER_ROOM as U} from './longRoomEastUpperRoom';
import {EAST_SERVICE_ACCESS as A} from '../longRoomLayout';
import * as THREE from 'three';
import type {LibraryMaterials} from './materials';
import {createEastStairStudy,EAST_STAIR} from './longRoomEastStair';
import {createWestHighWindow} from './longRoomWestWindow';
import {markCameraCollider} from '../../virtual-library-collision';
import {WEST_LEVELS} from './longRoomWestLevels';

/** Historical lower enclosure is available only for isolated studies; the live
 * pavilion is closed at hall floor zero by user request. */
export function createEastStairEnclosure(materials:LibraryMaterials, includeLower = true) {
  const root=new THREE.Group();root.name='East stair enclosure and lower arrival';
  if (includeLower) root.add(createEastStairStudy(materials));
  const bottom=includeLower ? -EAST_STAIR.rise : 0,top=WEST_LEVELS.ceiling-WEST_LEVELS.landing;
  const plaster=materials.parchment.clone();plaster.roughness=0.95;
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,collision=true)=>{
    if (h <= 0) return new THREE.Group();
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),name === 'East stair ground floor' ? materials.floor : plaster);mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    if(collision)markCameraCollider(mesh,{id:`east-enclosure-${name}-${x}-${y}-${z}`,shape:'box',center:{x:0,y:0,z:0},size:{x:w,y:h,z:d}});
    return mesh;
  };
  box('East stair ground floor',includeLower ? 11.45 : 7.33,0.18,8,includeLower ? -3.605 : -5.665,bottom-0.09,4.5);
  // Reserve the independent service stair opening through the lower ceiling.
  const C=U.core;
  for(const [x0,x1,z0,z1] of [[-9.33,-2,0.38,C.west],[-9.33,-2,C.east,8.62],[-9.33,C.north,C.west,C.east],[C.south,-2,C.west,C.east]])
    box('East stair room ceiling',x1-x0,0.18,z1-z0,(x0+x1)/2,top+0.09,(z0+z1)/2,false);
  for(const [a,b] of [[-9.33,A.x-A.width/2],[A.x+A.width/2,-2]])
    box('East stair west enclosure',b-a,top-bottom,0.24,(a+b)/2,(top+bottom)/2,0.5);
  box('East service entry lower wall',A.width,-bottom,0.24,A.x,bottom/2,0.5);
  box('East service entry head',A.width,top-A.height,0.24,A.x,(top+A.height)/2,0.5);
  // Ground-level arrival remains enclosed until the exhibition is reconstructed.
  box('East lower arrival south boundary',0.24,-bottom,8,2.12,bottom/2,4.5);
  box('East lower arrival west boundary',4.24,-bottom,0.24,0,bottom/2,0.5);
  box('East lower arrival east boundary',4.24,-bottom,0.24,0,bottom/2,8.5);
  const windows=(name:string,length:number,centers:number[],x:number,z:number,rotation:number)=>{
    const wall=new THREE.Group();wall.name=name;wall.position.set(x,0,z);wall.rotation.y=rotation;root.add(wall);
    const openings=centers.flatMap(center=>[{center,base:0.85,width:1.55,height:3.1},...(includeLower ? [{center,base:bottom+0.8,width:1.55,height:2.8}] : [])]);
    const xs=[-length/2,...centers.flatMap(c=>[c-0.775,c+0.775]),length/2];
    const ys=includeLower ? [bottom,bottom+0.8,bottom+3.6,0.85,3.95,top] : [0,0.85,3.95,top];
    for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++) {
      const cx=(xs[i]+xs[i+1])/2,cy=(ys[j]+ys[j+1])/2;
      if(openings.some(o=>cx>o.center-o.width/2&&cx<o.center+o.width/2&&cy>o.base&&cy<o.base+o.height))continue;
      wall.add(box(name+' pier',xs[i+1]-xs[i],ys[j+1]-ys[j],0.24,cx,cy,0));
    }
    openings.forEach((opening,i)=>wall.add(createWestHighWindow(materials.woodWarm,plaster,opening,`east-enclosure-${name}-glass-${i}`,3,6)));
  };
  windows('East stair north windows',8,[-2.5,0,2.5],-9.33,4.5,Math.PI/2);
  windows('East stair east windows',7.33,[-1.8,1.8],-5.665,8.5,Math.PI);
  // The lower solid wall keeps the room boundary; an opening admits the bottom landing.
  for(const [a,b] of [[0.5,2.95],[4.65,8.5]])box('East lower stair threshold pier',0.24,-bottom,b-a,-2.12,bottom/2,(a+b)/2);
  if (includeLower) box('East lower stair threshold head',0.24,2.23,1.7,-2.12,-1.115,3.8);
  const light=new THREE.PointLight(materials.parchment.color,80,15,2);light.position.set(-4.5,2.8,5.2);root.add(light);
  return root;
}
