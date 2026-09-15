import {addUpperEndJoinery} from './longRoomUpperEnd';
import { EAST_UPPER_ROOM as U } from './longRoomEastUpperRoom';
import { createFagelRoom } from './longRoomFagel';
import * as THREE from 'three';
import { LONG_ROOM as L, EAST_SERVICE_ACCESS as A } from '../longRoomLayout';
import { PALETTE } from '../config';
import { makeBox } from './parts';
import type { LibraryMaterials } from './materials';
import { markCameraCollider } from '../../virtual-library-collision';
import { createLongRoomPilasterShaft } from './longRoomPilaster';
import { createLongRoomCapital } from './longRoomCapital';
import {mapWestPanelGrain} from './longRoomWestOak';
import { alignLongRoomBoardGrain } from './longRoomTimber';

const openingWidth = 2.8, openingHeight = 4;
const JOINERY_REFERENCE_HEIGHT = 8.3;
function archPath(x: number, base: number, spring: number, radius: number, scaleY = 1) {
  const shape = new THREE.Shape(); shape.moveTo(x - radius, base); shape.lineTo(x + radius, base);
  shape.lineTo(x + radius, spring);
  shape.absellipse(x, spring, radius, radius / scaleY, 0, Math.PI, false); shape.closePath(); return shape;
}

/** Public tour: axial entrance, paired niches and side-screened vestibule.
 * Dimensions remain estimates adapted to the enlarged hall. */
export function addLongRoomEastEnd(parent: THREE.Group, materials: LibraryMaterials, includeAdjacentRooms = true) {
  if (!includeAdjacentRooms) {
    addSealedLongRoomEnd(parent, materials, 'East');
    return;
  }
  addLongRoomEnd(parent, materials, 'East', includeAdjacentRooms, includeAdjacentRooms);
}

export function addLongRoomWestEnd(parent: THREE.Group, materials: LibraryMaterials, openForConnectionStudy = false, includeUpper = true, sealed = false) {
  if (sealed) {
    addSealedLongRoomEnd(parent, materials, 'West');
    return;
  }
  addLongRoomEnd(parent, materials, 'West', openForConnectionStudy, includeUpper);
}

/** Both live ends are intentionally continuous timber closures. Their doors,
 * upper door treatments and paired arched niches remain available only to the
 * isolated historical reference assembly. */
function addSealedLongRoomEnd(parent: THREE.Group, materials: LibraryMaterials, end: 'East' | 'West') {
  const east = end === 'East';
  const root = new THREE.Group();
  root.name = `${end} solid timber end wall`;
  root.position.z = (east ? 1 : -1) * L.length / 2;
  if (!east) root.rotation.y = Math.PI;
  root.userData = { fidelity: 'user-requested-continuous-live-hall-closure' };
  parent.add(root);

  const outline = new THREE.Shape();
  outline.moveTo(-L.width / 2, 0);
  outline.lineTo(L.width / 2, 0);
  outline.lineTo(L.width / 2, L.vaultSpring + 0.48);
  outline.lineTo(L.vaultRadius, L.vaultSpring + 0.48);
  outline.lineTo(L.vaultRadius, L.vaultSpring);
  outline.absarc(0, L.vaultSpring, L.vaultRadius, 0, Math.PI, false);
  outline.lineTo(-L.vaultRadius, L.vaultSpring + 0.48);
  outline.lineTo(-L.width / 2, L.vaultSpring + 0.48);
  outline.closePath();

  const material = materials.woodWarm.clone();
  material.side = THREE.DoubleSide;
  const wall = new THREE.Mesh(new THREE.ShapeGeometry(outline), material);
  wall.name = `${end} continuous timber end wall`;
  wall.castShadow = wall.receiveShadow = true;
  mapWestPanelGrain(wall.geometry, 0, false);
  root.add(wall);
  markCameraCollider(wall, {
    id: `long-room-${end.toLowerCase()}-solid-end`,
    shape: 'box',
    center: { x: 0, y: L.height / 2, z: 0 },
    size: { x: L.width, y: L.height, z: 0.15 },
  });

  const endFill = new THREE.PointLight(PALETTE.parchment, 180, 18, 2);
  endFill.name = `${end} solid end reflected light`;
  endFill.position.set(0, 6.6, -4.2);
  root.add(endFill);
}

function addLongRoomEnd(parent: THREE.Group, materials: LibraryMaterials, end: 'East' | 'West', openForConnectionStudy = false, includeUpper = true) {
  const root = new THREE.Group(); root.name = `${end} entrance and paired arched niches`;
  const east = end === 'East';
  root.position.z = (east ? 1 : -1) * L.length / 2;
  if (!east) root.rotation.y = Math.PI;
  root.userData = { fidelity: 'public-tour-derived-composition-estimated-dimensions',
    source: east ? 'https://my.matterport.com/show/?m=zfHhe3XdzCn' : 'https://www.visittrinity.ie/wp-content/uploads/2025/09/Social-Story-Bokex.pdf',
    orientationFidelity: east ? 'public-tour-entry-observation' : 'west-assignment-inferred-from-closed-far-end-photograph' };
  parent.add(root);
  const joinery = new THREE.Group(); joinery.name = `${end} proportioned lower joinery`;
  const verticalScale = L.galleryY / JOINERY_REFERENCE_HEIGHT;
  joinery.scale.y = verticalScale; root.add(joinery);
  const box = (name: string, size: number[], at: number[], material: THREE.Material = materials.woodWarm) => {
    const mesh = makeBox(size[0], size[1], size[2], material, at[0], at[1], at[2]);
    if (material === materials.woodWarm || material === materials.woodDark) alignLongRoomBoardGrain(mesh);
    mesh.name = name; joinery.add(mesh); return mesh;
  };
  const outline = new THREE.Shape();
  outline.moveTo(-L.width / 2, 0); outline.lineTo(L.width / 2, 0);
  outline.lineTo(L.width / 2, L.vaultSpring + 0.48); outline.lineTo(L.vaultRadius, L.vaultSpring + 0.48);
  outline.lineTo(L.vaultRadius, L.vaultSpring); outline.absarc(0, L.vaultSpring, L.vaultRadius, 0, Math.PI, false);
  outline.lineTo(-L.vaultRadius, L.vaultSpring + 0.48); outline.lineTo(-L.width / 2, L.vaultSpring + 0.48); outline.closePath();
  const portal = new THREE.Path(); portal.moveTo(-openingWidth / 2, 0); portal.lineTo(openingWidth / 2, 0);
  portal.lineTo(openingWidth / 2, openingHeight * verticalScale); portal.lineTo(-openingWidth / 2, openingHeight * verticalScale); portal.closePath();
  outline.holes.push(portal);
  // Y1.003 shows an axial doorway into Early Printed Books. Its opening size
  // remains estimated; use the room's same dimensions through both wall layers.
  if(east && includeUpper) {
    const upperPortal=new THREE.Path();
    upperPortal.moveTo(-U.door.width/2,U.floor);upperPortal.lineTo(U.door.width/2,U.floor);
    upperPortal.lineTo(U.door.width/2,U.floor+U.door.height);upperPortal.lineTo(-U.door.width/2,U.floor+U.door.height);
    upperPortal.closePath();outline.holes.push(upperPortal);
    const servicePortal=new THREE.Path();servicePortal.moveTo(A.x-A.width/2,0);servicePortal.lineTo(A.x+A.width/2,0);
    servicePortal.lineTo(A.x+A.width/2,A.height);servicePortal.lineTo(A.x-A.width/2,A.height);servicePortal.closePath();outline.holes.push(servicePortal);
  } else if (openForConnectionStudy && includeUpper) {
    const upperPortal=new THREE.Path();
    upperPortal.moveTo(-.9,L.galleryY);upperPortal.lineTo(.9,L.galleryY);
    upperPortal.lineTo(.9,L.galleryY+2.7);upperPortal.lineTo(-.9,L.galleryY+2.7);
    upperPortal.closePath();outline.holes.push(upperPortal);
  }
  for (const x of [-3.25, 3.25]) {
    const hole = archPath(x, 1.3, 5.25, 0.95, verticalScale);
    // Scale the aperture as a path so it matches the scaled niche joinery exactly.
    const points = hole.getPoints(64); const scaled = new THREE.Path();
    points.forEach((point, index) => index === 0 ? scaled.moveTo(point.x, point.y * verticalScale) : scaled.lineTo(point.x, point.y * verticalScale));
    scaled.closePath(); outline.holes.push(scaled);
  }
  addUpperEndJoinery(root,outline,materials,east,openForConnectionStudy && !east && includeUpper);
  const wallMaterial = materials.woodWarm.clone(); wallMaterial.side = THREE.DoubleSide;
  const nicheMaterial = materials.woodDark.clone(); nicheMaterial.side = THREE.DoubleSide;
  const wall = new THREE.Mesh(new THREE.ShapeGeometry(outline), wallMaterial);
  wall.name = `${end} end wall with ${east ? "seven" : "five"} real openings`; wall.castShadow = wall.receiveShadow = true; mapWestPanelGrain(wall.geometry,0,false);root.add(wall);
  const shaftBase = 0.23, capitalBase = JOINERY_REFERENCE_HEIGHT - 0.88;
  const shaftTemplate = createLongRoomPilasterShaft(capitalBase - shaftBase, materials.woodWarm);
  const capitalTemplate = createLongRoomCapital(materials.woodWarm);
  for (const x of [-4.45, -1.78, 1.78, 4.45]) {
    const shaft = shaftTemplate.clone(); shaft.name = `${end} carved end pilaster shaft`;
    shaft.scale.set(0.32 / 0.38, 1, 0.3 / 0.26);
    shaft.rotation.y = Math.PI; shaft.position.set(x, (capitalBase + shaftBase) / 2, -0.13);
    joinery.add(shaft);
    box('End pilaster foot', [0.5, 0.23, 0.44], [x, 0.115, -0.15]);
    const capital = capitalTemplate.clone(); capital.name = `${end} foliate end pilaster capital`;
    capital.scale.set(0.55 / 0.62, 0.45 / 0.5175, 0.45 / 0.44);
    capital.rotation.y = Math.PI; capital.position.set(x, capitalBase, -0.13); joinery.add(capital);
  }
  for (const [y, h, depth] of [[JOINERY_REFERENCE_HEIGHT - 0.38, 0.18, 0.5], [JOINERY_REFERENCE_HEIGHT - 0.16, 0.14, 0.62], [JOINERY_REFERENCE_HEIGHT + 0.03, 0.12, 0.7]])
    if(east && (y+h/2)*verticalScale>U.floor && (y-h/2)*verticalScale<U.floor+U.door.height) {
      const width=(L.width-U.door.width)/2;
      for(const side of [-1,1])box('East cornice beside upper doorway',[width,h,depth],[side*(U.door.width/2+width/2),y,-depth/2],materials.woodDark);
    } else box(`${end} continuous layered cornice`, [L.width, h, depth], [0, y, -depth / 2], materials.woodDark);
  for (const x of [-3.25, 3.25]) {
    const back = new THREE.Mesh(new THREE.ShapeGeometry(archPath(x, 1.3, 5.25, 0.95, verticalScale)), nicheMaterial);
    back.name = 'Recessed arched niche backing'; back.position.z = 0.55; back.castShadow = back.receiveShadow = true; joinery.add(back);
    for (const side of [-1, 1]) box('Niche recessed jamb lining', [0.06, 3.95, 0.55], [x + side * 0.92, 3.275, 0.275], materials.woodDark);
    const points = Array.from({length: 49}, (_, i) => new THREE.Vector3(x + 0.98 * Math.cos(i * Math.PI / 48), 5.25 + 0.98 / verticalScale * Math.sin(i * Math.PI / 48), -0.03));
    const arch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.055, 20, false), materials.woodWarm);
    arch.name = 'Niche round-arch moulding'; arch.castShadow = arch.receiveShadow = true; joinery.add(arch);
    // Arched reveal connects the opening to its recessed backing instead of exposing the vestibule.
    const hood = new THREE.Shape(); hood.moveTo(x + 0.95, 5.25); hood.absellipse(x, 5.25, 0.95, 0.95 / verticalScale, 0, Math.PI, false);
    hood.lineTo(x - 0.89, 5.25); hood.absellipse(x, 5.25, 0.89, 0.89 / verticalScale, Math.PI, 0, true); hood.closePath();
    const lining = new THREE.Mesh(new THREE.ExtrudeGeometry(hood, {depth: 0.55, bevelEnabled: false}), materials.woodDark);
    lining.name = 'Niche arched soffit'; lining.castShadow = lining.receiveShadow = true; joinery.add(lining);
    box('Niche sill', [2.03, 0.13, 0.72], [x, 1.3, 0.19]);
    box('Niche lower panel', [1.8, 1.03, 0.08], [x, 0.7, -0.055], materials.woodDark);
  }
  if (east) {
    box(`${end} upper central inset panel`, [2.75, 2.55, 0.06], [0, 5.65, -0.025], materials.woodDark);
    for (const y of [4.35, 6.95]) box(`${end} upper panel horizontal moulding`, [2.95, 0.08, 0.12], [0, y, -0.075]);
    for (const x of [-1.44, 1.44]) box(`${end} upper panel stile`, [0.08, 2.6, 0.12], [x, 5.65, -0.075]);
  } else {
    box('West door overpanel', [2.75, 1.15, 0.06], [0, 4.91, -0.025], materials.woodDark);

  }
  // East leaves open toward the hall; the closed far-end pair retains a meeting stile.
  for (const side of [-1, 1]) {
    const opened=openForConnectionStudy;
    const leaf = new THREE.Group(); leaf.name = east ? (opened ? 'Open east entrance door leaf' : 'Closed east entrance door leaf') : opened ? 'Open west connection study door leaf' : 'Closed west paneled door leaf';
    leaf.position.set(side * openingWidth / 2, 0, -0.04); leaf.rotation.y = opened ? -side * 1.12 : 0; joinery.add(leaf);
    const width = openingWidth / 2;
    const addLeafBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const mesh = makeBox(w, h, d, materials.woodDark, x, y, z); alignLongRoomBoardGrain(mesh);
      mesh.name = `${end} door raised panel`; leaf.add(mesh);
    };
    addLeafBox(width, openingHeight, 0.09, -side * width / 2, openingHeight / 2, 0);
    for (const [y, h] of [[0.62, 0.85], [1.62, 0.64], [2.9, 1.53]]) {
      addLeafBox(width - 0.21, h, 0.035, -side * width / 2, y, -0.06);
      const panelWidth = width - 0.21, center = -side * width / 2;
      for (const edge of [-1, 1]) {
        const stile = makeBox(0.028, h, 0.025, materials.woodWarm, center + edge * panelWidth / 2, y, -0.087);
        const rail = makeBox(panelWidth, 0.032, 0.025, materials.woodWarm, center, y + edge * h / 2, -0.087);
        alignLongRoomBoardGrain(stile); alignLongRoomBoardGrain(rail);
        stile.name = rail.name = `${end} door panel moulding`; leaf.add(stile, rail);
      }
    }
    const handleX = -side * (width - 0.15);
    const pull = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(handleX, 1.35, -0.09), new THREE.Vector3(handleX, 1.39, -0.16),
      new THREE.Vector3(handleX, 1.61, -0.16), new THREE.Vector3(handleX, 1.65, -0.09),
    ]), 24, 0.016, 16, false), materials.brass);
    pull.name = `${end} curved door pull`; leaf.add(pull);
    leaf.traverse(object => {if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;});
    if(openForConnectionStudy) markCameraCollider(leaf,{id:`${end.toLowerCase()}-study-door-${side}`,shape:'box',
      center:{x:-side*width/2,y:openingHeight/2,z:0},size:{x:width,y:openingHeight,z:0.18}});
  }
  if (!east && !openForConnectionStudy) box('West door meeting stile', [0.055, openingHeight, 0.045], [0, openingHeight / 2, -0.09], materials.woodDark);
  box(`${end} entrance architrave head`, [3.3, 0.22, 0.38], [0, openingHeight + 0.1, -0.12]);
  for (const x of [-1.51, 1.51]) box(`${end} entrance architrave jamb`, [0.18, openingHeight, 0.32], [x, openingHeight / 2, -0.09]);
  if(openForConnectionStudy) {
    const sideWidth=(L.width-openingWidth)/2, headY=openingHeight*verticalScale;
    for(const side of [-1,1]) {
      if(east&&side===-1) {
        for(const [a,b] of [[-L.width/2,A.x-A.width/2],[A.x+A.width/2,-openingWidth/2]])
          markCameraCollider(wall,{id:`east-service-wall-pier-${a}`,shape:'box',center:{x:(a+b)/2,y:L.height/2,z:0},size:{x:b-a,y:L.height,z:0.15}});
        markCameraCollider(wall,{id:'east-service-wall-head',shape:'box',center:{x:A.x,y:(L.height+A.height)/2,z:0},size:{x:A.width,y:L.height-A.height,z:0.15}});
      } else markCameraCollider(wall,{id:`${end.toLowerCase()}-study-wall-pier-${side}`,shape:'box',
        center:{x:side*(openingWidth/2+sideWidth/2),y:L.height/2,z:0},size:{x:sideWidth,y:L.height,z:0.15}});
    }
    if(east) {
      for(const [id,bottom,top] of [['between-portals',headY,U.floor],['above-upper-portal',U.floor+U.door.height,L.height]] as const)
        markCameraCollider(wall,{id:`east-study-wall-${id}`,shape:'box',center:{x:0,y:(bottom+top)/2,z:0},size:{x:openingWidth,y:top-bottom,z:0.15}});
      const width=(openingWidth-U.door.width)/2;
      for(const side of [-1,1])markCameraCollider(wall,{id:`east-upper-portal-jamb-${side}`,shape:'box',
        center:{x:side*(U.door.width/2+width/2),y:U.floor+U.door.height/2,z:0},size:{x:width,y:U.door.height,z:0.15}});
    } else if(openForConnectionStudy) {
      const upperBase=L.galleryY,upperTop=L.galleryY+2.7,upperWidth=1.8;
      // Preserve the wall band between the lower and upper apertures and the
      // head above the upper aperture; the central upper opening stays clear.
      for(const [id,bottom,top] of [['between-portals',headY,upperBase],['above-upper-portal',upperTop,L.height]] as const)
        markCameraCollider(wall,{id:`west-study-wall-${id}`,shape:'box',center:{x:0,y:(bottom+top)/2,z:0},size:{x:openingWidth,y:top-bottom,z:0.15}});
      const upperSideWidth=(openingWidth-upperWidth)/2;
      for(const side of [-1,1])markCameraCollider(wall,{id:`west-upper-study-portal-jamb-${side}`,shape:'box',
        center:{x:side*(upperWidth/2+upperSideWidth/2),y:(upperBase+upperTop)/2,z:0},size:{x:upperSideWidth,y:upperTop-upperBase,z:0.15}});
    } else markCameraCollider(wall,{id:`${end.toLowerCase()}-study-wall-head`,shape:'box',center:{x:0,y:(L.height+headY)/2,z:0},
      size:{x:openingWidth,y:L.height-headY,z:0.15}});
  } else markCameraCollider(wall, {id: `long-room-end-${east ? 1 : -1}`, shape: 'box', center: {x: 0, y: L.height / 2, z: 0}, size: {x: L.width, y: L.height, z: 0.15}});
  if(east && includeUpper) {
    for(const side of [-1,1])box('East service entry timber jamb',[0.1,A.height/verticalScale,0.16],
      [A.x+side*(A.width/2+0.05),A.height/verticalScale/2,-0.04]);
    box('East service entry timber head',[A.width+0.2,0.12/verticalScale,0.16],[A.x,(A.height+0.06)/verticalScale,-0.04]);
  }
  if (!east && !includeUpper) markCameraCollider(wall, {
    id: 'west-retired-storage-closure', shape: 'box',
    center: {x: 0, y: L.galleryY + 1.35, z: 0}, size: {x: 1.8, y: 2.7, z: 0.15},
  });
  // Broad reflected light makes the end joinery legible beneath the gallery.
  // Shadowless fill supplements the single cached architectural sun shadow map.
  const endFill = new THREE.PointLight(PALETTE.parchment, 180, 18, 2);
  endFill.name = `${end} end reflected light`;
  endFill.position.set(0, 6.6, -4.2); joinery.add(endFill);
  if (!east || !openForConnectionStudy) return;
  root.add(createFagelRoom(materials));
}
