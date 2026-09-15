import * as THREE from 'three';
import { PALETTE } from '../config';

/** Longitudinal ceiling boards, independently generated without floor end joints.
 * Board widths and surface variation are photographic reconstruction estimates. */
export function createLongRoomCeilingMaterial(base: THREE.MeshStandardMaterial) {
  const width = 512, height = 256, albedo = new Uint8Array(width * height * 4);
  const relief = new Uint8Array(width * height), roughness = new Uint8Array(width * height * 4);
  const oak = new THREE.Color(PALETTE.oakWarm).lerp(new THREE.Color(PALETTE.brass), 0.56)
    .lerp(new THREE.Color(PALETTE.stone), 0.25);
  const color = new THREE.Color();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const board = Math.floor(x / 64), within = x % 64;
    const v = y / height * Math.PI * 2;
    const wave = Math.sin(v + board) * 1.3 + Math.sin(v * 3 + board * 2.1) * 0.35;
    const grain = Math.sin((within + wave) * (1.25 + board * 0.013)) * 0.021
      + Math.sin((within - wave) * 3.55) * 0.012;
    // Periodic, low-frequency wear varies along each board without introducing
    // transverse plank joints into the continuous barrel lining.
    const wear = Math.sin(v * 2 + board * 1.73 + within * 0.04) * 0.025
      + Math.sin(v * 5 - board * 0.71) * 0.012;
    const seam = within === 0;
    const shade = 0.91 + 0.045 * Math.sin(board * 2.73) + grain + wear;
    color.copy(oak).multiplyScalar(seam ? shade * 0.78 : shade);
    const index = y * width + x;
    albedo[index * 4] = Math.round(color.r * 255); albedo[index * 4 + 1] = Math.round(color.g * 255);
    albedo[index * 4 + 2] = Math.round(color.b * 255); albedo[index * 4 + 3] = 255;
    relief[index] = seam ? 80 : Math.round(128 + grain * 80);
    const surfaceRoughness = Math.round(255 * (seam ? 0.96 : 0.85 + wear + grain * 0.5));
    roughness[index * 4] = roughness[index * 4 + 1] = roughness[index * 4 + 2] = surfaceRoughness;
    roughness[index * 4 + 3] = 255;
  }
  const map = new THREE.DataTexture(albedo, width, height);
  map.colorSpace = THREE.LinearSRGBColorSpace;
  const bump = new THREE.DataTexture(relief, width, height, THREE.RedFormat);
  // Roughness uses the green channel; provide RGBA rather than a red-only map.
  const roughnessMap = new THREE.DataTexture(roughness, width, height);
  for (const texture of [map, bump, roughnessMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4; texture.needsUpdate = true;
  }
  const material = base.clone(); material.side = THREE.DoubleSide;
  material.map = map; material.bumpMap = bump; material.bumpScale = 0.004;
  material.color.setHex(PALETTE.parchment); material.roughness = 1; material.roughnessMap = roughnessMap;
  return material;
}

/** Metric local UVs: grain follows a board's longest dimension, never its thickness. */
export function alignLongRoomBoardGrain(mesh: THREE.Mesh<THREE.BoxGeometry>) {
  const p = mesh.geometry.parameters;
  const lengths = [p.width, p.height, p.depth];
  const along = lengths.indexOf(Math.max(...lengths));
  const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
  const uv = mesh.geometry.getAttribute('uv');
  const value = (index: number, axis: number) => axis === 0 ? position.getX(index) : axis === 1 ? position.getY(index) : position.getZ(index);
  for (let i = 0; i < position.count; i++) {
    const faceAxis = [Math.abs(normal.getX(i)), Math.abs(normal.getY(i)), Math.abs(normal.getZ(i))].indexOf(1);
    const faceAxes = [0, 1, 2].filter(axis => axis !== faceAxis);
    // End grain also needs two non-constant coordinates; projecting every face
    // onto the broad face collapses side/end UVs into stretched single pixels.
    const grainAxis = faceAxis === along ? faceAxes[1] : along;
    const acrossAxis = faceAxes.find(axis => axis !== grainAxis)!;
    uv.setXY(i, value(i, acrossAxis) / 0.6, value(i, grainAxis) / (faceAxis === along ? 0.6 : 2.8));
  }
  uv.needsUpdate = true;
}
