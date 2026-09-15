import * as THREE from 'three';
import { LONG_ROOM as L, LONG_ROOM_BAY_PITCH as P, isLongRoomLiveCaseOmitted,
  isLongRoomLiveShelfFaceOmitted } from '../longRoomLayout';
import { PALETTE } from '../config';

/** Photographically legible lower-case sequences only. Higher rows and stall
 * letters remain unassigned until their order can be verified. */
export function shouldRenderLongRoomShelfMarks(side: number, bay: number, includeRetiredStairBay = false) {
  return includeRetiredStairBay || !isLongRoomLiveCaseOmitted(side, bay);
}

export function shouldRenderLongRoomShelfFaceMarks(
  side: number,
  bay: number,
  face: number,
  includeRetiredCases = false,
) {
  return shouldRenderLongRoomShelfMarks(side, bay, includeRetiredCases)
    && (includeRetiredCases || !isLongRoomLiveShelfFaceOmitted(side, bay, face));
}

export function addLongRoomShelfMarks(root: THREE.Group, includeRetiredStairBay = false) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 384;
  const context = canvas.getContext('2d'); if (!context) return;
  const letters = 'abcdefghi';
  const labels = [...letters, ...Array.from(letters, letter => letter + letter)];
  context.fillStyle = new THREE.Color(PALETTE.parchment).getStyle();
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '76px Georgia, serif';
  labels.forEach((label, index) => context.fillText(label, (index % 8) * 128 + 64, Math.floor(index / 8) * 128 + 64));
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (const side of [-1, 1]) for (let bay = 0; bay < L.alcovesPerSide; bay++) {
    if (!shouldRenderLongRoomShelfMarks(side, bay, includeRetiredStairBay)) continue;
    const x = side * (L.aisleHalfWidth + 0.15), z = L.length / 2 - L.endMargin - bay * P;
    // Lower level is the one established by the inspected visitor photographs.
    for (let row = 0; row < letters.length; row++) for (const face of [-1, 1]) {
      if (!shouldRenderLongRoomShelfFaceMarks(side, bay, face, includeRetiredStairBay)) continue;
      const y = 0.4 + row * 0.49 + 0.22;
      const index = row + (side === -1 ? letters.length : 0), col = index % 8, atlasRow = Math.floor(index / 8);
      const u0 = col / 8, u1 = (col + 1) / 8, v0 = 1 - (atlasRow + 1) / 3, v1 = 1 - atlasRow / 3;
      const start = positions.length / 3, width = 0.112, height = 0.18;
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        positions.push(x + face * dx * width / 2, y + dy * height / 2, z + face * (L.caseThickness / 2 + 0.004));
        normals.push(0, 0, face);
      }
      uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  const material = new THREE.MeshStandardMaterial({map, transparent: true, alphaTest: 0.25, depthWrite: false, roughness: 0.9});
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'Photographic lower shelf letter marks';
  mesh.receiveShadow = true;
  mesh.userData = {fidelity: 'observed-letterforms-estimated-repeated-placement',
    sequence: ['a-i', 'aa-ii'], font: 'Georgia approximation', isHistoricalScenery: true};
  root.add(mesh);
}
