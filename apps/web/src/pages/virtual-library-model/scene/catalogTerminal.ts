import * as THREE from 'three';
import { PALETTE } from '../config';
import { VIRTUAL_LIBRARY_LAYOUT } from '../../virtual-library-layout';
import { markCameraCollider } from '../../virtual-library-collision';
import type { LibraryMaterials } from './materials';
import { makeBox } from './parts';

/** An original celestial catalog instrument, supported by the reception counter. */
export function createCatalogTerminal(materials: LibraryMaterials) {
  const group = new THREE.Group();
  group.name = 'Celestial catalog orb';
  group.position.set(0, VIRTUAL_LIBRARY_LAYOUT.reception.countertop.surfaceY, VIRTUAL_LIBRARY_LAYOUT.reception.radius);

  const profile = [
    [0, 0], [0.3, 0], [0.32, 0.025], [0.32, 0.065], [0.29, 0.085],
    [0.27, 0.085], [0.27, 0.12], [0.19, 0.15], [0.115, 0.2],
    [0.095, 0.29], [0.14, 0.34], [0.2, 0.365], [0.2, 0.39], [0, 0.39],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  const pedestal = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), materials.brass);
  pedestal.name = 'Turned brass orb pedestal';
  pedestal.castShadow = true;
  group.add(pedestal);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.055, 64), materials.woodDark);
  foot.position.y = 0.0275;
  group.add(foot);

  const orbRadius = 0.29;
  const orbCenter = new THREE.Vector3(0, 0.67, 0);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(orbRadius, 64, 40), new THREE.MeshPhysicalMaterial({
    color: PALETTE.glassBlue, metalness: 0.28, roughness: 0.17,
    clearcoat: 1, clearcoatRoughness: 0.08,
    emissive: PALETTE.glassBlue, emissiveIntensity: 0.75,
  }));
  orb.name = 'Midnight blue celestial globe';
  orb.position.copy(orbCenter);
  orb.castShadow = true;
  group.add(orb);

  // A meridian hoop and tilted ecliptic cradle touch the pedestal below the orb.
  for (const [radius, tilt] of [[0.34, -0.3], [0.35, 1.1]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 10, 96), materials.brass);
    ring.position.copy(orbCenter);
    ring.rotation.x = tilt;
    ring.rotation.z = 0.22;
    group.add(ring);
  }
  for (const angle of [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(angle) * 0.13, 0.17, Math.sin(angle) * 0.13),
      new THREE.Vector3(Math.cos(angle) * 0.27, 0.27, Math.sin(angle) * 0.27),
      new THREE.Vector3(Math.cos(angle) * 0.26, 0.48, Math.sin(angle) * 0.26),
      new THREE.Vector3(Math.cos(angle) * 0.22, 0.49, Math.sin(angle) * 0.22),
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.02, 8, false), materials.brass));
  }

  const inlay = new THREE.MeshStandardMaterial({color: PALETTE.parchment,
    emissive: PALETTE.gold, emissiveIntensity: 0.65, roughness: 0.48, metalness: 0.6});
  const starPositions = [[-0.58, 0.27], [-0.23, 0.48], [0.05, 0.13], [0.47, 0.32],
    [0.63, -0.12], [0.18, -0.42], [-0.31, -0.24], [-0.75, -0.4]];
  const stars = starPositions.map(([longitude, latitude]) => new THREE.Vector3(
    Math.sin(longitude) * Math.cos(latitude), Math.sin(latitude), Math.cos(longitude) * Math.cos(latitude),
  ).multiplyScalar(orbRadius + 0.004));
  stars.forEach((position, index) => {
    const star = new THREE.Mesh(new THREE.SphereGeometry(index % 3 === 0 ? 0.012 : 0.007, 12, 8), inlay);
    star.position.copy(position).add(orbCenter);
    group.add(star);
    if (index === 0 || index === 5) return;
    const start = stars[index - 1];
    const arc = new THREE.CatmullRomCurve3(Array.from({length: 12}, (_, step) =>
      start.clone().lerp(position, step / 11).normalize().multiplyScalar(orbRadius + 0.002).add(orbCenter)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 12, 0.0018, 4, false), inlay));
  });

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  if (context) {
    const color = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
    context.fillStyle = color(PALETTE.oakEdge);
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color(PALETTE.parchment);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '64px serif';
    context.fillText('查阅藏书', 384, 96);
  }
  const labelTexture = new THREE.CanvasTexture(canvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  group.add(makeBox(0.57, 0.145, 0.028, materials.brass, 0, 0.115, 0.27));
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.53, 0.127),
    new THREE.MeshBasicMaterial({map: labelTexture, toneMapped: false}));
  label.position.set(0, 0.115, 0.286);
  group.add(label);

  markCameraCollider(group, {id: 'catalog-orb', shape: 'box',
    center: {x: 0, y: 0.515, z: 0}, size: {x: 0.75, y: 1.03, z: 0.75}});
  return group;
}
