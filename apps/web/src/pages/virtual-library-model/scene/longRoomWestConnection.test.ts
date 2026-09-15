import * as THREE from 'three';
import { expect,it } from 'vitest';
import { createLibraryMaterials } from './materials';
import { createWestConnectionStudy } from './longRoomWestConnection';
import { collectCameraColliders,resolveCameraCollision } from '../../virtual-library-collision';
import { WEST_STAIR_WALK_LENGTH,westStairWalkPoint,HENRY_JONES_WALK_LENGTH,henryJonesWalkPoint } from './longRoomWestWalk';

it('aligns the upper stair threshold to hall floor zero with an open supported connection',()=>{
  const texture=new THREE.Texture();
  const root=createWestConnectionStudy(createLibraryMaterials(texture,false,'historic-oak'));
  root.updateMatrixWorld(true);
  // Both adjoining rooms terminate below the same surveyed second-floor level.
  const stairCeiling=new THREE.Box3().setFromObject(root.getObjectByName('West study ceiling')!);
  const roomCeiling=new THREE.Box3().setFromObject(root.getObjectByName('Henry Jones plaster ceiling')!);
  expect(stairCeiling.min.y).toBeCloseTo(5.05,4);
  expect(roomCeiling.min.y).toBeCloseTo(stairCeiling.min.y,4);
  const surfaces=[root.getObjectByName('West stair walking surfaces')!,root.getObjectByName('West connection walking surfaces')!];
  const ray=new THREE.Raycaster();
  for(let z=-47;z<=-43.5;z+=0.025) {
    ray.set(new THREE.Vector3(0,0.4,z),new THREE.Vector3(0,-1,0));
    const hits=ray.intersectObjects(surfaces,true);
    expect(hits.length,`missing floor at ${z}`).toBeGreaterThan(0);
    expect(hits[0].point.y,`uneven threshold at ${z}`).toBeCloseTo(0,4);
  }
  ray.set(new THREE.Vector3(0,1.65,-43.5),new THREE.Vector3(0,0,-1)); ray.far=3;
  expect(ray.intersectObject(root,true),'door leaves or wall block the joining passage').toHaveLength(0);
  const colliders=collectCameraColliders(root,'hall');
  const resolved=resolveCameraCollision({x:0,y:1.65,z:-43.5},{x:0,y:1.65,z:-46.5},colliders);
  expect(resolved.blocked).toBe(false);
  const side=resolveCameraCollision({x:0,y:1.65,z:-45.6},{x:1,y:1.65,z:-45.6},colliders);
  expect(side.blocked).toBe(true);
  ray.far=Infinity;
  for(const reverse of [false,true]) {
    let previous:THREE.Vector3|null=null;
    for(let distance=0;distance<=WEST_STAIR_WALK_LENGTH;distance+=0.05) {
      const point=westStairWalkPoint(reverse?WEST_STAIR_WALK_LENGTH-distance:distance);
      ray.set(new THREE.Vector3(point.x,point.y+0.25,point.z),new THREE.Vector3(0,-1,0));
      const support=ray.intersectObjects(surfaces,true)[0];
      expect(support,`unsupported stair route ${distance}`).toBeDefined();
      expect(Math.abs(support.point.y-point.y)).toBeLessThan(0.18);
      const eye=new THREE.Vector3(point.x,point.y+1.65,point.z);
      const safe=resolveCameraCollision(previous??eye,eye,colliders);
      expect(Math.hypot(safe.x-eye.x,safe.y-eye.y,safe.z-eye.z),`blocked route ${distance}: ${safe.blockedBy}`).toBeLessThan(0.01);
      previous=eye;
    }
  }
  const room=root.getObjectByName('Henry Jones Room south of west landing')!;
  expect(room.userData.sourceAreaM2).toBe(49);
  for(const reverse of [false,true]) {
    let previous:THREE.Vector3|null=null;
    for(let d=0;d<=HENRY_JONES_WALK_LENGTH;d+=0.04) {
      const p=henryJonesWalkPoint(reverse?HENRY_JONES_WALK_LENGTH-d:d);
      ray.set(new THREE.Vector3(p.x,p.y+0.2,p.z),new THREE.Vector3(0,-1,0));
      const support=ray.intersectObjects([...surfaces,room],true)[0];
      expect(support,`unsupported Henry Jones route ${d}`).toBeDefined();
      expect(support.point.y).toBeCloseTo(0,4);
      const eye=new THREE.Vector3(p.x,1.65,p.z);
      const safe=resolveCameraCollision(previous??eye,eye,colliders);
      expect(Math.hypot(safe.x-eye.x,safe.y-eye.y,safe.z-eye.z),`blocked Henry Jones route ${d}: ${safe.blockedBy}`).toBeLessThan(0.01);
      previous=eye;
    }
  }
  for(const height of [0.2,1.65,2.1]) {
    ray.set(new THREE.Vector3(0,height,-47.28),new THREE.Vector3(1,0,0));ray.far=2.3;
    expect(ray.intersectObject(root,true),`visible joinery blocks Henry Jones doorway at ${height}`).toHaveLength(0);
  }
  ray.far=Infinity;
  const well=resolveCameraCollision({x:0,y:0.6,z:-49.5},{x:-1.4,y:0.6,z:-49.5},colliders);
  expect(well.blocked).toBe(true);
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(object=>{if(object instanceof THREE.Mesh) {
    geometries.add(object.geometry); for(const material of Array.isArray(object.material)?object.material:[object.material]) materials.add(material);
  }});
  for(const geometry of geometries) geometry.dispose();
  for(const material of materials) material.dispose();
  texture.dispose();
});
