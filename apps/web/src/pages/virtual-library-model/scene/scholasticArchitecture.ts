import * as THREE from 'three';
import { LIBRARY } from '../config';
import { markCameraCollider } from '../../virtual-library-collision';
import type { LibraryMaterials } from './materials';
import { makeBox } from './parts';

/** Original collegiate Gothic construction. All dimensions are in scene metres. */
export const SCHOLASTIC_LAYOUT = {
  vaultSpring: LIBRARY.tower.mainHeight - 0.95,
  vaultRise: 6.65,
  ribCount: 16,
} as const;

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const polar = (r: number, y: number, a: number) => v(Math.cos(a) * r, y, Math.sin(a) * r);

/** A moulded, three-lobed rib, rather than a low-poly cylinder. */
function rib(points: THREE.Vector3[], material: THREE.Material, radius = 0.09) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const group = new THREE.Group();
  for (const [offset, size] of [[0, radius], [-radius, radius * 0.43], [radius, radius * 0.43]]) {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, size, 10, false), material);
    mesh.position.y = offset;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function createScholasticVault(materials: LibraryMaterials) {
  const group = new THREE.Group();
  group.name = 'Long Room inspired coffered oak vault';
  const { vaultSpring: spring, vaultRise: rise, ribCount } = SCHOLASTIC_LAYOUT;
  const radius = LIBRARY.tower.innerRadius + 0.3;
  const heightAt = (r: number) => spring + rise * (1 - Math.pow(r / radius, 1.65));
  // A continuous curved timber lining closes the complete roof, including oblique views.
  const lining = materials.wood.clone();
  lining.side = THREE.DoubleSide;
  const profile = Array.from({ length: 49 }, (_, i) => {
    const r = radius * i / 48;
    return new THREE.Vector2(r, heightAt(r) + 0.14);
  });
  const shell = new THREE.Mesh(new THREE.LatheGeometry(profile, 128), lining);
  shell.name = 'Continuous curved oak vault lining';
  shell.receiveShadow = true;
  group.add(shell);
  // Long Room-inspired transverse timber bays, adapted to the circular envelope.
  // Keep the same roof surface and mounting height so the galleries and chain stay attached.
  const heightAtPoint = (x: number, z: number) => heightAt(Math.hypot(x, z));
  for (let bay = 1; bay < ribCount; bay++) {
    const z = radius * (2 * bay / ribCount - 1);
    const halfWidth = Math.sqrt(radius * radius - z * z);
    const points = Array.from({ length: 49 }, (_, j) => {
      const x = halfWidth * (2 * j / 48 - 1);
      return v(x, heightAtPoint(x, z) - 0.1, z);
    });
    const arch = rib(points, materials.woodWarm, 0.145);
    arch.name = `Long Room transverse oak arch ${bay}`;
    group.add(arch);
  }
  // Fine longitudinal battens make the oak lining read as fitted boards, not a flat dome.
  for (let board = 1; board < 40; board++) {
    const x = radius * (2 * board / 40 - 1);
    const halfLength = Math.sqrt(radius * radius - x * x);
    const points = Array.from({ length: 49 }, (_, j) => {
      const z = halfLength * (2 * j / 48 - 1);
      return v(x, heightAtPoint(x, z) - 0.035, z);
    });
    const batten = new THREE.Mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points), 48, board === 20 ? 0.09 : 0.028, 6, false,
    ), materials.woodDark);
    batten.name = `Longitudinal oak lining batten ${board}`;
    batten.receiveShadow = true;
    group.add(batten);
  }
  const cornice = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.2, 0.2, 12, 128), materials.woodWarm);
  cornice.rotation.x = Math.PI / 2;
  cornice.position.y = spring;
  group.add(cornice);
  for (let i = 0; i < 128; i++) {
    const a = i * Math.PI / 64;
    const dentil = makeBox(0.17, 0.24, 0.23, materials.woodWarm);
    dentil.position.copy(polar(radius - 0.22, spring - 0.24, a));
    dentil.rotation.y = -a;
    group.add(dentil);
  }
  return group;
}

/** Room-scale ribs, grounded in the existing wall envelope and above head height. */
export function addScholasticRoomCeiling(root: THREE.Group, materials: LibraryMaterials) {
  for (const z of [-4.6, -1.2, 2.2]) {
    const arch = rib([v(-5.6, 6.03, z), v(-4.8, 6.08, z), v(-2.6, 6.14, z),
      v(0, 6.18, z), v(2.6, 6.14, z), v(4.8, 6.08, z), v(5.6, 6.03, z)], materials.woodWarm, 0.075);
    arch.name = `Carved room ceiling arch ${z}`;
    markCameraCollider(arch, { id: `room-ceiling-rib-${z}`, shape: 'box',
      center: { x: 0, y: 6.03, z }, size: { x: 7.6, y: 0.42, z: 0.23 } });
    root.add(arch);
  }
  for (const x of [-3.5, -1.75, 0, 1.75, 3.5]) {
    root.add(makeBox(0.1, 0.11, 12.5, materials.woodDark, x, 6.19, -0.5));
  }
}
