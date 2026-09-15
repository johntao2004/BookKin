import * as THREE from 'three';
import {createEastServiceStair,EAST_SERVICE_STAIR} from './longRoomEastServiceStair';
import {createLibraryMaterials} from './materials';
import {collectCameraColliders,resolveCameraCollision} from '../../virtual-library-collision';

it('supports the full multi-storey winder route with standing headroom and side guards',()=>{
  const root=createEastServiceStair(createLibraryMaterials(new THREE.Texture(),false,'historic-oak'));
  root.updateMatrixWorld(true);
  const floor=root.getObjectByName('Service stair walking surfaces')!;
  const colliders=collectCameraColliders(root,'hall');
  const points=root.userData.walkingSamples as {x:number;y:number;z:number}[];
  const ray=new THREE.Raycaster();
  for(const reverse of [false,true]) {
    let previous:THREE.Vector3|null=null;
    for(const p of reverse?[...points].reverse():points) {
      ray.set(new THREE.Vector3(p.x,p.y+0.1,p.z),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(floor,true)[0];
      expect(hit,`floor ${JSON.stringify(p)}`).toBeDefined();
      expect(Math.abs(hit.point.y-p.y)).toBeLessThan(0.02);
      ray.set(new THREE.Vector3(p.x,p.y+0.1,p.z),new THREE.Vector3(0,1,0));
      const overhead=ray.intersectObject(floor,true)[0];
      if(overhead)expect(overhead.point.y-p.y).toBeGreaterThan(2);
      const eye=new THREE.Vector3(p.x,p.y+1.65,p.z);
      const result=resolveCameraCollision(previous??eye,eye,colliders);
      expect(result.blocked,`guard ${JSON.stringify(p)} ${result.blockedBy}`).toBe(false);
      previous=eye;
    }
  }
  expect(points.at(-1)?.y).toBe(EAST_SERVICE_STAIR.levels.at(-1));
  const p=points[2];
  expect(resolveCameraCollision({x:p.x,y:p.y+1.65,z:p.z},{x:p.x,y:p.y+1.65,z:p.z-1},colliders).blocked).toBe(true);
});
