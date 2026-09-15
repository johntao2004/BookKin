import * as THREE from 'three';
import {expect,it} from 'vitest';
import {collectCameraColliders,resolveCameraCollision} from '../../virtual-library-collision';
import {createLibraryMaterials} from './materials';
import {createHenryJonesRoom,HENRY_JONES} from './longRoomHenryJones';
import {WEST_LEVELS} from './longRoomWestLevels';

it('places the two public Henry Jones memorial plaques above the doorway without blocking entry',()=>{
  const root=createHenryJonesRoom(createLibraryMaterials(new THREE.Texture(),false,'historic-oak'),{includeNorthWall:true}); root.updateMatrixWorld(true);
  const display=root.getObjectByName('Henry Jones paired memorial plaques above doorway');
  expect(display).toBeDefined();
  expect(root.getObjectByName('Henry Jones north wall doorway head')).toBeDefined();
  expect(display?.userData.inscriptionStatus).toContain('short public transcription');
  const modern=root.getObjectByName('Henry Jones modern memorial plaque brass plate')!;
  const older=root.getObjectByName('Henry Jones older memorial plaque brass plate')!;
  const modernBounds=new THREE.Box3().setFromObject(modern),olderBounds=new THREE.Box3().setFromObject(older);
  expect(modernBounds.min.y).toBeGreaterThan(WEST_LEVELS.landing+2.35);
  expect(olderBounds.max.y).toBeLessThan(WEST_LEVELS.ceiling);
  expect(olderBounds.min.y).toBeGreaterThan(modernBounds.max.y);
  const colliders=collectCameraColliders(root,'hall');
  const safe=resolveCameraCollision({x:3.5,y:WEST_LEVELS.landing+1.65,z:HENRY_JONES.doorZ},{x:4.2,y:WEST_LEVELS.landing+1.65,z:HENRY_JONES.doorZ},colliders);
  expect(safe.blocked).toBe(false);
  const ray=new THREE.Raycaster();
  ray.set(new THREE.Vector3(4.4,WEST_LEVELS.landing+1.2,HENRY_JONES.doorZ),new THREE.Vector3(-1,0,0)); ray.far=2;
  expect(ray.intersectObject(root,true),'north wall doorway should remain a clear walking opening').toHaveLength(0);
  ray.set(new THREE.Vector3(4.4,WEST_LEVELS.landing+3.1,HENRY_JONES.doorZ),new THREE.Vector3(-1,0,0)); ray.far=2;
  expect(ray.intersectObject(root,true),'north wall head should close the space above the door').not.toHaveLength(0);
  // jsdom intentionally has no Canvas 2D implementation; the browser adds
  // the readable texture while the structural plaque remains testable here.
  expect(modern.parent?.name).toBe('Henry Jones modern memorial plaque');
});
