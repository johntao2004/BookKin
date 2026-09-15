import * as THREE from 'three';
import { PALETTE } from '../config';
import { markCameraCollider } from '../../virtual-library-collision';

/** Three columns and five rows follow the 2019 survey, G_E-1 (PDF page 15).
 * Opening sizes and offsets remain adaptations to the current enclosure. */
export const WEST_HIGH_WINDOW={center:0,base:6.3,width:1.55,height:3.25} as const;
export const WEST_HIGH_WINDOWS = [-2.55, 0.85].map(center => ({...WEST_HIGH_WINDOW, center}));
export const WEST_LOWER_WINDOW = {center:0.85,base:3.25,width:1.55,height:1.05} as const;
export function createWestHighWindow(timber:THREE.Material,plaster:THREE.Material, opening: {center:number;base:number;width:number;height:number} = WEST_HIGH_WINDOW, id = 'west-high-window-glazing', columns = 3, rows = 5) {
  const root=new THREE.Group();root.name='West pavilion estimated high sash window';
  const {width,height,base,center}=opening;
  root.position.set(center,base,0);root.userData.fidelity='survey-pane-grid; adapted-opening-dimensions-and-sash-profiles';
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  for(const side of [-1,1]) {
    box('High window plaster reveal',0.075,height,0.34,side*(width/2-0.0375),height/2,0,plaster);
    box('High window outer jamb',0.1,height+0.14,0.12,side*(width/2+0.055),height/2,0.19,timber);
  }
  box('High window projecting sill',width+0.25,0.1,0.42,0,-0.045,0.045,timber);
  box('High window head',width+0.21,0.1,0.18,0,height+0.045,0.16,timber);
  // Separate sliding leaves: the upper sash sits farther into the reveal.
  // Five-row western windows split 2/3; six-row eastern windows split 3/3.
  const splitRow=Math.floor(rows/2), clearHeight=height-0.14;
  const meetingY=0.07+splitRow*clearHeight/rows;
  const profile=(name:string,w:number,h:number,x:number,y:number,z:number)=>{
    const shape=new THREE.Shape();
    shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);
    shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:0.035,bevelEnabled:true,
      bevelThickness:0.004,bevelSize:0.004,bevelSegments:2,steps:1,curveSegments:1});
    geometry.translate(0,0,-0.0175);
    const mesh=new THREE.Mesh(geometry,timber);mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  };
  for(const [start,end,z] of [[0,splitRow,-0.015],[splitRow,rows,-0.07]]) {
    const leafBase=0.07+start*clearHeight/rows,leafTop=0.07+end*clearHeight/rows;
    for(const side of [-1,1])profile('Profiled sash leaf stile',0.055,leafTop-leafBase,
      side*(width/2-0.105),(leafBase+leafTop)/2,z);
    for(let row=start;row<=end;row++)profile(row===splitRow?'Overlapping sash meeting rail':'High window sash rail',
      width-0.14,row===splitRow?0.065:0.032,0,0.07+row*clearHeight/rows,z);
    for(let column=1;column<columns;column++)profile('High window glazing bar',0.025,leafTop-leafBase,
      -width/2+0.07+column*(width-0.14)/columns,(leafBase+leafTop)/2,z);
  }
  root.userData.sashMeetingHeight=meetingY;
  const sky=new THREE.Color(PALETTE.parchment).lerp(new THREE.Color(PALETTE.glassBlue),0.22);
  const pane=box('High window diffused exterior daylight',width-0.15,height-0.14,0.01,0,height/2,-0.115,
    new THREE.MeshBasicMaterial({color:sky}));
  pane.castShadow=pane.receiveShadow=false;
  markCameraCollider(root,{id,shape:'box',
    center:{x:0,y:height/2,z:-0.1},size:{x:width,y:height,z:0.04}});
  return root;
}
