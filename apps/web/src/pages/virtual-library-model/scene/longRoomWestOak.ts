import * as THREE from 'three';
import { PALETTE } from '../config';

/** Quiet longitudinal oak grain for the west stair joinery, separate from tread wear.
 * Shared maps keep the enclosure and review route independent of hall texture loading. */
export function createWestOakFinish(base: THREE.MeshStandardMaterial, namePrefix = 'West staircase') {
  const width = 128, height = 256;
  const albedo = new Uint8Array(width * height * 4), relief = new Uint8Array(width * height);
  const roughness = new Uint8Array(width * height * 4);
  const oak = new THREE.Color(PALETTE.oakWarm), color = new THREE.Color();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const across = x / width * Math.PI * 2, along = y / height * Math.PI * 2;
    const drift = Math.sin(along) * 0.35 + Math.sin(along * 2) * 0.12;
    const grain = Math.sin(across * 23 + drift) * 0.024
      + Math.sin(across * 51 + drift * 0.6) * 0.01;
    const broad = Math.sin(across * 3 + Math.sin(along) * 0.15) * 0.035;
    const index = y * width + x;
    color.copy(oak).multiplyScalar(1 + grain + broad).convertLinearToSRGB();
    albedo.set([Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255), 255], index * 4);
    relief[index] = Math.round(128 + grain * 200);
    const finish = Math.round(222 + broad * 100);
    roughness.set([finish, finish, finish, 255], index * 4);
  }
  const map = new THREE.DataTexture(albedo, width, height);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.DataTexture(relief, width, height, THREE.RedFormat);
  const roughnessMap = new THREE.DataTexture(roughness, width, height);
  for (const texture of [map, bumpMap, roughnessMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter; texture.anisotropy = 4; texture.needsUpdate = true;
  }
  const wood = base.clone(); wood.name = `${namePrefix} fine oak panel finish`;
  wood.map = map; wood.bumpMap = bumpMap; wood.roughnessMap = roughnessMap;
  wood.normalMap = null; wood.color.setHex(PALETTE.parchment);
  wood.bumpScale = 0.0006; wood.roughness = 0.7;
  const trim = wood.clone(); trim.name = `${namePrefix} polished oak joinery`;
  trim.roughness = 0.57; trim.color.multiplyScalar(1.1);
  const dark = wood.clone(); dark.name = `${namePrefix} shaded oak soffit`;
  dark.color.multiplyScalar(0.72);
  return {wood, woodWarm: trim, woodDark: dark};
}

/** Local XY panel geometry: grain runs vertically or along the raking rail.
 * Thickness faces get a separate projection so end grain cannot collapse. */
export function mapWestPanelGrain(geometry: THREE.BufferGeometry, slope: number, raking: boolean) {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  const normalizer = Math.hypot(1, slope);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const along = raking ? (x + y * slope) / normalizer : y;
    const across = raking ? (y - x * slope) / normalizer : x;
    if (Math.abs(n.getZ(i)) > 0.5) uv.setXY(i, across / 0.6, along / 2.8);
    else {
      const end = raking ? Math.abs(n.getX(i) + n.getY(i) * slope) / normalizer : Math.abs(n.getY(i));
      uv.setXY(i, z / 0.6, end > 0.7 ? across / 0.6 : along / 2.8);
    }
  }
  uv.needsUpdate = true;
}
