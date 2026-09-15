import * as THREE from 'three';
import { LONG_ROOM as L, LONG_ROOM_BAY_PITCH as P, EAST_GALLERY_CONNECTION as E } from '../longRoomLayout';
import type { LibraryMaterials } from './materials';
import { alignLongRoomBoardGrain } from './longRoomTimber';

/** Panelled gallery piers visible in the 2021 Palais Princier detail.
 * Profiles and repetition on the adapted bay grid are photographic estimates. */
export function addLongRoomGalleryPosts(root: THREE.Group, materials: LibraryMaterials, side: number) {
  const positions: number[] = [];
  const frame = new THREE.Shape();
  frame.moveTo(-0.185, -0.365); frame.lineTo(0.185, -0.365);
  frame.lineTo(0.185, 0.365); frame.lineTo(-0.185, 0.365); frame.closePath();
  const opening = new THREE.Path();
  opening.moveTo(-0.142, -0.318); opening.lineTo(0.142, -0.318);
  opening.lineTo(0.142, 0.318); opening.lineTo(-0.142, 0.318); opening.closePath(); frame.holes.push(opening);
  const frameGeometry = new THREE.ExtrudeGeometry(frame, {depth: 0.012, bevelEnabled: true,
    bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 3});
  const bodyGeometry = new THREE.BoxGeometry(0.48, 1.05, 0.20);
  const panelGeometry = new THREE.BoxGeometry(0.292, 0.644, 0.008);
  const capGeometry = new THREE.BoxGeometry(0.55, 0.075, 0.24);
  const neckGeometry = new THREE.BoxGeometry(0.51, 0.045, 0.22);
  for (const geometry of [bodyGeometry, panelGeometry, capGeometry, neckGeometry]) {
    alignLongRoomBoardGrain(new THREE.Mesh(geometry, materials.woodWarm));
  }
  for (let bay = 0; bay <= L.alcovesPerSide; bay++) {
    const z = L.length / 2 - L.endMargin - bay * P;
    if ((z > -44.2 - 0.275 && z < -41.8 + 0.275) || (z > E.front-0.275 && z < E.back+0.275)) continue;
    positions.push(z);
    const group = new THREE.Group(); group.name = `Panelled gallery newel ${side}:${bay}`;
    group.position.set(side * L.galleryInnerX, L.galleryY + 0.55, z); group.rotation.y = -side * Math.PI / 2;
    group.userData.fidelity = 'photo-derived-panelling-estimated-dimensions-and-repetition';
    const body = new THREE.Mesh(bodyGeometry, materials.woodWarm); group.add(body);
    for (const face of [-1, 1]) {
      const panel = new THREE.Mesh(panelGeometry, materials.woodDark); panel.position.z = face * 0.101; group.add(panel);
      const surround = new THREE.Mesh(frameGeometry, materials.woodWarm);
      surround.rotation.y = face === -1 ? Math.PI : 0; surround.position.z = face * 0.108; group.add(surround);
    }
    for (const sign of [-1, 1]) {
      const neck = new THREE.Mesh(neckGeometry, materials.woodWarm); neck.position.y = sign * 0.51; group.add(neck);
      const cap = new THREE.Mesh(capGeometry, materials.woodWarm); cap.position.y = sign * 0.565; group.add(cap);
    }
    group.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true; });
    root.add(group);
  }
  return positions;
}
