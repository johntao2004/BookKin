import * as THREE from 'three';
import {addLongRoomFloorOcclusion} from './longRoomFloorOcclusion';
import {LONG_ROOM as L} from '../longRoomLayout';

it('darkens only ground contacts, leaves open aisle and upper furniture clear, and preserves wood UVs',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();
 const floor=new THREE.Mesh(new THREE.BoxGeometry(L.width,0.18,L.length),material);floor.name='Continuous Long Room timber floor';floor.position.y=-0.09;root.add(floor);
 const originalUV=Array.from(floor.geometry.getAttribute('uv').array);
 for(const [x,y] of [[8,2],[-8,8]]) {
  const casework=new THREE.Mesh(new THREE.BoxGeometry(2,4,0.5),material);casework.position.set(x,y,0);root.add(casework);
 }
 addLongRoomFloorOcclusion(root);
 const map=floor.material.aoMap as THREE.DataTexture;
 const sample=(x:number,z:number)=>map.image.data![Math.floor((z/L.length+0.5)*map.image.height)*map.image.width+Math.floor((x/L.width+0.5)*map.image.width)];
 expect(sample(8,0)).toBeLessThan(120);expect(sample(8,0.45)).toBeLessThan(240);
 expect(sample(8,1)).toBe(255);expect(sample(0,0)).toBe(255);expect(sample(-8,0)).toBe(255);
 expect(material.aoMap).toBeNull();expect(floor.material).not.toBe(material);
 expect(map.channel).toBe(1);expect(Array.from(floor.geometry.getAttribute('uv').array)).toEqual(originalUV);
 expect(floor.geometry.getAttribute('uv1').count).toBe(floor.geometry.getAttribute('position').count);
});
