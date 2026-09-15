import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Adapted access stair joinery, informed by Andrew Tierney's TCD stair photo.
 * The original stair is in the west pavilion; this is not its surveyed layout. */
export function createAccessBalusterGeometry() {
  const profile = [
    [0.033, 0.28], [0.040, 0.29], [0.046, 0.305], [0.040, 0.32],
    [0.034, 0.33], [0.044, 0.345], [0.040, 0.36], [0.029, 0.38],
    [0.028, 0.42], [0.025, 0.82], [0.027, 0.85], [0.034, 0.87],
    [0.037, 0.885], [0.032, 0.90],
  ];
  const rounded: THREE.Vector2[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
    for (let j = 0; j < 3; j++) {
      const t = j / 3, blend = y1 - y0 < 0.06 ? t * t * (3 - 2 * t) : t;
      rounded.push(new THREE.Vector2(r0 + (r1 - r0) * blend, y0 + (y1 - y0) * t));
    }
  }
  rounded.push(new THREE.Vector2(...profile[profile.length - 1] as [number, number]));
  const shaft = new THREE.LatheGeometry(rounded, 48);
  const position = shaft.getAttribute('position');
  const uv = shaft.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const radius = Math.hypot(x, z), angle = Math.atan2(x, z);
    const end = THREE.MathUtils.clamp(Math.min(y - 0.38, 0.85 - y) / 0.04, 0, 1);
    // Eight shallow concave channels, fading into the collars.
    const hollow = Math.max(0, Math.cos(angle * 8)) ** 2 * 0.0035 * end;
    position.setXYZ(i, x * (1 - hollow / radius), y, z * (1 - hollow / radius));
    uv.setXY(i, (angle + Math.PI) * 0.03 / 0.6, y / 2.8);
  }
  shaft.computeVertexNormals();
  const foot = new THREE.BoxGeometry(0.066, 0.29, 0.066).translate(0, 0.145, 0);
  const head = new THREE.BoxGeometry(0.064, 0.15, 0.064).translate(0, 0.975, 0);
  const geometry = mergeGeometries([foot, shaft, head])!;
  foot.dispose(); shaft.dispose(); head.dispose();
  return geometry;
}

/** Rounded crown, shoulder and lower bead rather than a circular pipe. */
export function createAccessHandrailProfile() {
  const profile = new THREE.Shape();
  profile.moveTo(-0.046, -0.055);
  profile.lineTo(0.046, -0.055);
  profile.quadraticCurveTo(0.064, -0.05, 0.046, -0.037);
  profile.lineTo(0.046, -0.024); profile.lineTo(0.066, -0.024);
  profile.lineTo(0.066, 0.002);
  profile.bezierCurveTo(0.065, 0.063, -0.065, 0.063, -0.066, 0.002);
  profile.lineTo(-0.066, -0.024); profile.lineTo(-0.046, -0.024);
  profile.lineTo(-0.046, -0.037);
  profile.quadraticCurveTo(-0.064, -0.05, -0.046, -0.055);
  return profile;
}

export function createAccessHandrail(length: number, material: THREE.Material) {
  const geometry = new THREE.ExtrudeGeometry(createAccessHandrailProfile(), {depth: length, bevelEnabled: false, curveSegments: 8});
  const uv = geometry.getAttribute('uv'), positions = geometry.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, positions.getX(i) / 0.6, positions.getZ(i) / 2.8);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Access stair moulded oak handrail';
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
