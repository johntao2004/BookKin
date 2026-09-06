import * as THREE from 'three';
import { LIBRARY } from '../config';
import { markCameraCollider } from '../../virtual-library-collision';
import type { LibraryMaterials } from './materials';
import { makeBox } from './parts';

/** Original collegiate Gothic construction. All dimensions are in scene metres. */
export const SCHOLASTIC_LAYOUT = {
  vaultSpring: 11.85,
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
  group.name = 'Collegiate Gothic lierne vault';
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
  for (let i = 0; i < ribCount; i++) {
    const a = Math.PI / 2 + i * Math.PI * 2 / ribCount;
    const radial = Array.from({ length: 13 }, (_, j) => {
      const r = radius * (1 - j / 12);
      return polar(r, heightAt(r) - 0.1, a);
    });
    const main = rib(radial, materials.woodWarm, 0.145);
    main.name = `Moulded principal vault rib ${i}`;
    group.add(main);
    // Paired tiercerons meet the neighbouring radial rib at a carved boss.
    for (const direction of [-1, 1]) {
      const points = Array.from({ length: 13 }, (_, j) => {
        const t = j / 12;
        const r = radius * (1 - t * 0.62);
        const angle = a + direction * Math.PI / ribCount * Math.sin(t * Math.PI / 2);
        return polar(r, heightAt(r) - 0.18, angle);
      });
      const secondary = rib(points, materials.woodWarm, 0.062);
      secondary.name = `Fan tierceron ${i}:${direction}`;
      group.add(secondary);
    }
    for (const fraction of [0.38, 0.66, 0.86]) {
      const r = radius * fraction;
      const cross = Array.from({ length: 13 }, (_, j) => {
        const angle = a + j / 12 * Math.PI * 2 / ribCount;
        return polar(r, heightAt(r) - 0.12, angle);
      });
      group.add(rib(cross, materials.woodDark, 0.07));
      const boss = new THREE.Group();
      boss.position.copy(polar(r, heightAt(r) - 0.23, a));
      for (let petal = 0; petal < 6; petal++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), materials.woodWarm);
        const angle = petal * Math.PI / 3;
        leaf.position.set(Math.cos(angle) * 0.11, 0, Math.sin(angle) * 0.11);
        leaf.scale.set(1, 0.4, 1);
        boss.add(leaf);
      }
      group.add(boss);
    }
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
