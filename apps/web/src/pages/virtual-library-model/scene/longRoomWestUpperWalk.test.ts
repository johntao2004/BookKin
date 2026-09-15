import {buildLongRoom} from './longRoom';
import * as THREE from 'three';
import {collectCameraColliders,resolveCameraCollision} from '../../virtual-library-collision';
import {WEST_UPPER_WALK_LENGTH,WEST_UPPER_WALK_LENGTHS,westUpperWalkPoint} from '../longRoomLayout';

it('keeps the isolated historical west upper storage route supported and collision-free in both directions',()=>{
  const built=buildLongRoom(0, new THREE.TextureLoader(), true);
  built.root.updateMatrixWorld(true);
  const colliders=collectCameraColliders(built.root,'hall');
  const supports=[...built.root.children.filter(child=>child.name==='Continuous Long Room timber floor'),
    ...built.root.children.filter(child=>child.name==='Continuous straight upper gallery'),
    built.root.getObjectByName('Gallery end crossing')!,
    built.root.getObjectByName('Long Room pierced iron alcove stair study')!,
    built.root.getObjectByName('Iron stair upper landing')!,
    built.root.getObjectByName('West upper storage rooms')!];
  for(const reverse of [false,true]) {
    let previous:ReturnType<typeof westUpperWalkPoint>|null=null;
    for(let distance=0;distance<=WEST_UPPER_WALK_LENGTH;distance+=0.2) {
      const point=westUpperWalkPoint(reverse?WEST_UPPER_WALK_LENGTH-distance:distance);
      const eye={...point,y:point.y+1.65};
      const safe=resolveCameraCollision(previous??eye,eye,colliders);
      expect(safe.blocked,`blocked west upper route ${distance} reverse=${reverse} point=${JSON.stringify(point)}: ${safe.blockedBy}`).toBe(false);
      const supportRay=new THREE.Raycaster(new THREE.Vector3(point.x,point.y+.32,point.z),new THREE.Vector3(0,-1,0),0,.6);
      expect(supportRay.intersectObjects(supports,true)[0],`unsupported west upper route ${distance} point=${JSON.stringify(point)}`).toBeDefined();
      previous=eye;
    }
  }
  expect(WEST_UPPER_WALK_LENGTHS.length).toBeGreaterThan(10);
});
