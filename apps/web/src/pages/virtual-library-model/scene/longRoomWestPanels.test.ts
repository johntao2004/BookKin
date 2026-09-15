import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createWestStairPanel } from './longRoomWestPanels';

it('keeps the wall field open and gives the long frame edges real relief',()=>{
  const material=new THREE.MeshStandardMaterial();
  const panel=createWestStairPanel(2.3,2.7,material);
  panel.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  const hits=(x:number,y:number)=>{
    ray.set(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));
    return ray.intersectObject(panel,true);
  };
  expect(hits(0,0)).toHaveLength(0);
  for(const x of [-1.12,1.12]) for(const y of [-1,-0.5,0,0.5,1]) {
    const edge=hits(x,y);
    expect(edge.length).toBeGreaterThan(0);
    expect(edge[0].point.z).toBeGreaterThan(0.03);
  }
  const geometries=new Set<THREE.BufferGeometry>();
  panel.traverse(object=>{if(object instanceof THREE.Mesh) geometries.add(object.geometry);});
  for(const geometry of geometries) {
    expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    geometry.dispose();
  }
  material.dispose();
});
