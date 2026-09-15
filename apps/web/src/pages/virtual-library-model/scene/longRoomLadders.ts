import * as THREE from 'three';
import { LONG_ROOM as L, LONG_ROOM_BAY_PITCH as P, LONG_ROOM_FRONTMOST_CASE, longRoomBayZ } from '../longRoomLayout';
import { markCameraCollider } from '../../virtual-library-collision';
import type { LibraryMaterials } from './materials';

/** Window-end shelf ladders visible in the public bay photograph.
 * Repeated placements and dimensions are reconstruction estimates. */
export function addLongRoomShelfLadders(root: THREE.Group, materials: LibraryMaterials) {
  for(const _step of addLongRoomShelfLaddersSteps(root,materials)) { void _step; }
}

export function* addLongRoomShelfLaddersSteps(
  root: THREE.Group,
  materials: LibraryMaterials,
  includeRetiredCases = false,
): Generator<string, void> {
  const spread = 0.48, width = 0.42;
  const footGeometry=new THREE.SphereGeometry(0.04,16,12);
  const hangingRailGeometry=new THREE.CylinderGeometry(0.02,0.02,width+0.1,20);
  const bracketGeometry=new THREE.BoxGeometry(0.035,0.045,0.10);
  for (const level of [0, 1]) {
    const height = (level === 0 ? L.lowerCaseHeight : L.upperCaseHeight) - 0.15;
    const base = level === 0 ? 0 : L.galleryY;
    const rungGeometry = new THREE.CylinderGeometry(0.018, 0.018, width, 20);
    rungGeometry.rotateZ(Math.PI / 2);
    const railGeometry = new THREE.BoxGeometry(0.045, Math.hypot(height, spread), 0.055);
    const hookPoints = [new THREE.Vector3(0, height - 0.1, 0), new THREE.Vector3(0, height + 0.025, -0.03), new THREE.Vector3(0, height + 0.06, -0.10), new THREE.Vector3(0, height - 0.015, -0.15)];
    const hookGeometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hookPoints),24,0.013,12,false);
    for (const side of [-1, 1]) for (let bay = 0; bay < L.alcovesPerSide; bay++) {
      // The south entry alcove contains the historic spiral, not a pair of ladders.
      if (side === -1 && bay === 0) continue;
      for (const face of (level === 0 ? [-1, 1] : [1])) {
        if (!includeRetiredCases && side === LONG_ROOM_FRONTMOST_CASE.side
          && bay === LONG_ROOM_FRONTMOST_CASE.bay && face === 1) continue;
        const ladder = new THREE.Group(); ladder.name = level === 0 ? 'Window-end timber shelf ladder' : 'Upper gallery timber shelf ladder';
        ladder.position.set(side * (level === 0 ? L.width / 2 - 0.85 : L.aisleHalfWidth + 1.2), base, longRoomBayZ(bay) + face * (P / 2 - 0.36));
        ladder.rotation.y = face === 1 ? Math.PI : 0;
        ladder.userData = { fidelity: 'photographic-form-estimated-repeated-placement', side, bay, level, face };
        for (const x of [-width / 2, width / 2]) {
          const stile = new THREE.Mesh(railGeometry, materials.woodWarm); stile.name = 'Leaning ladder stile';
          stile.rotation.x = -Math.atan2(spread, height); stile.position.set(x, height / 2, spread / 2); ladder.add(stile);
          const foot = new THREE.Mesh(footGeometry, materials.iron);
          foot.name = 'Rounded ladder foot'; foot.scale.set(0.8, 0.55, 1); foot.position.set(x, 0.022, spread); ladder.add(foot);
          const hook = new THREE.Mesh(hookGeometry, materials.iron); hook.position.x=x;
          hook.name = 'Curved ladder top hook'; ladder.add(hook);
        }
        const rungs = Math.floor((height - 0.3) / 0.28);
        for (let i = 0; i < rungs; i++) {
          const y = 0.24 + i * 0.28;
          const rung = new THREE.Mesh(rungGeometry, materials.woodWarm); rung.name = 'Round timber ladder rung';
          rung.position.set(0, y, spread * (1 - y / height)); ladder.add(rung);
        }
        const rail = new THREE.Mesh(hangingRailGeometry, materials.iron);
        rail.name = 'Ladder hanging rail'; rail.rotation.z = Math.PI / 2; rail.position.set(0, height, -0.1); ladder.add(rail);
        for (const x of [-width / 2, width / 2]) {
          const bracket = new THREE.Mesh(bracketGeometry, materials.iron);
          bracket.name = 'Ladder rail fixing bracket'; bracket.position.set(x, height - 0.035, -0.16); ladder.add(bracket);
        }
        markCameraCollider(ladder, {id: `shelf-ladder-${level}-${side}-${bay}-${face}`, shape: 'box',
          center: {x: 0, y: height / 2, z: spread / 2}, size: {x: width + 0.08, y: height, z: spread + 0.08}});
        ladder.traverse(object => {if(object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;});
        root.add(ladder);
      }
      yield `construction-ladders-${level}-${side}-${bay}`;
    }
  }
}
