import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LONG_ROOM_PILASTER_SHAFT_DEPTH = 0.26;

/** Modeled recessed flutes with rounded stops, estimated from the public pier
 * photograph. Local +Z is the aisle-facing carved surface. */
export function createLongRoomPilasterShaft(height: number, material: THREE.Material, options: {
  width?: number;
  fluteCount?: number;
} = {}) {
  const width = options.width ?? 0.38;
  const fluteCount = options.fluteCount ?? 5;
  const depth = LONG_ROOM_PILASTER_SHAFT_DEPTH;
  const columns = Math.max(80, Math.round(80 * width / 0.38));
  const fluteSpacing = width * 0.6 / Math.max(1, fluteCount - 1);
  const stops = [0, 0.025, 0.06, 0.12, height - 0.12, height - 0.06, height - 0.025, height];
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (const y of stops) {
    const end = Math.min(y, height - y, 0.12) / 0.12;
    const taper = Math.sin(end * Math.PI / 2);
    for (let column = 0; column <= columns; column++) {
      const x = (column / columns - 0.5) * width;
      let hollow = 0;
      for (let flute = 0; flute < fluteCount; flute++) {
        const fluteX = (flute - (fluteCount - 1) / 2) * fluteSpacing;
        const u = (x - fluteX) / 0.018;
        if (Math.abs(u) < 1) hollow = 0.014 * Math.sqrt(1 - u * u) * taper;
      }
      positions.push(x, y - height / 2, depth / 2 - hollow);
      uv.push(x / 0.6, y / 2.8);
    }
  }
  for (let row = 0; row < stops.length - 1; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + columns + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const face = new THREE.BufferGeometry();
  face.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  face.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  face.setIndex(indices); face.computeVertexNormals();
  const shell = new THREE.BoxGeometry(width, height, depth);
  // Remove the original +Z plane so it cannot cover the recessed geometry.
  const index = Array.from(shell.index!.array);
  index.splice(shell.groups[4].start, shell.groups[4].count);
  shell.setIndex(index); shell.clearGroups();
  const geometry = mergeGeometries([shell, face]);
  shell.dispose(); face.dispose();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Oak pilaster with rounded recessed flutes';
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
