import * as THREE from 'three';
import type {LibraryMaterials} from './materials';
import {LONG_ROOM as L} from '../longRoomLayout';
import {createWestHighWindow} from './longRoomWestWindow';
import {markCameraCollider} from '../../virtual-library-collision';

/** Y1.003: west upper storage (21/78 m²) and northern circulation (4 m²).
 * Layout subdivisions follow the drawing; enlarged envelope/doors are estimates.
 * Local axes retain world orientation; negative z runs west from the hall end. */
export const WEST_UPPER_ROOMS={floor:5.49,ceiling:8.54,north:-9.33,south:9.33,west:-8.5,east:-.5,
  northPartition:-6.3,storagePartition:-2,innerPartition:-5.25,doorWidth:1.05,doorHeight:2.7} as const;
export const WEST_UPPER_TRANSITION={width:1.8,steps:3,going:.35} as const;
export function createWestUpperRooms(materials:LibraryMaterials) {
  const R=WEST_UPPER_ROOMS,H=R.ceiling-R.floor;
  const root=new THREE.Group();root.name='West upper storage rooms';root.position.z=-L.length/2;
  root.userData={fidelity:'Y1.003 partitions; source-relative level; adapted envelope',sourceAreasM2:{storageNorth:21,storageSouth:78,circulation:4},
    stairStatus:'northern core circulation reserved; upper flight not reconstructed',accessStatus:'supported level transition behind closed upper hall door'};
  const plaster=materials.parchment.clone();
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material=plaster)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    if(material===materials.floor) {
      const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),uv=mesh.geometry.getAttribute('uv');
      for(let i=0;i<p.count;i++)if(n.getY(i)>.5)uv.setXY(i,(p.getX(i)+x)/2.88,(p.getZ(i)+z-L.length/2)/4.8);
    }
    markCameraCollider(mesh,{id:`west-upper-${name}-${x}-${y}-${z}`,shape:'box',center:{x:0,y:0,z:0},size:{x:w,y:h,z:d}});
    return mesh;
  };
  box('West upper continuous floor',R.south-R.north,.2,8,0,R.floor-.1,-4.5,materials.floor);
  box('West upper continuous ceiling',R.south-R.north+.24,.2,8.24,0,R.ceiling+.1,-4.5);
  // Hall doorway is physically closed in the hall joinery. Preserve an aperture
  // in this rear wall for the later supported gallery-level transition.
  for(const [a,b] of [[R.north,-.9],[.9,R.south]])box('West upper east wall pier',b-a,H,.24,(a+b)/2,R.floor+H/2,R.east);
  box('West upper entrance head',1.8,H-R.doorHeight,.24,0,R.floor+(H+R.doorHeight)/2,R.east);
  // The source room datum and enlarged gallery differ by 46 cm. This short
  // transition is an explicit circulation adaptation, not surveyed stairwork.
  const T=WEST_UPPER_TRANSITION,rise=(L.galleryY-R.floor)/T.steps;
  box('West upper entrance landing',T.width,.2,1.3,0,L.galleryY-.1,.15,materials.floor);
  for(let i=0;i<T.steps;i++) {
    const y=L.galleryY-(i+1)*rise,z=-(i+.5)*T.going-.1;
    box('West upper transition tread',T.width,.2,T.going+.02,0,y-.1,z,materials.floor);
    for(const side of [-1,1]) {
      box('West upper transition side panel',.12,1.05,T.going,side*(T.width/2+.08),y+.525,z,materials.woodWarm);
      markCameraCollider(root,{id:`west-upper-transition-guard-${i}-${side}`,shape:'box',
        center:{x:side*(T.width/2+.08),y:y+1.1,z},size:{x:.12,y:2.2,z:T.going}});
    }
  }
  const windowWall=(name:string,length:number,centers:number[],x:number,z:number,angle:number)=>{
    const wall=new THREE.Group();wall.name=name;wall.position.set(x,R.floor,z);wall.rotation.y=angle;root.add(wall);
    const width=1.35,base=.45,height=2.3;
    const cuts=[-length/2,...centers.flatMap(c=>[c-width/2,c+width/2]),length/2];
    for(let i=0;i<cuts.length-1;i++)for(const [lo,hi] of i%2?[[0,base],[base+height,H]]:[[0,H]])
      wall.add(box(name+' pier',cuts[i+1]-cuts[i],hi-lo,.24,(cuts[i]+cuts[i+1])/2,(lo+hi)/2,0));
    centers.forEach((center,index)=>wall.add(createWestHighWindow(materials.woodWarm,plaster,
      {center,base,width,height},`west-upper-${name}-glass-${index}`,3,6)));
  };
  windowWall('West upper north windows',8,[-2.5,0,2.5],R.north,-4.5,Math.PI/2);
  windowWall('West upper south windows',8,[-2.5,0,2.5],R.south,-4.5,-Math.PI/2);
  windowWall('West upper west windows',R.south-R.north,[-7.4,-3.7,0,3.7,7.4],0,R.west,0);
  // Transverse north/store partitions, with doors at the plan's east side.
  const partition=(x:number,z0:number,z1:number,doorZ:number)=>{
    for(const [a,b] of [[z0,doorZ-R.doorWidth/2],[doorZ+R.doorWidth/2,z1]])
      box('West upper transverse partition',.14,H,b-a,x,R.floor+H/2,(a+b)/2);
    box('West upper partition door head',.14,H-R.doorHeight,R.doorWidth,x,R.floor+(H+R.doorHeight)/2,doorZ);
    box('West upper door timber head',.22,.07,R.doorWidth+.12,x,R.floor+R.doorHeight+.035,doorZ,materials.woodWarm);
    for(const side of [-1,1])box('West upper door lining',.22,R.doorHeight,.06,x,R.floor+R.doorHeight/2,doorZ+side*(R.doorWidth/2+.03),materials.woodWarm);
  };
  partition(R.northPartition,R.west,R.east,-3);
  partition(R.storagePartition,R.west,R.east,-2.1);
  // The short longitudinal wall separates the west-side cell from the 21 m² store.
  const doorX=-5.4;
  for(const [a,b] of [[R.northPartition,doorX-R.doorWidth/2],[doorX+R.doorWidth/2,R.storagePartition]])
    box('West upper store longitudinal partition',b-a,H,.14,(a+b)/2,R.floor+H/2,R.innerPartition);
  box('West upper store inner door head',R.doorWidth,H-R.doorHeight,.14,doorX,R.floor+(H+R.doorHeight)/2,R.innerPartition);
  for(const side of [-1,1])box('West upper inner door lining',.06,R.doorHeight,.22,doorX+side*(R.doorWidth/2+.03),R.floor+R.doorHeight/2,R.innerPartition,materials.woodWarm);
  box('West upper inner door timber head',R.doorWidth+.12,.07,.22,doorX,R.floor+R.doorHeight+.035,R.innerPartition,materials.woodWarm);
  // Y1.003's 78 m² store contains two small perimeter blocks. Keep them low
  // and against the west wall so the central aisle remains a usable route.
  for(const x of [-3.75,2.4]) {
    box('West upper plan storage bench',2.25,.95,.58,x,R.floor+.475,R.west+.34,materials.woodDark);
    box('West upper plan storage bench top',2.4,.08,.68,x,R.floor+.99,R.west+.34,materials.woodWarm);
    box('West upper plan storage bench shelf',2.08,.06,.5,x,R.floor+.42,R.west+.34,materials.woodWarm);
  }
  const light=new THREE.PointLight(materials.parchment.color,40,18,2);light.position.set(1,R.ceiling-.35,-4.5);root.add(light);
  return root;
}
