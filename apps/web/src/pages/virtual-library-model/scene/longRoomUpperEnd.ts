import * as THREE from 'three';
import {LONG_ROOM as L} from '../longRoomLayout';
import {EAST_UPPER_ROOM as U} from './longRoomEastUpperRoom';
import type {LibraryMaterials} from './materials';
import {alignLongRoomBoardGrain} from './longRoomTimber';
import {mapWestPanelGrain} from './longRoomWestOak';

/** XS-6A/6B: paired upper niches, four central panel fields and west pediment.
 * Metre dimensions adapt the surveyed composition to the enlarged hall. */
export const UPPER_END = {nicheX:3.25,radius:.95,base:L.galleryY+.2,spring:L.vaultSpring-1.65,
  top:L.vaultSpring-.12,panelSplit:L.vaultSpring-1.42} as const;

export function addUpperEndJoinery(parent:THREE.Group,outline:THREE.Shape,materials:LibraryMaterials,east:boolean,openWestUpper=false) {
  const root=new THREE.Group();root.name=`${east?'East':'West'} surveyed upper end joinery`;parent.add(root);
  root.userData.fidelity='XS-6A/6B composition; adapted dimensions; statues omitted by request';
  const S=UPPER_END;
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material=materials.woodWarm)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);
    alignLongRoomBoardGrain(mesh);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const roundArch=(x:number,radius:number,base:number)=>{
    const path=new THREE.Shape();path.moveTo(x-radius,base);path.lineTo(x+radius,base);
    path.lineTo(x+radius,S.spring);path.absarc(x,S.spring,radius,0,Math.PI,false);path.closePath();return path;
  };
  const inset=materials.woodDark.clone();inset.side=THREE.DoubleSide;
  for(const x of [-S.nicheX,S.nicheX]) {
    const shape=roundArch(x,S.radius,S.base);outline.holes.push(new THREE.Path(shape.getPoints(48)));
    const back=new THREE.Mesh(new THREE.ShapeGeometry(shape),inset);back.name='Upper recessed arched niche backing';
    mapWestPanelGrain(back.geometry,0,false);back.position.z=.32;back.castShadow=back.receiveShadow=true;root.add(back);
    for(const side of [-1,1]) {
      box('Upper niche recessed reveal',.07,S.spring-S.base,.34,x+side*(S.radius-.035),(S.base+S.spring)/2,.16,materials.woodDark);
      box('Upper niche front jamb',.085,S.spring-S.base,.12,x+side*(S.radius+.045),(S.base+S.spring)/2,-.07);
    }
    const arch=roundArch(x,S.radius+.08,S.spring);arch.holes.push(roundArch(x,S.radius,S.spring));
    const hood=new THREE.Mesh(new THREE.ExtrudeGeometry(arch,{depth:.36,bevelEnabled:false,curveSegments:48}),materials.woodWarm);
    hood.name='Upper niche arched reveal';hood.position.z=-.04;hood.castShadow=hood.receiveShadow=true;root.add(hood);
    const curve=new THREE.EllipseCurve(x,S.spring,S.radius+.085,S.radius+.085,0,Math.PI,false,0);
    const bead=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve.getPoints(48).map(p=>new THREE.Vector3(p.x,p.y,-.08))),48,.032,12,false),materials.woodWarm);
    bead.name='Upper niche curved architrave';bead.castShadow=bead.receiveShadow=true;root.add(bead);
    box('Upper niche impost',2.13,.08,.19,x,S.spring,-.065);
    box('Upper niche continuous sill',2.12,.12,.52,x,S.base,.09);
    // Panels above the niche have a concave lower edge following the arch.
    const panel=new THREE.Shape();const r=S.radius+.14;
    panel.moveTo(x-r,S.top);panel.lineTo(x+r,S.top);panel.lineTo(x+r,S.spring);
    panel.absarc(x,S.spring,r,0,Math.PI,false);panel.lineTo(x-r,S.top);panel.closePath();
    const field=new THREE.Mesh(new THREE.ShapeGeometry(panel),materials.woodDark);field.name='Upper arch-shaped overpanel';
    field.position.z=-.015;mapWestPanelGrain(field.geometry,0,false);field.receiveShadow=true;root.add(field);
    const perimeter=new THREE.CurvePath<THREE.Vector3>();
    const corners=panel.getPoints(64).map(p=>new THREE.Vector3(p.x,p.y,-.065));
    for(let i=1;i<corners.length;i++)perimeter.add(new THREE.LineCurve3(corners[i-1],corners[i]));
    const edge=new THREE.Mesh(new THREE.TubeGeometry(perimeter,160,.022,8,true),materials.woodWarm);
    edge.name='Upper overpanel curved perimeter';edge.castShadow=edge.receiveShadow=true;root.add(edge);
  }
  for(const x of [-1.725,-.575,.575,1.725]) {
    const width=1.06,height=S.top-S.panelSplit;
    box('Upper rectangular panel field',width,height,.035,x,(S.top+S.panelSplit)/2,-.025,materials.woodDark);
    for(const side of [-1,1]) {
      box('Upper panel upright moulding',.045,height,.09,x+side*width/2,(S.top+S.panelSplit)/2,-.07);
      box('Upper panel horizontal moulding',width,.045,.09,x,(S.top+S.panelSplit)/2+side*height/2,-.07);
    }
  }
  for(const side of [-1,1])box('Upper end boundary stile',.14,L.vaultSpring-L.galleryY,.14,side*4.48,(L.vaultSpring+L.galleryY)/2,-.07);
  box('Upper end continuous head',9.1,.09,.16,0,L.vaultSpring-.045,-.08);
  const doorTop=east?U.floor+U.door.height:L.galleryY+2.7;
  for(const x of [-2.28,-1.14,0,1.14,2.28]) {
    const bottom=Math.abs(x)<1?doorTop+.1:L.galleryY+.16;
    box('Upper long panel stile',.05,S.panelSplit-bottom,.1,x,(S.panelSplit+bottom)/2,-.07);
  }
  const doorBase=east?U.floor:L.galleryY,doorWidth=east?U.door.width:1.8;
  for(const side of [-1,1])box('Upper doorway architrave jamb',.11,doorTop-doorBase,.18,side*(doorWidth/2+.065),(doorBase+doorTop)/2,-.08);
  box('Upper doorway architrave head',doorWidth+.24,.12,.2,0,doorTop+.06,-.08);
  if(!east) {
    const opened=openWestUpper;
    const leaf=opened?new THREE.Group():null;
    if(leaf) {
      leaf.name='West upper open doorway leaf';
      leaf.position.set(doorWidth/2,0,-.04); leaf.rotation.y=-1.12; root.add(leaf);
    }
    const doorBox=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material)=>{
      if(!leaf)return box(name,w,h,d,x,y,z,material);
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x-doorWidth/2,y,z);mesh.castShadow=mesh.receiveShadow=true;leaf.add(mesh);return mesh;
    };
    if(!opened)doorBox('West upper closed door',doorWidth,doorTop-doorBase,.07,0,(doorBase+doorTop)/2,-.04,materials.woodDark);
    for(const x of [-.45,.45])for(let row=0;row<4;row++) {
      const y=doorBase+.34+row*.65;
      doorBox('West upper door inset field',.68,.48,.025,x,y,-.09,materials.wood);
      for(const side of [-1,1]) {
        doorBox('West upper door panel bead',.025,.48,.035,x+side*.34,y,-.115,materials.woodWarm);
        doorBox('West upper door panel bead',.68,.025,.035,x,y+side*.24,-.115,materials.woodWarm);
      }
    }
    const base=doorTop+.2,peak=base+.72,half=1.36;
    const triangle=new THREE.Shape();triangle.moveTo(-half,base);triangle.lineTo(0,peak);triangle.lineTo(half,base);triangle.closePath();
    const field=new THREE.Mesh(new THREE.ExtrudeGeometry(triangle,{depth:.08,bevelEnabled:false}),materials.woodDark);
    field.name='West upper triangular pediment';field.position.z=-.14;mapWestPanelGrain(field.geometry,0,false);field.castShadow=field.receiveShadow=true;root.add(field);
    box('West upper pediment base',half*2+.18,.13,.28,0,base,-.14);
    for(const side of [-1,1]) {
      const rake=box('West upper pediment rake',Math.hypot(half,peak-base),.1,.25,side*half/2,(base+peak)/2,-.15);
      rake.rotation.z=Math.atan2(base-peak,side*half);
    }
  }
}
