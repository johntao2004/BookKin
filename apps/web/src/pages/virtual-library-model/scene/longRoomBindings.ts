import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../config';

/** Anonymous binding study, not a reconstruction of individual catalog titles.
 * Shared geometry and surface maps keep the scenery collection instanced. */
export function createHistoricalBindingGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.44);
  shape.lineTo(-0.5, 0.44);
  shape.quadraticCurveTo(0, 0.56, 0.5, 0.44);
  shape.lineTo(0.5, -0.44);
  shape.quadraticCurveTo(0, -0.56, -0.5, -0.44);
  // Recess the page head and tail inside the projecting boards and spine.
  const pageOpening = new THREE.Path();
  pageOpening.moveTo(-0.42, -0.38); pageOpening.lineTo(0.42, -0.38);
  pageOpening.lineTo(0.42, 0.38); pageOpening.lineTo(-0.42, 0.38); pageOpening.closePath();
  const shell = new THREE.ExtrudeGeometry(shape, {depth: 1, bevelEnabled: false, curveSegments: 4});
  shell.rotateX(Math.PI / 2); shell.translate(0, 0.5, 0);
  const shellNormals = shell.getAttribute('normal'), retained: number[] = [];
  for (let i = 0; i < shellNormals.count; i += 3) {
    if (shellNormals.getY(i) > 0.9) continue;
    retained.push(i, i + 1, i + 2);
  }
  shell.setIndex(retained); shell.clearGroups();
  shape.holes.push(pageOpening);
  const rim = new THREE.ShapeGeometry(shape, 4);
  rim.rotateX(-Math.PI / 2); rim.translate(0, 0.5, 0);
  const geometry = mergeGeometries([shell, rim]);
  shell.dispose(); rim.dispose();
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    // Both exposed case faces show curved bindings. Top and bottom use the
    // texture's plain edge strip rather than projecting horizontal spine bands.
    uv.setXY(i, Math.abs(normal.getY(i)) > 0.9 ? 0.01 : (position.getX(i) + 0.5) * 0.9 + 0.05,
      Math.abs(normal.getY(i)) > 0.9 ? position.getZ(i) + 0.5 : position.getY(i) + 0.5);
  }
  for (let i = 0; i < normal.count; i++) {
    if (Math.abs(position.getZ(i)) < 0.43 || Math.abs(normal.getZ(i)) < 0.5 || Math.abs(normal.getY(i)) > 0.1) continue;
    const nx = 0.48 * position.getX(i), nz = Math.sign(position.getZ(i));
    const length = Math.hypot(nx, nz);
    normal.setXYZ(i, nx / length, 0, nz / length);
  }
  geometry.clearGroups();
  return geometry;
}

export function createHistoricalBindingMaterial(variant = 0) {
  const steps=createHistoricalBindingMaterialSteps(variant);
  let step=steps.next();
  while(!step.done) step=steps.next();
  return step.value;
}

/** Preserve the exact surface while allowing the scene loader to yield every 16 rows. */
export function* createHistoricalBindingMaterialSteps(variant = 0): Generator<void, THREE.MeshStandardMaterial> {
  const width = 128, height = 256;
  const color = new Uint8Array(width * height * 4), relief = new Uint8Array(width * height);
  const bands = [[0.12, 0.32, 0.69, 0.88], [0.10, 0.27, 0.46, 0.65, 0.85],
    [0.08, 0.19, 0.81, 0.92], [0.14, 0.39, 0.63, 0.87]][variant % 4];
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    let bandDistance=Infinity;
    for(const band of bands) bandDistance=Math.min(bandDistance,Math.abs(v-band));
    for (let x = 0; x < width; x++) {
    const u = x / (width - 1);
    const noise = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const grain = noise - Math.floor(noise);
    const edge = u < 0.1 || u > 0.9;
    const band = !edge && bandDistance < 0.012;
    const tooling = !edge && (bandDistance > 0.017 && bandDistance < 0.023);
    const panel = variant !== 2 && u > 0.18 && u < 0.82 &&
      v > (variant === 1 ? 0.68 : 0.72) && v < 0.82;
    const panelBorder = panel && (u < 0.21 || u > 0.79 || v > 0.81);
    const lowerLabel = variant === 3 && u > 0.25 && u < 0.75 && v > 0.20 && v < 0.28;
    const wear = (edge ? 0.08 : 0) + Math.sin(x * 0.28 + Math.sin(y * 0.09) * 2) * Math.sin(y * 0.045) * 0.008;
    const shade = Math.min(1, (lowerLabel ? 0.92 : panelBorder ? 0.82 : panel ? 0.36 : 0.73) + grain * 0.13 + wear + (tooling ? 0.13 : 0));
    const index = y * width + x;
    color[index * 4] = color[index * 4 + 1] = color[index * 4 + 2] = Math.round(shade * 255);
    color[index * 4 + 3] = 255;
    relief[index] = Math.round((band ? 0.78 : 0.43) * 255 + grain * 10);
    }
    if((y+1)%16===0) yield;
  }
  const map = new THREE.DataTexture(color, width, height);
  map.colorSpace = THREE.LinearSRGBColorSpace;
  const bumpMap = new THREE.DataTexture(relief, width, height, THREE.RedFormat);
  for (const texture of [map, bumpMap]) {
    texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter; texture.anisotropy = 4; texture.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({map, bumpMap, bumpScale: 0.0007, roughness: 0.88});
}

/** Shared inset paper head; the tail rests on the shelf and needs no extra surface. */
export function createHistoricalPageEdges() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, 0.485, -0.44, -0.5, 0.485, 0.44, 0.5, 0.485, 0.44, 0.5, 0.485, -0.44,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,0,1,1,1,1,0], 2));
  geometry.setIndex([0,1,2,0,2,3]); geometry.computeVertexNormals();
  const width = 128, height = 32, pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const leaf = 0.78 + 0.08 * Math.sin(x * 2.4) + 0.04 * Math.sin(x * 0.73);
    const edgeAge = Math.min(x, width - 1 - x, y * 4, (height - 1 - y) * 4) < 4 ? 0.10 : 0;
    const offset = (y * width + x) * 4, shade = Math.round((leaf - edgeAge) * 255);
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = shade; pixels[offset + 3] = 255;
  }
  const map = new THREE.DataTexture(pixels, width, height);
  map.colorSpace = THREE.LinearSRGBColorSpace; map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter;
  map.anisotropy = 4; map.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({color: new THREE.Color(PALETTE.parchment).multiplyScalar(0.55), map, roughness: 1});
  return {geometry, material};
}

/** Distant bindings preserve instance placement and spine bands at twelve triangles. */
export function createDistantHistoricalBindingGeometry() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const cap = Math.abs(normal.getY(i)) > 0.9;
    uv.setXY(i, cap ? 0.01 : (position.getX(i) + 0.5) * 0.9 + 0.05,
      cap ? position.getZ(i) + 0.5 : position.getY(i) + 0.5);
  }
  geometry.clearGroups(); return geometry;
}
