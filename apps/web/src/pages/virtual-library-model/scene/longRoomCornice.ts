import * as THREE from 'three';
import { LONG_ROOM as L } from '../longRoomLayout';
import type { LibraryMaterials } from './materials';

/** Gallery fascia relief observed in the Gehl axial photograph and official
 * Ste Murray gallery view. Profiles and spacing are photographic estimates. */
export function addLongRoomGalleryCornice(root: THREE.Group, materials: LibraryMaterials) {
  const profile = new THREE.Shape();
  profile.moveTo(0, 0); profile.lineTo(0.32, 0);
  profile.bezierCurveTo(0.35, -0.065, 0.31, -0.14, 0.24, -0.17);
  profile.bezierCurveTo(0.20, -0.185, 0.21, -0.26, 0.13, -0.28);
  profile.lineTo(0, -0.24); profile.closePath();
  const corbelGeometry = new THREE.ExtrudeGeometry(profile, {depth: 0.11, steps: 1, curveSegments: 12, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2});
  corbelGeometry.translate(0, 0, -0.055);
  const perSide = Math.floor(L.length / 0.34);
  const corbels = new THREE.InstancedMesh(corbelGeometry, materials.woodWarm, perSide * 2);
  corbels.name = 'Gallery repeating curved timber modillions';
  const toothCount = Math.floor(L.length / 0.115);
  const teeth = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.065, 0.055), materials.woodWarm, toothCount * 2);
  teeth.name = 'Gallery fine dentil band';
  const matrix = new THREE.Matrix4(); let corbelIndex = 0, toothIndex = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < perSide; i++) {
      matrix.makeRotationY(side === 1 ? Math.PI : 0);
      matrix.setPosition(side * (L.galleryInnerX + 0.09), L.galleryY - 0.23, -L.length / 2 + (i + 0.5) * L.length / perSide);
      corbels.setMatrixAt(corbelIndex++, matrix);
    }
    for (let i = 0; i < toothCount; i++) {
      matrix.makeTranslation(side * (L.galleryInnerX - 0.025), L.galleryY - 0.57, -L.length / 2 + (i + 0.5) * L.length / toothCount);
      teeth.setMatrixAt(toothIndex++, matrix);
    }
    for (const [y, radius, outward] of [[-0.21, 0.025, 0.24], [-0.53, 0.021, 0.075], [-0.64, 0.018, 0.055]]) {
      const moulding = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, L.length, 20), materials.woodWarm);
      moulding.name = 'Rounded gallery cornice bead moulding'; moulding.rotation.x = Math.PI / 2;
      moulding.position.set(side * (L.galleryInnerX - outward), L.galleryY + y, 0);
      moulding.castShadow = moulding.receiveShadow = true; root.add(moulding);
    }
    const backing = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.42, L.length), materials.woodDark);
    backing.name = 'Recessed gallery frieze behind relief'; backing.position.set(side * (L.galleryInnerX + 0.105), L.galleryY - 0.44, 0);
    backing.castShadow = backing.receiveShadow = true; root.add(backing);
  }
  for (const mesh of [corbels, teeth]) {
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.fidelity = 'photo-derived-profile-estimated-spacing'; root.add(mesh);
  }
}
