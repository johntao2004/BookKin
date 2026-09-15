import {createEastStairEnclosure} from './longRoomEastEnclosure';
import {createFagelRoom} from './longRoomFagel';
import * as THREE from 'three';
import {EAST_STAIR as S} from './longRoomEastStair';
import {createLibraryMaterials} from './materials';
import {collectCameraColliders,resolveCameraCollision} from '../../virtual-library-collision';

it('supports both flights and the curved return without cutting through the parapets',()=>{
  const materials=createLibraryMaterials(new THREE.Texture(),false,'historic-oak');
  const root=createEastStairEnclosure(materials);
  const circulation=new THREE.Mesh(new THREE.BoxGeometry(4.24,.18,8.5),materials.floor);circulation.name='East circulation floor';circulation.position.set(0,-.09,4.25);root.add(circulation);root.updateMatrixWorld(true);
  const colliders=collectCameraColliders(root,'hall');
  const points:THREE.Vector3[]=[];
  for(let i=0;i<=100;i++)points.push(new THREE.Vector3(S.southX-S.run*i/100,-S.rise+S.rise/2*i/100,S.centerZ-S.radius));
  for(let i=1;i<=100;i++)points.push(new THREE.Vector3(S.turnX-S.radius*Math.sin(i*Math.PI/100),-S.rise/2,S.centerZ-S.radius*Math.cos(i*Math.PI/100)));
  for(let i=1;i<=100;i++)points.push(new THREE.Vector3(S.turnX+S.run*i/100,-S.rise/2+S.rise/2*i/100,S.centerZ+S.radius));
  for(let i=1;i<=20;i++){points.unshift(new THREE.Vector3(S.southX+1.3*i/20,-S.rise,S.centerZ-S.radius));points.push(new THREE.Vector3(S.southX+2.5*i/20,0,S.centerZ+S.radius));}
  const surfaces=[root.getObjectByName('East stair walking surfaces')!,root.getObjectByName('East stair ground floor')!,root.getObjectByName('East circulation floor')!];
  const ray=new THREE.Raycaster();
  for(const path of [points,[...points].reverse()]) {
    let previous:THREE.Vector3|null=null;
    for(const point of path) {
      ray.set(point.clone().add(new THREE.Vector3(0,0.25,0)),new THREE.Vector3(0,-1,0));
      const floor=ray.intersectObjects(surfaces,true)[0];
      expect(floor).toBeDefined();expect(Math.abs(floor.point.y-point.y)).toBeLessThan(0.18);
      const eye=point.clone().add(new THREE.Vector3(0,1.65,0));
      expect(resolveCameraCollision(previous??eye,eye,colliders).blocked).toBe(false);previous=eye;
    }
  }
  const wall=resolveCameraCollision({x:-4,y:-2,z:S.centerZ-S.radius},{x:-4,y:-2,z:S.centerZ-S.radius+1},colliders);
  expect(wall.blocked).toBe(true);
});

it('closes the former lower stairwell at hall level in the live pavilion',()=>{
  const root=createFagelRoom(createLibraryMaterials(new THREE.Texture(),false,'historic-oak'));
  root.updateMatrixWorld(true);
  expect(root.getObjectByName('East stair walking surfaces')).toBeUndefined();
  expect(new THREE.Box3().setFromObject(root).min.y).toBeGreaterThan(-0.2);
  const ray=new THREE.Raycaster();
  for(const x of [-8,-6,-4])for(const z of [4,6,8]) {
    ray.set(new THREE.Vector3(x,0.3,z),new THREE.Vector3(0,-1,0));
    const floor=ray.intersectObject(root,true)[0];expect(floor).toBeDefined();expect(floor.point.y).toBeCloseTo(0);
  }
});
