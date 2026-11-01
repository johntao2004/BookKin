import * as THREE from 'three';
import {V12_COLUMN_COLOR,V12_STONE_COLOR,V12_JOINERY_COLOR} from './design-v12.js';

/** One lacquer and one circular column-base profile for the common frame.
 * The map is neutral, so indoor/outdoor pigments do not acquire two tints. */
export function palaceColumnMaterialV12(){
  let map=null;
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=512;
    const c=canvas.getContext('2d');c.fillStyle='#f5f5f5';c.fillRect(0,0,128,512);
    for(let i=0;i<180;i++){
      c.strokeStyle=`rgba(34,34,34,${.008+(i%7)*.003})`;c.lineWidth=.5;
      const x=(i*17.381)%128;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+1,130,x-1,350,x,512);c.stroke();
    }
    map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  }
  const m=new THREE.MeshStandardMaterial({color:V12_COLUMN_COLOR,map,roughness:.53});
  m.name='Unified_Vermilion_Round_Column';m.userData.columnFinish='common-vermilion-lacquer-v12';return m;
}

export function palaceStoneMaterialV12(){
  const m=new THREE.MeshStandardMaterial({color:V12_STONE_COLOR,roughness:.94});
  m.name='Unified_Pale_Circular_Column_Base';return m;
}

/** Full closed low drum: .64 m maximum radius, .30 m height. Scale radius only. */
export function palaceColumnBaseGeometryV12(){
  const profile=[[0,0],[.64,0],[.64,.07],[.625,.10],[.59,.14],[.55,.21],[.52,.28],[.50,.30],[0,.30]];
  const g=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),36);
  g.name='V12_Common_Low_Drum_Column_Base';g.userData={columnBaseFamily:'closed-profiled-low-drum',nominalRadius:.64,nominalHeight:.30};return g;
}

export function palaceJoineryMaterialV12(){
  const m=new THREE.MeshStandardMaterial({color:V12_JOINERY_COLOR,roughness:.64});
  m.name='Traditional_Warm_Hardwood_Joinery';m.userData.joineryFamily='ruyi-openwork-hardwood-v12';return m;
}

/** A carved panel with true pierced openings, not a painted opaque fence. */
const panelCache=new Map();
export function palacePiercedPanelV12(width,height=.46,depth=.07){
  const key=[width,height,depth].map(n=>n.toFixed(5)).join('/');if(panelCache.has(key))return panelCache.get(key);
  const s=new THREE.Shape(),w=width/2,h=height/2,margin=Math.min(.065,width*.13);
  s.moveTo(-w,-h);s.lineTo(w,-h);s.lineTo(w,h);s.lineTo(-w,h);s.closePath();
  const hole=new THREE.Path(),a=w-margin,b=h-margin,r=Math.min(.07,a*.28,b*.45);
  // A linked-cloud opening has a stepped central shoulder and soft corners.
  hole.moveTo(-a+r,-b);hole.lineTo(a-r,-b);hole.quadraticCurveTo(a,-b,a,-b+r);
  hole.lineTo(a,-.065);hole.lineTo(a-.055,-.065);hole.lineTo(a-.055,.065);hole.lineTo(a,.065);
  hole.lineTo(a,b-r);hole.quadraticCurveTo(a,b,a-r,b);hole.lineTo(-a+r,b);hole.quadraticCurveTo(-a,b,-a,b-r);
  hole.lineTo(-a,.065);hole.lineTo(-a+.055,.065);hole.lineTo(-a+.055,-.065);hole.lineTo(-a,-.065);
  hole.lineTo(-a,-b+r);hole.quadraticCurveTo(-a,-b,-a+r,-b);hole.closePath();s.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.007,bevelThickness:.006,bevelSegments:1,curveSegments:6});g.translate(0,0,-depth/2);
  g.name='V12_Cloud_Pierced_Hardwood_Panel';g.userData.actualPiercedOpenings=1;panelCache.set(key,g);return g;
}
