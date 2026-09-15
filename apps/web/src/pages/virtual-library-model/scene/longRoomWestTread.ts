import * as THREE from 'three';
import { PALETTE } from '../config';

/** Worn tread finish estimated from Casey's 2018 west-stair photograph.
 * Independent from the dark oak balustrade; no photographed lighting is baked in. */
export function createWestTreadMaterial(base: THREE.MeshStandardMaterial) {
  const width = 128, height = 256;
  const pixels = new Uint8Array(width * height * 4);
  const relief = new Uint8Array(width * height);
  const roughness = new Uint8Array(width * height * 4);
  const timber = new THREE.Color(PALETTE.oakWarm).lerp(new THREE.Color(PALETTE.parchment), 0.22);
  const color = new THREE.Color();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const phase = y / height * Math.PI * 2;
    const across = x / width * Math.PI * 2;
    const grain = Math.sin(across * 31 + Math.sin(phase) * 0.7) * 0.025
      + Math.sin(across * 63 + Math.sin(phase * 2) * 0.4) * 0.009;
    const variation = Math.sin(across * 3 + Math.sin(phase) * 0.2) * 0.04;
    const index = y * width + x;
    color.copy(timber).multiplyScalar(0.94 + grain + variation);
    pixels[index * 4] = Math.round(color.r * 255);
    pixels[index * 4 + 1] = Math.round(color.g * 255);
    pixels[index * 4 + 2] = Math.round(color.b * 255);
    pixels[index * 4 + 3] = 255;
    relief[index] = Math.round(128 + grain * 160);
    const finish = Math.round(210 + variation * 100);
    roughness.set([finish, finish, finish, 255], index * 4);
  }
  const map = new THREE.DataTexture(pixels, width, height);
  map.colorSpace = THREE.LinearSRGBColorSpace;
  const bumpMap = new THREE.DataTexture(relief, width, height, THREE.RedFormat);
  const roughnessMap = new THREE.DataTexture(roughness, width, height);
  for (const texture of [map, bumpMap, roughnessMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter; texture.anisotropy = 4; texture.needsUpdate = true;
  }
  const material = base.clone();
  material.name = 'West staircase worn tread timber';
  material.color.setHex(PALETTE.parchment);
  material.map = map; material.bumpMap = bumpMap; material.roughnessMap = roughnessMap;
  material.bumpScale = 0.0015; material.roughness = 0.9;
  return material;
}

/** Local X runs across the flight: grain follows the long edge of each tread.
 * Project end faces separately so rounded nosings never collapse into a single UV line. */
export function mapWestTreadGrain(geometry: THREE.BufferGeometry, offset = 0) {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getX(i)) > 0.7) uv.setXY(i, p.getY(i) / 0.6, p.getZ(i) / 0.6 + offset);
    else uv.setXY(i, (Math.abs(n.getY(i)) > 0.7 ? p.getZ(i) : p.getY(i)) / 0.6,
      p.getX(i) / 2.8 + offset);
  }
  uv.needsUpdate = true;
}
