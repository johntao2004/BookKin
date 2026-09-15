import * as THREE from 'three';
import type {LibraryMaterials} from './materials';
import {mapWestPanelGrain} from './longRoomWestOak';
import {PALETTE} from '../config';

const HENRY_MEMORIAL_SOURCE='https://www.patrickcomerford.com/2012/10/memories-of-old-bishop-and-old-book-in.html';

function createInscriptionMaterial(lines:string[], color:string, fontSize:number) {
  if(typeof document==='undefined') return null;
  const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=768;
  const context=canvas.getContext('2d'); if(!context) return null;
  context.clearRect(0,0,canvas.width,canvas.height);
  context.fillStyle=color; context.textAlign='center'; context.textBaseline='middle';
  context.font=`700 ${fontSize}px Georgia, serif`;
  const lineHeight=fontSize*1.28, start=(canvas.height-lineHeight*(lines.length-1))/2;
  lines.forEach((line,index)=>context.fillText(line,canvas.width/2,start+index*lineHeight,950));
  const map=new THREE.CanvasTexture(canvas); map.colorSpace=THREE.SRGBColorSpace; map.anisotropy=4;
  const material=new THREE.MeshStandardMaterial({map,transparent:true,alphaTest:.12,roughness:.72,metalness:.18});
  material.userData.source=HENRY_MEMORIAL_SOURCE;
  return material;
}

function createPlaqueFrame(materials:LibraryMaterials,name:string,width:number,height:number,depth:number,lines:string[],y:number,old:boolean) {
  const group=new THREE.Group(); group.name=name; group.position.set(3.55,y,4.64); group.rotation.y=Math.PI/2;
  group.userData={fidelity:'public photographed plaque proportions with adapted wall placement',source:HENRY_MEMORIAL_SOURCE,
    inscriptionStatus:old?'short historical identification; original monument wording not transcribed':'short public transcription excerpt; full plaque line breaks not reconstructed'};
  const outer=new THREE.Mesh(new THREE.BoxGeometry(width+.13,height+.13,depth+.04),materials.woodDark);
  outer.name=`${name} dark timber surround`; outer.castShadow=outer.receiveShadow=true; outer.position.z=-.035; group.add(outer);
  const brass=materials.brass.clone(); brass.color.setHex(old?PALETTE.brass:0x8a632c); brass.metalness=.76; brass.roughness=.67;
  const plate=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),brass); plate.name=`${name} brass plate`; plate.castShadow=plate.receiveShadow=true; group.add(plate);
  const topRail=new THREE.Mesh(new THREE.BoxGeometry(width+.07,.035,.045),materials.woodWarm);
  topRail.position.set(0,height/2+.028,.02); topRail.castShadow=topRail.receiveShadow=true; group.add(topRail);
  const bottomRail=topRail.clone(); bottomRail.position.y=-height/2-.028; group.add(bottomRail);
  for(const x of [-width/2-.025,width/2+.025]) {
    const stile=new THREE.Mesh(new THREE.BoxGeometry(.035,height,.045),materials.woodWarm); stile.position.set(x,0,.02); stile.castShadow=stile.receiveShadow=true; group.add(stile);
  }
  const inscription=createInscriptionMaterial(lines,old?'#4e3219':'#2b1d10',old?30:30);
  if(inscription) {
    const label=new THREE.Mesh(new THREE.PlaneGeometry(width-.12,height-.10),inscription);
    label.name=`${name} readable inscription`; label.position.z=depth/2+.006; group.add(label);
  }
  if(old) {
    for(const [x,yOffset] of [[-.38,-.34],[.38,-.34],[-.38,.34],[.38,.34]] as [number,number][]) {
      const boss=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.022,12),materials.brass);
      boss.name=`${name} corner boss`; boss.rotation.x=Math.PI/2; boss.position.set(x*width,yOffset*height,depth/2+.016); group.add(boss);
    }
  }
  return group;
}

/** Comerford DSCN9262, 18 October 2012: square brass memorial in a broad
 * mitred timber frame. Absolute dimensions, inscription and wall placement
 * remain unverified; this is intentionally an isolated component study. */
export function createHenryMemorialStudy(materials:LibraryMaterials) {
  const root=new THREE.Group();root.name='Henry Jones framed brass memorial study';
  root.userData={fidelity:'photographic frame proportions; unmeasured one-metre study',
    inscriptionStatus:'worn Latin and arms not reconstructed',placementStatus:'unverified; not in live room',
    source:'https://www.patrickcomerford.com/2012/10/memories-of-old-bishop-and-old-book-in.html'};
  // Cross-section progresses from the outer rim down the broad sloping face,
  // through the inner bead to the inset brass; adjacent sides meet at mitres.
  const rings=[[.5,.018],[.478,.028],[.465,.016],[.357,.043],[.343,.022],[.33,.017]];
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  for(let side=0;side<4;side++) {
    const positions:number[]=[],indices:number[]=[];
    const a=corners[side],b=corners[(side+1)%4];
    for(const [radius,z] of rings)positions.push(a[0]*radius,a[1]*radius,z,b[0]*radius,b[1]*radius,z);
    for(let row=0;row<rings.length-1;row++) {
      const i=row*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));
    geometry.setIndex(indices);geometry.computeVertexNormals();mapWestPanelGrain(geometry,0,false);
    // Horizontal and vertical rails each carry the long grain along their axis.
    if(side%2===0) {
      const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
      for(let i=0;i<p.count;i++)uv.setXY(i,p.getY(i)/.6,p.getX(i)/2.8);
    }
    const timber=new THREE.Mesh(geometry,materials.wood);timber.name='Mitred sloping memorial frame';timber.castShadow=timber.receiveShadow=true;root.add(timber);
  }
  const backing=new THREE.Mesh(new THREE.BoxGeometry(1,1,.035),materials.woodDark);
  backing.name='Memorial backing and outer edge';backing.position.z=-.0175;backing.castShadow=backing.receiveShadow=true;root.add(backing);
  const brass=materials.brass.clone();brass.roughness=.82;brass.metalness=.65;
  brass.color.lerp(materials.parchment.color,.3);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(.668,.668,.006),brass);
  plate.name='Inset brass memorial plate awaiting inscription';plate.position.z=.009;
  plate.castShadow=plate.receiveShadow=true;root.add(plate);
  return root;
}

/** The Henry Jones Room account describes two plaques and a modern readable
 * panel below the older monument. This installs a short, source-bounded pair
 * above the adapted west doorway; exact wall coordinates and the older Latin
 * wording remain unresolved. */
export function createHenryJonesMemorialDisplay(materials:LibraryMaterials) {
  const root=new THREE.Group(); root.name='Henry Jones paired memorial plaques above doorway';
  root.userData={fidelity:'public account and photograph; adapted live placement',source:HENRY_MEMORIAL_SOURCE,
    placement:'above the adapted west doorway, as described for the original-building door',
    inscriptionStatus:'modern plaque uses a short public transcription excerpt; older monument is identified without invented Latin'};
  root.add(createPlaqueFrame(materials,'Henry Jones older memorial plaque',1.22,.68,.035,
    ['HENRY JONES','1605 — 1682','BISHOP · VICE-CHANCELLOR'],9.42,true));
  root.add(createPlaqueFrame(materials,'Henry Jones modern memorial plaque',1.52,1.10,.032,
    ['SACRED TO THE MEMORY OF','THE REVEREND HENRY JONES','VICE-CHANCELLOR OF THIS UNIVERSITY','LIBRARY REFURBISHED · 1651','BOOK OF KELLS · BOOK OF DURROW'],8.35,false));
  return root;
}
