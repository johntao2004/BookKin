import * as THREE from 'three';
import { LONG_ROOM as L, longRoomBayZ } from '../longRoomLayout';
import { PALETTE } from '../config';
import { markCameraCollider } from '../../virtual-library-collision';
import type { LibraryMaterials } from './materials';

/** Five fittings sit in alternating vault bays so the axial view reads as a measured rhythm. */
export const LONG_ROOM_CRYSTAL_CHANDELIER_BAYS = [2, 6, 10, 14, 18] as const;
export const LONG_ROOM_CRYSTAL_CHANDELIER_POSITIONS = LONG_ROOM_CRYSTAL_CHANDELIER_BAYS.map(
  bay => longRoomBayZ(bay),
);
export const LONG_ROOM_CRYSTAL_CHANDELIER_SCALE = 1.1;
export const LONG_ROOM_CRYSTAL_CHANDELIER_BASE_Y = 13.65;
export const LONG_ROOM_CRYSTAL_CHANDELIER_CEILING_Y =
  L.vaultSpring + L.vaultRadius - 0.24;

const crystalChandelierMountHeight = () =>
  (LONG_ROOM_CRYSTAL_CHANDELIER_CEILING_Y - LONG_ROOM_CRYSTAL_CHANDELIER_BASE_Y)
  / LONG_ROOM_CRYSTAL_CHANDELIER_SCALE;

function addHorizontalRing(
  group: THREE.Group,
  radius: number,
  tube: number,
  material: THREE.Material,
  y: number,
  name: string,
) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 64), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.castShadow = ring.receiveShadow = true;
  ring.name = name;
  group.add(ring);
  return ring;
}

function addRod(
  group: THREE.Group,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  name: string,
) {
  const direction = end.clone().sub(start);
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 10),
    material,
  );
  rod.position.copy(start).add(end).multiplyScalar(0.5);
  rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  rod.castShadow = rod.receiveShadow = true;
  rod.name = name;
  group.add(rod);
  return rod;
}

function createCrystalDropGeometry(radius: number, height: number) {
  const profile = [
    [0, height / 2],
    [radius * 0.45, height * 0.34],
    [radius, height * 0.08],
    [radius * 0.72, -height * 0.2],
    [radius * 0.3, -height * 0.38],
    [0, -height / 2],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geometry = new THREE.LatheGeometry(profile, 8);
  geometry.computeVertexNormals();
  return geometry;
}

function addCrystalDrop(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3,
  name: string,
  rotationY = 0,
) {
  const drop = new THREE.Mesh(geometry, material);
  drop.position.copy(position);
  drop.rotation.y = rotationY;
  drop.castShadow = drop.receiveShadow = true;
  drop.name = name;
  group.add(drop);
  return drop;
}

function createCrystalChandelierMaterials(materials: LibraryMaterials) {
  const brass = materials.brass.clone();
  brass.name = 'Polished antique brass crystal chandelier frame';
  brass.color.lerp(new THREE.Color(PALETTE.gold), 0.28);
  brass.metalness = 0.88;
  brass.roughness = 0.2;

  const darkBrass = materials.iron.clone();
  darkBrass.name = 'Darkened brass crystal chandelier chain';
  darkBrass.color.lerp(new THREE.Color(PALETTE.brass), 0.18);
  darkBrass.metalness = 0.84;
  darkBrass.roughness = 0.28;

  const crystal = new THREE.MeshPhysicalMaterial({
    color: PALETTE.parchment,
    emissive: PALETTE.parchment,
    emissiveIntensity: 0.46,
    metalness: 0.04,
    roughness: 0.1,
    transmission: 0.22,
    thickness: 0.12,
    ior: 1.45,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  crystal.name = 'Warm faceted crystal';
  crystal.flatShading = true;
  crystal.forceSinglePass = true;

  const crystalAccent = crystal.clone();
  crystalAccent.color.set(PALETTE.gold);
  crystalAccent.emissive.set(PALETTE.gold);
  crystalAccent.emissiveIntensity = 0.54;
  crystalAccent.name = 'Amber faceted crystal accent';

  const glow = new THREE.MeshStandardMaterial({
    color: PALETTE.parchment,
    emissive: PALETTE.parchment,
    emissiveIntensity: 3.2,
    roughness: 0.16,
  });
  glow.name = 'Crystal chandelier warm lamp glow';
  return { brass, darkBrass, crystal, crystalAccent, glow };
}

/** A high-detail, low-footprint ceiling fitting for the enlarged Long Room. */
export function createCrystalChandelier(
  materials: LibraryMaterials,
  lightEnabled = true,
  mountHeight = crystalChandelierMountHeight(),
) {
  const group = new THREE.Group();
  group.name = 'Long Room crystal chandelier';
  group.userData.fidelity = 'refined ceiling lighting adaptation';
  const { brass, darkBrass, crystal, crystalAccent, glow } = createCrystalChandelierMaterials(materials);
  const outerRadius = 1.46;
  const innerRadius = 0.86;
  const armCount = 8;
  const dropGeometry = createCrystalDropGeometry(0.13, 0.56);
  const innerDropGeometry = createCrystalDropGeometry(0.16, 0.72);
  const centralDropGeometry = createCrystalDropGeometry(0.27, 1.14);
  const beadGeometry = new THREE.SphereGeometry(0.075, 12, 8);

  // Keep the suspension visually continuous. The former wide cone sat midway
  // down the chain and read as a detached ceiling canopy rather than part of
  // the fixture, so the stem now meets the collar directly.
  addHorizontalRing(group, 0.48, 0.026, darkBrass, 0.04, 'Crystal chandelier upper ornament ring');

  const centralStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.1, 1.44, 12),
    darkBrass,
  );
  centralStem.position.y = 0.12;
  centralStem.castShadow = true;
  centralStem.name = 'Crystal chandelier central stem';
  group.add(centralStem);
  addHorizontalRing(group, 0.19, 0.028, brass, 0.18, 'Crystal chandelier upper collar');
  addHorizontalRing(group, 0.23, 0.032, brass, -0.47, 'Crystal chandelier lower collar');

  const suspensionCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.17, 0.2, 14),
    brass,
  );
  suspensionCollar.position.y = 0.74;
  suspensionCollar.castShadow = true;
  suspensionCollar.name = 'Crystal chandelier suspension collar';
  group.add(suspensionCollar);

  const chainStart = 0.86;
  const chainEnd = mountHeight - 0.16;
  const linkCount = Math.max(4, Math.ceil((chainEnd - chainStart) / 0.16) + 1);
  const chain = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.075, 0.014, 6, 14),
    darkBrass,
    linkCount,
  );
  const linkMatrix = new THREE.Matrix4();
  const linkQuaternion = new THREE.Quaternion();
  chain.name = 'Crystal chandelier suspension chain';
  chain.castShadow = true;
  for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
    const y = THREE.MathUtils.lerp(chainStart, chainEnd, linkIndex / (linkCount - 1));
    linkQuaternion.setFromEuler(new THREE.Euler(0, linkIndex % 2 === 1 ? Math.PI / 2 : 0, 0));
    linkMatrix.compose(new THREE.Vector3(0, y, 0), linkQuaternion, new THREE.Vector3(1, 1, 1));
    chain.setMatrixAt(linkIndex, linkMatrix);
  }
  chain.instanceMatrix.needsUpdate = true;
  group.add(chain);

  const ceilingShackle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 0.16, 12),
    brass,
  );
  ceilingShackle.position.y = mountHeight - 0.1;
  ceilingShackle.castShadow = true;
  ceilingShackle.name = 'Crystal chandelier ceiling shackle';
  group.add(ceilingShackle);
  const mountingPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.24, 0.08, 32),
    darkBrass,
  );
  mountingPlate.position.y = mountHeight - 0.04;
  mountingPlate.castShadow = mountingPlate.receiveShadow = true;
  mountingPlate.name = 'Crystal chandelier ceiling mounting plate';
  group.add(mountingPlate);

  for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
    const angle = (armIndex / armCount) * Math.PI * 2 + Math.PI / 8;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const armStart = direction.clone().multiplyScalar(0.2).setY(-0.04);
    const armEnd = direction.clone().multiplyScalar(outerRadius).setY(-0.1);
    const armCurve = new THREE.QuadraticBezierCurve3(
      armStart,
      direction.clone().multiplyScalar(0.9).setY(0.16),
      armEnd,
    );
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 28, 0.034, 10, false), brass);
    arm.castShadow = arm.receiveShadow = true;
    arm.name = `Crystal chandelier curved arm ${armIndex + 1}`;
    group.add(arm);

    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.1, 0.1, 14),
      brass,
    );
    cup.position.copy(armEnd).setY(-0.13);
    cup.castShadow = true;
    cup.name = `Crystal chandelier lamp cup ${armIndex + 1}`;
    group.add(cup);
    addHorizontalRing(group, 0.15, 0.014, brass, -0.19,
      `Crystal chandelier lamp cup rim ${armIndex + 1}`)
      .position.set(armEnd.x, -0.19, armEnd.z);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), glow);
    bulb.position.copy(armEnd).setY(-0.24);
    bulb.scale.y = 1.35;
    bulb.name = `Crystal chandelier glowing bulb ${armIndex + 1}`;
    group.add(bulb);
    addRod(group, armEnd.clone().setY(-0.28), armEnd.clone().setY(-0.48), 0.012, darkBrass,
      `Crystal chandelier crystal stem ${armIndex + 1}`);
    addCrystalDrop(group, dropGeometry, armIndex % 2 === 0 ? crystal : crystalAccent,
      armEnd.clone().setY(-0.72), `Crystal chandelier outer teardrop ${armIndex + 1}`, angle);

    const nextAngle = ((armIndex + 1) / armCount) * Math.PI * 2 + Math.PI / 8;
    const nextDirection = new THREE.Vector3(Math.cos(nextAngle), 0, Math.sin(nextAngle));
    const swagCurve = new THREE.QuadraticBezierCurve3(
      direction.clone().multiplyScalar(outerRadius).setY(-0.1),
      direction.clone().add(nextDirection).normalize().multiplyScalar(outerRadius * 0.76).setY(-0.42),
      nextDirection.clone().multiplyScalar(outerRadius).setY(-0.1),
    );
    const swag = new THREE.Mesh(new THREE.TubeGeometry(swagCurve, 24, 0.018, 8, false), brass);
    swag.castShadow = true;
    swag.name = `Crystal chandelier draped brass swag ${armIndex + 1}`;
    group.add(swag);
    const bead = new THREE.Mesh(beadGeometry, crystalAccent);
    bead.position.copy(direction.clone().add(nextDirection).normalize().multiplyScalar(outerRadius * 0.76));
    bead.position.y = -0.43;
    bead.name = `Crystal chandelier swag bead ${armIndex + 1}`;
    group.add(bead);
  }

  addHorizontalRing(group, innerRadius, 0.026, brass, -0.24, 'Crystal chandelier inner ring');
  for (let crystalIndex = 0; crystalIndex < 6; crystalIndex += 1) {
    const angle = (crystalIndex / 6) * Math.PI * 2;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const position = direction.clone().multiplyScalar(innerRadius);
    addRod(group, position.clone().setY(-0.2), position.clone().setY(-0.51), 0.012, darkBrass,
      `Crystal chandelier inner crystal stem ${crystalIndex + 1}`);
    addCrystalDrop(group, innerDropGeometry, crystalAccent, position.clone().setY(-0.83),
      `Crystal chandelier inner teardrop ${crystalIndex + 1}`, angle);
  }

  const centralPendantStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.04, 0.42, 10),
    darkBrass,
  );
  centralPendantStem.position.y = -0.7;
  centralPendantStem.castShadow = true;
  centralPendantStem.name = 'Crystal chandelier central pendant stem';
  group.add(centralPendantStem);
  addCrystalDrop(group, centralDropGeometry, crystal, new THREE.Vector3(0, -1.42, 0),
    'Crystal chandelier central pendant');
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 8), brass);
  finial.rotation.z = Math.PI;
  finial.position.y = -2.1;
  finial.castShadow = true;
  finial.name = 'Crystal chandelier lower brass finial';
  group.add(finial);
  const centralBead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), crystalAccent);
  centralBead.position.y = -0.58;
  centralBead.name = 'Crystal chandelier central crystal bead';
  group.add(centralBead);

  if (lightEnabled) {
    const light = new THREE.PointLight(PALETTE.gold, 24, 13, 2);
    light.position.y = -0.28;
    light.name = 'Crystal chandelier warm point light';
    group.add(light);
  }
  return group;
}

export function addLongRoomCrystalChandeliers(root: THREE.Group, materials: LibraryMaterials) {
  const template = createCrystalChandelier(materials, true);
  for (const [index, z] of LONG_ROOM_CRYSTAL_CHANDELIER_POSITIONS.entries()) {
    const fixture = template.clone(true);
    fixture.position.set(0, LONG_ROOM_CRYSTAL_CHANDELIER_BASE_Y, z);
    fixture.scale.setScalar(LONG_ROOM_CRYSTAL_CHANDELIER_SCALE);
    fixture.userData.bay = LONG_ROOM_CRYSTAL_CHANDELIER_BAYS[index];
    markCameraCollider(fixture, {
      id: `long-room-crystal-chandelier-${index}`,
      shape: 'box',
      center: { x: 0, y: -0.55, z: 0 },
      size: { x: 3.35, y: 3.6, z: 3.35 },
    });
    root.add(fixture);
  }
}
