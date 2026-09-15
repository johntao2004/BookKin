import * as THREE from 'three';
import {createLibraryMaterials} from './materials';
import {mapWestPanelGrain} from './longRoomWestOak';

it('shares small PBR maps within a hall while keeping separate builds independently disposable',()=>{
 const external=new THREE.Texture(),dispose=vi.spyOn(external,'dispose');
 const first=createLibraryMaterials(external,false,'historic-oak'),second=createLibraryMaterials(undefined,false,'historic-oak');
 expect(dispose).not.toHaveBeenCalled();
 for(const m of [first.woodWarm,first.woodDark]) {
  expect(m.map).toBe(first.wood.map);expect(m.bumpMap).toBe(first.wood.bumpMap);expect(m.roughnessMap).toBe(first.wood.roughnessMap);
 }
 expect(first.wood.map).not.toBe(external);expect(first.wood.map).not.toBe(second.wood.map);
 expect(first.wood.map?.colorSpace).toBe(THREE.SRGBColorSpace);
 const rough=first.wood.roughnessMap as THREE.DataTexture;
 expect(rough.format).toBe(THREE.RGBAFormat); // Standard material reads the green channel.
 expect(rough.image.width*rough.image.height).toBeLessThan(256*256);
});

it('gives a large end panel the same physical grain scale as smaller joinery',()=>{
 const shape=new THREE.Shape();shape.moveTo(-11,0);shape.lineTo(11,0);shape.lineTo(11,18);shape.lineTo(-11,18);shape.closePath();
 const g=new THREE.ShapeGeometry(shape),before=Array.from(g.getAttribute('position').array);
 mapWestPanelGrain(g,0,false);
 const p=g.getAttribute('position'),uv=g.getAttribute('uv');
 for(let i=0;i<p.count;i++) {
  expect(uv.getX(i)).toBeCloseTo(p.getX(i)/0.6,5);expect(uv.getY(i)).toBeCloseTo(p.getY(i)/2.8,5);
 }
 expect(Array.from(p.array)).toEqual(before);
});
