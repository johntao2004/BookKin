import {createEastServiceCore} from './longRoomEastServiceCore';
import {createEastUpperRoom} from './longRoomEastUpperRoom';
import {createEastStairEnclosure} from './longRoomEastEnclosure';
import { PALETTE } from '../config';
import * as THREE from 'three';
import type { LibraryMaterials } from './materials';
import { markCameraCollider } from '../../virtual-library-collision';
import { createWestHighWindow } from './longRoomWestWindow';
import { WEST_LEVELS } from './longRoomWestLevels';

/** Y1.002: south-side Fagel room, 55 m², two transverse fittings and central openings.
 * Envelope, fitting sizes and anonymous volumes remain adapted estimates. Coordinates
 * are relative to the east portal, with positive x south and positive z east. */
export const FAGEL = {north:2,south:9.33,west:0.5,east:8.5,doorZ:4.5,doorWidth:1.4,
  height:WEST_LEVELS.ceiling-WEST_LEVELS.landing,sourceArea:55} as const;

export function createFagelRoom(materials:LibraryMaterials) {
  const root=new THREE.Group();root.name='East pavilion Fagel room and circulation';
  root.userData.fidelity='Y1.002 plan topology; adapted envelope and fittings';root.userData.sourceAreaM2=55;
  const H=FAGEL.height, plaster=materials.parchment.clone();
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material,collision=false)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    if(collision)markCameraCollider(mesh,{id:`fagel-${name}-${x}-${y}-${z}`,shape:'box',center:{x:0,y:0,z:0},size:{x:w,y:h,z:d}});
    return mesh;
  };
  box('Fagel room floor',7.33,0.18,8,5.665,-0.09,4.5,materials.floor);
  box('East circulation floor',4.24,0.18,8.5,0,-0.09,4.25,materials.floor);
  box('Fagel room ceiling',7.57,0.18,8.24,5.665,H+0.09,4.5,plaster);
  box('East circulation ceiling',4.24,0.18,8.42,0,H+0.09,4.29,plaster);
  const northWall=new THREE.Group();northWall.name='East circulation north wall';root.add(northWall);
  for(const [a,b] of [[0.08,6.55],[8.25,8.5]])northWall.add(box('East upper stair threshold pier',0.24,H,b-a,-2.12,H/2,(a+b)/2,plaster,true));
  northWall.add(box('East upper stair threshold head',0.24,H-2.35,1.7,-2.12,(H+2.35)/2,7.4,plaster,true));
  root.add(createEastStairEnclosure(materials,false));
  root.add(createEastUpperRoom(materials));
  root.add(createEastServiceCore(materials));
  box('Fagel west wall',7.33,H,0.24,5.665,H/2,0.5,plaster,true);
  const windowWall=(name:string,length:number,centers:number[],x:number,z:number,angle:number)=>{
    const wall=new THREE.Group();wall.name=name;wall.position.set(x,0,z);wall.rotation.y=angle;root.add(wall);
    const edges=[-length/2,...centers.flatMap(c=>[c-0.775,c+0.775]),length/2];
    for(let i=0;i<edges.length-1;i++)for(const [low,high] of i%2?[[0,0.85],[3.95,H]]:[[0,H]]) {
      const mesh=box(name+' pier',edges[i+1]-edges[i],high-low,0.24,(edges[i]+edges[i+1])/2,(low+high)/2,0,plaster,true);
      wall.add(mesh);
    }
    for(const [index,center] of centers.entries()) wall.add(createWestHighWindow(materials.woodWarm,plaster,
      {center,base:0.85,width:1.55,height:3.1},`fagel-${name}-window-${index}`,3,6));
  };
  windowWall('Fagel south wall',8,[-2.5,0,2.5],9.33,4.5,-Math.PI/2);
  windowWall('Fagel east wall',7.33,[-1.8,1.8],5.665,8.5,Math.PI);
  windowWall('East circulation end wall',4.24,[0],0,8.5,Math.PI);
  // The survey shows transverse fittings with central gaps, not a single side shelf.
  const bookMatrices:THREE.Matrix4[]=[];
  for(const x of [2,5.665])for(const side of [-1,1]) {
    const length=3.05,z=4.5+side*2.225;
    box('Fagel partition bookcase backing',0.08,4.35,length,x+0.5,2.175,z,materials.woodDark);
    markCameraCollider(root,{id:`fagel-partition-${x}-${side}`,shape:'box',
      center:{x:x+0.25,y:2.175,z},size:{x:0.68,y:4.35,z:length+0.1}});
    for(const end of [-1,1])box('Fagel partition case stile',0.58,4.35,0.1,x+0.25,2.175,z+end*length/2,materials.woodWarm);
    for(let row=0;row<10;row++) {
      const y=0.13+row*0.43;
      box('Fagel partition shelf',0.58,0.06,length,x+0.25,y,z,materials.woodWarm);
      for(let i=0;i<25;i++)bookMatrices.push(new THREE.Matrix4().makeTranslation(x+0.25,y+0.19,z-length/2+0.12+i*0.117));
    }
    const wires:number[]=[];
    for(let y=0.12;y<4.31;y+=0.1)wires.push(x-0.065,y,z-length/2,x-0.065,y,z+length/2);
    for(let u=-length/2;u<=length/2;u+=0.1)wires.push(x-0.065,0.12,z+u,x-0.065,4.3,z+u);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(wires,3));
    const screen=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:PALETTE.stoneDark}));screen.name='Fagel protective case screen';root.add(screen);
  }
  const books=new THREE.InstancedMesh(new THREE.BoxGeometry(0.32,0.31,0.09),new THREE.MeshStandardMaterial({roughness:0.92}),bookMatrices.length);
  books.name='Fagel anonymous historical volumes';books.userData.interactive=false;
  bookMatrices.forEach((matrix,index)=>{books.setMatrixAt(index,matrix);
    books.setColorAt(index,new THREE.Color([PALETTE.oakWarm,PALETTE.oxblood,PALETTE.green,PALETTE.parchment][index%4]));});books.computeBoundingBox();books.computeBoundingSphere();root.add(books);
  const light=new THREE.PointLight(materials.parchment.color,55,15,2);light.position.set(4.8,4.2,4.5);root.add(light);
  return root;
}
