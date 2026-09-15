import { WEST_LEVELS } from './longRoomWestLevels';
import * as THREE from 'three';
import type { LibraryMaterials } from './materials';
import { markCameraCollider } from '../../virtual-library-collision';
import { createLongRoomSashes } from './longRoomSash';
import { PALETTE } from '../config';
import { createHenryJonesMemorialDisplay } from './longRoomHenryMemorial';

/** Y1.002 establishes the south-side room and 49 m² area. Shape/height/windows
 * below are working estimates fitted to the adapted stair, not survey dimensions. */
export const HENRY_JONES = {
  northX: 3.4, southX: 10.24, backZ: -2.05, frontZ: 5.6,
  floorY: WEST_LEVELS.landing, height: WEST_LEVELS.ceiling-WEST_LEVELS.landing, doorZ: 4.64, doorWidth: 1.04,
} as const;

export function createHenryJonesRoom(materials: LibraryMaterials, options: { includeNorthWall?: boolean } = {}) {
  const root = new THREE.Group(); root.name = 'Henry Jones Room south of west landing';
  root.userData.fidelity = 'Y1.002 topology; adapted unmeasured enclosure';
  root.userData.sourceAreaM2 = 49;
  const plaster = materials.parchment.clone(); plaster.color.setHex(PALETTE.parchment); plaster.roughness = 0.96;
  const box = (name: string, size: number[], position: number[], material: THREE.Material, collision = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]), material);
    mesh.name = name; mesh.position.set(...position as [number,number,number]);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    if (collision) markCameraCollider(mesh,{id:`henry-${name}-${position.join('-')}`,shape:'box',center:{x:0,y:0,z:0},size:{x:size[0],y:size[1],z:size[2]}});
    return mesh;
  };
  const H=HENRY_JONES, centerX=(H.northX+H.southX)/2, centerZ=(H.backZ+H.frontZ)/2;
  const width=H.southX-H.northX, depth=H.frontZ-H.backZ;
  box('Henry Jones continuous floor',[width,0.18,depth],[centerX,H.floorY-0.09,centerZ],materials.floor);
  box('Henry Jones supported doorway threshold',[0.76,0.18,H.doorWidth],[3.2,H.floorY-0.09,H.doorZ],materials.woodWarm);
  box('Henry Jones plaster ceiling',[width+0.24,0.18,depth+0.24],[centerX,H.floorY+H.height+0.09,centerZ],plaster);
  if (options.includeNorthWall) {
    // The live connection supplies this boundary from the adjoining stair
    // enclosure. The standalone plaque review needs the same wall so the
    // memorial is read as mounted above a real doorway rather than floating
    // against the review background.
    const doorHeight = 2.35;
    const leftSpan = H.doorZ - H.doorWidth / 2 - H.backZ;
    const rightSpan = H.frontZ - (H.doorZ + H.doorWidth / 2);
    box('Henry Jones north wall rear pier',[0.24,H.height,leftSpan],
      [H.northX,H.floorY+H.height/2,H.backZ+leftSpan/2],plaster,true);
    box('Henry Jones north wall front pier',[0.24,H.height,rightSpan],
      [H.northX,H.floorY+H.height/2,H.doorZ+H.doorWidth/2+rightSpan/2],plaster,true);
    box('Henry Jones north wall doorway head',[0.24,H.height-doorHeight,H.doorWidth],
      [H.northX,H.floorY+doorHeight+(H.height-doorHeight)/2,H.doorZ],plaster,true);
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.16,doorHeight+0.12,0.18),materials.woodWarm);
      jamb.name='Henry Jones doorway timber jamb';
      jamb.position.set(H.northX+0.04,H.floorY+doorHeight/2,H.doorZ+side*H.doorWidth/2);
      jamb.castShadow=jamb.receiveShadow=true; root.add(jamb);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,H.doorWidth+0.18),materials.woodWarm);
    head.name='Henry Jones doorway timber head';
    head.position.set(H.northX+0.04,H.floorY+doorHeight+0.08,H.doorZ);
    head.castShadow=head.receiveShadow=true; root.add(head);
  }
  box('Henry Jones east wall',[width, H.height,0.24],[centerX,H.floorY+H.height/2,H.frontZ],plaster,true);
  // The stair enclosure supplies the shared wall up to the common ceiling.
  const daylight = new THREE.MeshStandardMaterial({color:PALETTE.parchment,emissive:PALETTE.parchment,emissiveIntensity:0.3,roughness:0.8});
  const sash = createLongRoomSashes(3.1,materials.woodWarm,daylight);
  for(const [w,h,d,x,y,z] of [[0.075,3.25,0.22,-0.8375,1.55,0.03],[0.075,3.25,0.22,0.8375,1.55,0.03],
    [1.825,0.09,0.32,0,-0.045,0.07],[1.825,0.075,0.22,0,3.1375,0.03]]) {
    const surround=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),materials.woodWarm);
    surround.position.set(x,y,z);surround.name='Henry Jones recessed sash surround';
    surround.castShadow=surround.receiveShadow=true;sash.add(surround);
  }
  const wall = (name: string, length: number, centers: number[], x: number, z: number, rotate: boolean) => {
    const sill=1.0, head=4.1, openingWidth=1.6;
    const edges=[-length/2,...centers.flatMap(c=>[c-openingWidth/2,c+openingWidth/2]),length/2];
    for(let i=0;i<edges.length-1;i++) {
      const a=edges[i],b=edges[i+1],u=(a+b)/2;
      const spans=i%2===1?[[0,sill],[head,H.height]]:[[0,H.height]];
      for(const [low,high] of spans) box(name+' plaster pier',rotate?[0.24,high-low,b-a]:[b-a,high-low,0.24],
        [rotate?x:x+u,H.floorY+(low+high)/2,rotate?z+u:z],plaster,true);
    }
    for(const c of centers) {
      const frame=sash.clone(); frame.position.set(rotate?x-0.08:x+c,H.floorY+sill,rotate?z+c:z+0.08);
      if(rotate)frame.rotation.y=-Math.PI/2;
      frame.name=name+' window';root.add(frame);
      // Glazing is solid to navigation even though its view admits daylight.
      box(name+' window barrier',rotate?[0.08,3.1,openingWidth]:[openingWidth,3.1,0.08],
        [rotate?x:x+c,H.floorY+sill+1.55,rotate?z+c:z],daylight,true);
    }
  };
  wall('Henry Jones south',depth,[-2.5,0,2.5],H.southX,centerZ,true);
  wall('Henry Jones west',width,[0],centerX,H.backZ,false);
  // Neutral illumination is a temporary bounce estimate, not calibrated daylight.
  const light=new THREE.PointLight(PALETTE.parchment,24,10,2);
  light.position.set(centerX,H.floorY+3.5,centerZ);root.add(light);
  root.add(createHenryJonesMemorialDisplay(materials));
  return root;
}
