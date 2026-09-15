import * as THREE from 'three';
import {LONG_ROOM as L} from '../longRoomLayout';

/** Contact-only ambient shading from static ground-level timber footprints.
 * This approximates occluded indirect light, not surveyed lighting or a sun shadow.
 * Local rasterization bounds the bake cost; no extra render pass or overlay mesh. */
export const FLOOR_OCCLUSION={width:256,height:1024,falloff:0.24,padding:0.65,strength:0.62} as const;
export function addLongRoomFloorOcclusion(root:THREE.Group) {
 const floor=root.getObjectByName('Continuous Long Room timber floor') as THREE.Mesh<THREE.BoxGeometry,THREE.MeshStandardMaterial>;
 const C=FLOOR_OCCLUSION,data=new Uint8Array(C.width*C.height);data.fill(255);
 root.updateMatrixWorld(true);
 const footprints:THREE.Box3[]=[];
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||!(object.geometry instanceof THREE.BoxGeometry)||object===floor)return;
  // Only static members that actually touch the main-floor datum cast contact AO.
  object.geometry.computeBoundingBox();const bounds=object.geometry.boundingBox!.clone().applyMatrix4(object.matrixWorld);
  if(Math.abs(bounds.min.y)>0.015||bounds.max.y<0.08||bounds.min.x>L.width/2||bounds.max.x<-L.width/2||bounds.min.z>L.length/2||bounds.max.z<-L.length/2)return;
  footprints.push(bounds);
 });
 const px=(x:number)=>Math.floor((x/L.width+0.5)*C.width),pz=(z:number)=>Math.floor((z/L.length+0.5)*C.height);
 for(const b of footprints) {
  const x0=Math.max(0,px(b.min.x-C.padding)),x1=Math.min(C.width-1,px(b.max.x+C.padding));
  const z0=Math.max(0,pz(b.min.z-C.padding)),z1=Math.min(C.height-1,pz(b.max.z+C.padding));
  for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++) {
   const x=((ix+0.5)/C.width-0.5)*L.width,z=((iz+0.5)/C.height-0.5)*L.length;
   const dx=Math.max(b.min.x-x,0,x-b.max.x),dz=Math.max(b.min.z-z,0,z-b.max.z);
   const shade=Math.round(255*(1-C.strength*Math.exp(-(dx*dx+dz*dz)/(C.falloff*C.falloff))));
   const index=iz*C.width+ix;data[index]=Math.min(data[index],shade);
  }
 }
 const map=new THREE.DataTexture(data,C.width,C.height,THREE.RedFormat);map.name='Main floor contact ambient occlusion';
 map.channel=1;map.minFilter=map.magFilter=THREE.LinearFilter;map.needsUpdate=true;
 const positions=floor.geometry.getAttribute('position'),uv=new Float32Array(positions.count*2);
 for(let i=0;i<positions.count;i++) {
  uv[i*2]=positions.getX(i)/L.width+0.5;uv[i*2+1]=positions.getZ(i)/L.length+0.5;
 }
 floor.geometry.setAttribute('uv1',new THREE.BufferAttribute(uv,2));
 floor.material=floor.material.clone();floor.material.name='Main timber floor with contact occlusion';floor.material.aoMap=map;floor.material.aoMapIntensity=1;
 floor.userData.contactOcclusion={footprintCount:footprints.length,width:C.width,height:C.height,estimatedFalloff:C.falloff};
}
