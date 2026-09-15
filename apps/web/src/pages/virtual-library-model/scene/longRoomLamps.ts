import * as THREE from 'three';
import { LONG_ROOM as L, LONG_ROOM_BAY_PITCH, LONG_ROOM_FRONTMOST_CASE, LONG_ROOM_STAIR_ALCOVE, longRoomBayZ } from '../longRoomLayout';
import { PALETTE } from '../config';
import type { LibraryMaterials } from './materials';

/** Visible lighting adaptation requested for the enlarged experience, not surveyed historic fittings. */
export function addLongRoomLamps(root: THREE.Group, materials: LibraryMaterials, includeRetiredCases = false) {
  const bulb = new THREE.MeshStandardMaterial({color: PALETTE.parchment, emissive: PALETTE.parchment, emissiveIntensity: 2.5, roughness: 0.25});
  const glass = new THREE.MeshPhysicalMaterial({color: PALETTE.parchment, transparent: true, opacity: 0.22, roughness: 0.18, depthWrite: false});
  // Construct each curved surface once; all twenty fittings share geometry and materials.
  const template = new THREE.Group();
  template.name = 'Curved brass and glass wall lamp';
  template.userData.fidelity = 'enlarged-experience-lighting-adaptation';
  {
    const fixture = template;
    const rose = new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 20), materials.brass); rose.scale.set(1, 1.7, 0.25); fixture.add(rose);
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, -0.08, 0), new THREE.Vector3(0, -0.34, 0.3), new THREE.Vector3(0, -0.2, 0.55), new THREE.Vector3(0, 0.1, 0.55));
    fixture.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.028, 16, false), materials.brass));
    const cup = new THREE.Mesh(new THREE.LatheGeometry([[0.03,0],[0.08,0.03],[0.13,0.06],[0.15,0.1],[0.15,0.12]].map(([x,y]) => new THREE.Vector2(x,y)), 40), materials.brass);
    cup.position.set(0, 0.08, 0.55); fixture.add(cup);
    const lightBulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 24), bulb); lightBulb.scale.y = 1.7; lightBulb.position.set(0,0.29,0.55); fixture.add(lightBulb);
    const shade = new THREE.Mesh(new THREE.LatheGeometry([[0.11,0],[0.16,0.08],[0.17,0.25],[0.12,0.37]].map(([x,y]) => new THREE.Vector2(x,y)), 40), glass);
    shade.position.set(0,0.18,0.55); fixture.add(shade);
    for (const [radius, y] of [[0.11, 0.18], [0.12, 0.55]]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 8, 32), materials.brass);
      rim.name = 'Rounded brass shade rim'; rim.rotation.x = Math.PI / 2;
      rim.position.set(0, y, 0.55); fixture.add(rim);
    }
    fixture.traverse(object => {if(object instanceof THREE.Mesh && object.material === materials.brass) object.castShadow = object.receiveShadow = true;});
  }
  for (const level of [0, 1]) for (const side of [-1, 1]) for (const bay of [0, 4, 8, 12, 16]) {
    if (side === LONG_ROOM_STAIR_ALCOVE.side && bay === LONG_ROOM_STAIR_ALCOVE.bay) continue;
    if (!includeRetiredCases && side === LONG_ROOM_FRONTMOST_CASE.side && bay === LONG_ROOM_FRONTMOST_CASE.bay) continue;
    const fixture = template.clone();
    fixture.userData = {...fixture.userData, side, level, bay};
    fixture.position.set(side * (L.aisleHalfWidth - 0.12), level * L.galleryY + 3.8,
      longRoomBayZ(bay) + LONG_ROOM_BAY_PITCH / 2);
    fixture.rotation.y = -side * Math.PI / 2;
    // Retain four real lights; the additional fittings do not add shader light loops or shadow maps.
    if (level === 0 && (bay === 0 || bay === 12)) {
      const light = new THREE.PointLight(PALETTE.parchment, 38, 8, 2); light.position.set(0, 0.29, 0.55); fixture.add(light);
    }
    root.add(fixture);
  }
}
