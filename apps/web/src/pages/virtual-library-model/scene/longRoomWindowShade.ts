import * as THREE from 'three';
import { PALETTE } from '../config';

/** Independent reconstruction of the translucent lower-window blind visible in
 * Dominik Gehl's bay photograph. Folds and dimensions are estimates, not a scan. */
export function createWindowShadeMaterial() {
  const width = 96, height = 256, pixels = new Uint8Array(width * height * 4);
  const ivory = new THREE.Color(PALETTE.parchment), cool = new THREE.Color(PALETTE.glassBlue);
  const color = new THREE.Color();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / (width - 1), v = y / (height - 1);
    // Soft transmitted sash shadows, with a stronger overlapping meeting rail.
    let shadow = 0;
    for (const bar of [1 / 3, 2 / 3]) shadow += 0.15 * Math.exp(-Math.pow((u - bar) / 0.034, 2));
    for (let bar = 1; bar < 6; bar++) shadow += (bar === 3 ? 0.20 : 0.11) * Math.exp(-Math.pow((v - bar / 6) / 0.018, 2));
    const weave = ((x + y) % 2) * 0.012;
    color.copy(ivory).lerp(cool, 0.12 + (1 - v) * 0.12).multiplyScalar(0.84 - shadow - weave);
    const offset = (y * width + x) * 4;
    pixels[offset] = Math.round(color.r * 255); pixels[offset + 1] = Math.round(color.g * 255); pixels[offset + 2] = Math.round(color.b * 255); pixels[offset + 3] = 255;
  }
  const map = new THREE.DataTexture(pixels, width, height);
  map.colorSpace = THREE.LinearSRGBColorSpace; map.minFilter = THREE.LinearFilter; map.magFilter = THREE.LinearFilter; map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({map, roughness: 1, side: THREE.DoubleSide,
    emissive: PALETTE.parchment, emissiveMap: map, emissiveIntensity: 0.18});
}

export function createWindowShade(width: number, height: number, material: THREE.Material) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const columns = 24, rows = 40;
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const u = column / columns, v = row / rows;
    const drape = Math.sin(Math.PI * v);
    const fold = drape * (0.018 * Math.sin(u * Math.PI * 6 + v * 2) + 0.028 * Math.sin(u * Math.PI));
    // Local XY sheet, facing the room along Z. Top corners remain pinned to the roller.
    positions.push((u - 0.5) * width, v * height - 0.028 * Math.sin(Math.PI * u) * (1 - v), fold);
    uv.push(u, v);
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + columns + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const sheet = new THREE.Mesh(geometry, material); sheet.name = 'Lower window softly draped light-filtering blind';
  // Block the direct sun through the fabric. The hall's diffuse daylight and
  // this material's emissive weave approximate transmitted, scattered light;
  // letting the direct beam through would project a sharp sash grid indoors.
  sheet.castShadow = true; sheet.receiveShadow = true;
  return sheet;
}
