import * as THREE from 'three';

/** Photo-based moulded timber section; dimensions are estimates for the adapted hall. */
export function createLongRoomVaultRib(radius: number, spring: number) {
  // Axial offset and inward depth: stepped shoulders frame a recessed fascia.
  const profile = [
    [-0.20, 0], [-0.20, 0.055], [-0.195, 0.075], [-0.18, 0.085],
    [-0.155, 0.085], [-0.15, 0.145], [-0.145, 0.165], [-0.13, 0.18],
    [-0.11, 0.185], [-0.09, 0.18], [-0.075, 0.165], [-0.07, 0.145],
    [0.07, 0.145], [0.075, 0.165], [0.09, 0.18], [0.11, 0.185],
    [0.13, 0.18], [0.145, 0.165], [0.15, 0.145], [0.155, 0.085],
    [0.18, 0.085], [0.195, 0.075], [0.20, 0.055], [0.20, 0],
  ];
  const positions: number[] = [], normals: number[] = [], uv: number[] = [], indices: number[] = [];
  const segments = 96;
  let alongProfile = 0;
  for (let edge = 0; edge < profile.length; edge++) {
    const [z0, d0] = profile[edge], [z1, d1] = profile[(edge + 1) % profile.length];
    const dz = z1 - z0, dd = d1 - d0, length = Math.hypot(dz, dd);
    const start = positions.length / 3;
    for (let step = 0; step <= segments; step++) {
      const a = Math.PI * step / segments, c = Math.cos(a), s = Math.sin(a);
      for (const [z, depth, u] of [[z0, d0, alongProfile], [z1, d1, alongProfile + length]]) {
        positions.push(c * (radius - depth), spring + s * (radius - depth), z);
        normals.push(-c * dz / length, -s * dz / length, -dd / length);
        uv.push(u / 0.6, a * radius / 2.8);
      }
      if (step < segments) {
        const i = start + step * 2; indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      }
    }
    alongProfile += length;
  }
  const capTriangles = THREE.ShapeUtils.triangulateShape(profile.map(([z, d]) => new THREE.Vector2(z, d)), []);
  for (const side of [-1, 1]) {
    const start = positions.length / 3;
    for (const [z, depth] of profile) {
      positions.push(side * (radius - depth), spring, z); normals.push(0, -1, 0); uv.push(z / 0.6, depth / 0.6);
    }
    for (const [a, b, c] of capTriangles) {
      // Both spring ends face down into their supporting joinery.
      const [za, da] = profile[a], [zb, db] = profile[b], [zc, dc] = profile[c];
      const normalY = side * ((zb - za) * (da - dc) - (zc - za) * (da - db));
      indices.push(start + a, start + (normalY < 0 ? b : c), start + (normalY < 0 ? c : b));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  return geometry;
}
