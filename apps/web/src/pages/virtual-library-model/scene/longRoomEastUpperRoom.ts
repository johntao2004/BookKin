import {createEastReadingFurniture} from './longRoomReadingFurniture';
import {EAST_GALLERY_CONNECTION,EAST_SERVICE_ACCESS as A} from '../longRoomLayout';
import * as THREE from 'three';
import type {LibraryMaterials} from './materials';
import {createWestHighWindow} from './longRoomWestWindow';
import {markCameraCollider} from '../../virtual-library-collision';

/** Y1.003: Early Printed Books (112 m²) over the east pavilion. Floor datums
 * come from Y2.001; the enlarged envelope, opening sizes and ceiling are estimates. */
export const EAST_UPPER_ROOM={floor:EAST_GALLERY_CONNECTION.upperFloor,ceiling:8.54,north:-9.33,south:9.33,west:0.5,east:8.5,
  door:{width:1.6,height:2.35},core:{north:-9.1,south:-2.5,west:0.68,east:3.05},sourceArea:112} as const;
export function createEastUpperRoom(materials:LibraryMaterials) {
  const R=EAST_UPPER_ROOM,root=new THREE.Group();root.name='East upper Early Printed Books room';
  root.userData.fidelity='Y1.003 room topology and source floor level; adapted enclosure';root.userData.sourceAreaM2=R.sourceArea;
  const finish=materials.parchment.clone();finish.roughness=0.93;
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material=finish,collision=true)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    if(material===materials.floor) {
      const position=mesh.geometry.getAttribute('position'),normal=mesh.geometry.getAttribute('normal'),uv=mesh.geometry.getAttribute('uv');
      for(let i=0;i<position.count;i++)if(normal.getY(i)>0.5)uv.setXY(i,(position.getX(i)+x)/2.88,(position.getZ(i)+z)/4.8);
      uv.needsUpdate=true;
    }
    if(collision)markCameraCollider(mesh,{id:`east-upper-${name}-${x}-${y}-${z}`,shape:'box',center:{x:0,y:0,z:0},size:{x:w,y:h,z:d}});
    return mesh;
  };
  // Keep the stair/lift footprint open rather than placing an unbroken slab over it.
  for(const [x0,x1,z0,z1] of [[R.north,R.south,R.west,R.core.west],[R.north,R.south,R.core.east,R.east],
    [R.north,R.core.north,R.core.west,R.core.east],[R.core.south,R.south,R.core.west,R.core.east]])
    box('Upper pavilion floor around service core',x1-x0,0.2,z1-z0,(x0+x1)/2,R.floor-0.1,(z0+z1)/2,materials.floor);
  box('Upper pavilion ceiling',R.south-R.north+0.24,0.2,R.east-R.west+0.24,0,R.ceiling+0.1,4.5);
  const H=R.ceiling-R.floor;
  // Main-hall connection appears on the source plan; the gallery approach is connected.
  for(const [a,b] of [[R.north,-R.door.width/2],[R.door.width/2,R.south]])box('Upper pavilion west wall',b-a,H,0.24,(a+b)/2,R.floor+H/2,R.west);
  box('Upper pavilion doorway head',R.door.width,H-R.door.height,0.24,0,R.floor+(H+R.door.height)/2,R.west);
  // Line the wall thickness between the hall end and pavilion wall; avoid a
  // paper-thin cutout when the doorway is viewed obliquely from the gallery.
  for(const side of [-1,1])box('Upper pavilion doorway reveal',0.08,R.door.height,R.west,
    side*(R.door.width/2+0.04),R.floor+R.door.height/2,R.west/2,materials.woodWarm);
  box('Upper pavilion doorway soffit',R.door.width+0.16,0.08,R.west,0,
    R.floor+R.door.height+0.04,R.west/2,materials.woodWarm);
  box('Upper pavilion doorway threshold',R.door.width,0.2,0.75,0,R.floor-0.1,0.25,materials.floor);
  const windowWall=(name:string,length:number,centers:number[],x:number,z:number,angle:number)=>{
    const wall=new THREE.Group();wall.name=name;wall.position.set(x,R.floor,z);wall.rotation.y=angle;root.add(wall);
    const width=1.35,base=0.45,height=2.3;
    const cuts=[-length/2,...centers.flatMap(c=>[c-width/2,c+width/2]),length/2];
    for(let i=0;i<cuts.length-1;i++)for(const [lo,hi] of i%2?[[0,base],[base+height,H]]:[[0,H]]) {
      const mesh=box(name+' pier',cuts[i+1]-cuts[i],hi-lo,0.24,(cuts[i]+cuts[i+1])/2,(hi+lo)/2,0);wall.add(mesh);
    }
    centers.forEach((center,index)=>wall.add(createWestHighWindow(materials.woodWarm,finish,
      {center,base,width,height},`east-upper-${name}-glass-${index}`,3,6)));
  };
  windowWall('Upper pavilion north windows',8,[-2.5,0,2.5],R.north,4.5,Math.PI/2);
  windowWall('Upper pavilion south windows',8,[-2.5,0,2.5],R.south,4.5,-Math.PI/2);
  windowWall('Upper pavilion east windows',R.south-R.north,[-7.4,-3.7,0,3.7,7.4],0,R.east,Math.PI);
  const C=R.core;
  for(const x of [C.north,C.south])box('Upper service core enclosure',0.12,H,C.east-C.west,x,R.floor+H/2,(C.west+C.east)/2);
  box('Upper service core enclosure',C.south-C.north,H,0.12,(C.north+C.south)/2,R.floor+H/2,C.west);
  for(const [a,b] of [[C.north,A.x-A.width/2],[A.x+A.width/2,C.south]])
    box('Upper service core enclosure',b-a,H,0.12,(a+b)/2,R.floor+H/2,C.east);
  box('Upper service doorway head',A.width,H-A.height,0.12,A.x,R.floor+(H+A.height)/2,C.east);
  box('Upper service doorway threshold',A.width,0.16,0.7,A.x,R.floor-0.08,C.east,materials.floor);
  const light=new THREE.PointLight(materials.parchment.color,55,18,2);light.position.set(0,R.ceiling-0.4,5);root.add(light);
  root.add(createEastReadingFurniture(materials,R.floor));
  return root;
}
