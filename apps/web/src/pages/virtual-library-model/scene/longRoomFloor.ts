import * as THREE from 'three';
import { PALETTE } from '../config';

/** A shared floor tile, 12 estimated 0.24 m boards across 2.88 × 4.8 m.
 * Surface wear is representative; no photographic texture is copied. */
export function createLongRoomFloorTextures() {
  const size = 512, color = new Uint8Array(size * size * 4);
  const relief = new Uint8Array(size * size), rough = new Uint8Array(size * size * 4);
  const oak = new THREE.Color(PALETTE.oakWarm).lerp(new THREE.Color(PALETTE.brass), 0.62);
  const sample = new THREE.Color();
  const hash = (seed: number) => { const n = Math.sin(seed * 127.1 + 31.7) * 43758.5453; return n - Math.floor(n); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const across = x / size * 12, board = Math.floor(across), u = across - board, v = (y / size + hash(board + 201)) % 1;
    const first = 0.23 + hash(board + 1) * 0.2, second = 0.68 + hash(board + 35) * 0.16;
    const part = v < first ? 0 : v < second ? 1 : 2, seed = board * 13 + part * 71;
    const joint = Math.min(v, 1 - v, Math.abs(v - first), Math.abs(v - second)) * size;
    const edge = Math.min(u, 1 - u) * size / 12;
    const seam = Math.max(0, 1 - Math.min(edge, joint) / 0.8);
    const wave = Math.sin(v * Math.PI * 2 + seed) * 0.09;
    const grain = Math.sin((u + wave) * 73 + seed) * 0.026 + Math.sin(u * 151 + v * 8 + seed) * 0.014;
    const wear = Math.sin(u * 13 + seed) * Math.sin(v * 24 + seed) * 0.014;
    const tone = 0.85 + hash(seed + 11) * 0.24 + grain + wear;
    sample.copy(oak).multiplyScalar(tone * (1 - seam * 0.33));
    const index = y * size + x;
    color[index * 4] = Math.round(sample.r * 255); color[index * 4 + 1] = Math.round(sample.g * 255);
    color[index * 4 + 2] = Math.round(sample.b * 255); color[index * 4 + 3] = 255;
    relief[index] = Math.round(128 - seam * 35 + grain * 24);
    const matte = Math.round((0.8 + hash(seed + 57) * 0.14 + wear) * 255);
    rough[index * 4] = rough[index * 4 + 1] = rough[index * 4 + 2] = matte; rough[index * 4 + 3] = 255;
  }
  const map = new THREE.DataTexture(color, size, size); map.colorSpace = THREE.LinearSRGBColorSpace;
  const bumpMap = new THREE.DataTexture(relief, size, size, THREE.RedFormat);
  const roughnessMap = new THREE.DataTexture(rough, size, size);
  for (const texture of [map, bumpMap, roughnessMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
    texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
  }
  return {map, bumpMap, roughnessMap};
}
