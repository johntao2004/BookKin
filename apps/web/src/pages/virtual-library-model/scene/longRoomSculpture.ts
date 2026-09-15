import * as THREE from 'three';
import { PALETTE } from '../config';
import type { LibraryMaterials } from './materials';
import { makeBox } from './parts';
import { createSwiftHeadGeometry } from './longRoomSwiftHead';
import { addSwiftEyes } from './longRoomSwiftEyes';

/** Proportional study for the bust row. Individual portrait likenesses still require scan/reference work. */
export function createLongRoomBust(materials: LibraryMaterials, variant: number,
  marble = new THREE.MeshStandardMaterial({ color: PALETTE.parchment, roughness: 0.84 }), portrait: 'generic' | 'swift' | 'shakespeare' = 'generic') {
  const swift = portrait === 'swift', shakespeare = portrait === 'shakespeare';
  const root = new THREE.Group(); root.name = `Marble bust proportional study ${variant}`;
  root.userData.fidelity = swift || shakespeare ? 'photo-derived-portrait-study' : 'proportional-study-not-portrait-scan';
  if (swift) {
    root.name = 'Jonathan Swift — photo-derived bust study';
    root.userData.reference = 'https://www.tcd.ie/swift350/';
    root.userData.sitter = 'Jonathan Swift'; root.userData.documentedStall = 'I';
  }
  if (shakespeare) {
    root.name = 'William Shakespeare — photo-derived bust study';
    root.userData.reference = 'https://arranqhenderson.com/wp-content/uploads/2013/09/shakespeare.jpg';
    root.userData.sitter = 'William Shakespeare'; root.userData.documentedStall = 'BB';
  }
  let target = root;
  for (const [y, width, height] of [[0.08, 0.61, 0.16], [0.71, 0.48, 1.1], [1.31, 0.62, 0.13]]) {
    root.add(makeBox(width, height, width * 0.86, materials.woodDark, 0, y, 0));
  }
  const stone = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geometry, marble); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; mesh.receiveShadow = true; target.add(mesh); return mesh;
  };
  if (swift || shakespeare) stone(createSwiftSocleGeometry(), 0, 0, 0).name = swift ? 'Swift flared rectangular socle' : 'Shakespeare flared rectangular socle';
  else {
    stone(new THREE.CylinderGeometry(0.17, 0.22, 0.07, 24), 0, 1.42, 0);
    stone(new THREE.CylinderGeometry(0.115, 0.16, 0.16, 24), 0, 1.52, 0);
  }
  // A tapered chest, broad shoulders and narrow collar instead of a sphere torso.
  const rings = swift ? [[1.58,0.16,0.1],[1.62,0.21,0.13],[1.72,0.32,0.16],
    [1.82,0.39,0.17],[1.89,0.31,0.15],[1.96,0.14,0.1],[1.99,0.095,0.08]] : [[1.58,0.13,0.1],[1.62,0.21,0.13],[1.7,0.3,0.16],
    [1.78,0.34,0.17],[1.83,0.28,0.15],[1.9,0.12,0.09],[1.92,0.095,0.08]];
  const mantlePositions: number[] = [], mantleIndices: number[] = [];
  const segments = 64;
  rings.forEach(([y, rx, rz], ring) => {
    for (let j=0;j<=segments;j++) {
      const angle=j*Math.PI*2/segments;
      const fold=1+0.055*Math.sin(angle*11+y*8)+0.022*Math.sin(angle*23-y*5);
      mantlePositions.push(Math.cos(angle)*rx*fold,y,Math.sin(angle)*rz*fold);
      if (ring>0 && j>0) {
        const q=ring*(segments+1)+j;
        mantleIndices.push(q,q-segments-2,q-1,q,q-segments-1,q-segments-2);
      }
    }
  });
  const torso=new THREE.BufferGeometry();
  torso.setAttribute('position',new THREE.Float32BufferAttribute(mantlePositions,3));
  torso.setIndex(mantleIndices); torso.computeVertexNormals();
  const torsoMesh = stone(torso,0,0,0); torsoMesh.name='Carved drapery mantle and shoulders';
  if (swift) { torsoMesh.scale.y = 1.22; torsoMesh.position.y = -1.58 * 0.22; }
  if (shakespeare) { torsoMesh.scale.y = 1.45; torsoMesh.position.y = -1.58 * 0.45; addShakespeareDress(root, marble); }
  stone(new THREE.CylinderGeometry(0.085, 0.105, 0.18, 20), 0, swift || shakespeare ? 2.03 : 1.88, -0.015);
  if (swift) {
    addSwiftDress(root, marble);
    target = new THREE.Group(); target.name = 'Swift head and soft cap'; target.rotation.y = -0.14; target.position.y = 0.45; target.scale.y = 0.88; root.add(target);
  }
  if (shakespeare) { target = new THREE.Group(); target.name = 'Shakespeare head and receding hair'; target.position.y = 0.23; target.rotation.y = -0.1; root.add(target); }
  const head = swift ? createSwiftHeadGeometry() : new THREE.SphereGeometry(1, shakespeare ? 80 : 40, shakespeare ? 64 : 32);
  const p = head.getAttribute('position');
  const gaussian = (x: number, y: number, cx: number, cy: number, w: number, h: number) => Math.exp(-(((x - cx) / w) ** 2 + ((y - cy) / h) ** 2));
  for (let i = 0; !swift && i < p.count; i++) {
    let x = p.getX(i); const y = p.getY(i); let z = p.getZ(i);
    x *= swift ? 0.88 + 0.12 * Math.max(y, 0) - 0.06 * Math.max(-y - 0.45, 0) : 0.82 + 0.14 * Math.max(y, 0);
    if (z > 0) {
      const relief = 0.4 * gaussian(x, y, 0, 0.03, 0.13, 0.3)
        + 0.22 * gaussian(x, y, 0, -0.17, 0.17, 0.1)
        - 0.2 * gaussian(x, y, -0.32, 0.17, 0.18, 0.13)
        - 0.2 * gaussian(x, y, 0.32, 0.17, 0.18, 0.13)
        + 0.1 * gaussian(x, y, 0, -0.48, 0.26, 0.065)
        - 0.08 * gaussian(x, y, 0, -0.55, 0.25, 0.04);
      z += relief;
      if (shakespeare) {
        // Carving stays in the continuous face surface instead of floating tubes/balls.
        z += 0.12 * gaussian(x, y, -0.32, 0.29, 0.23, 0.075)
          + 0.12 * gaussian(x, y, 0.32, 0.29, 0.23, 0.075)
          + 0.13 * gaussian(x, y, -0.23, -0.36, 0.24, 0.075)
          + 0.13 * gaussian(x, y, 0.23, -0.36, 0.24, 0.075)
          + 0.10 * gaussian(x, y, 0, -0.74, 0.48, 0.22)
          + 0.005 * Math.cos(x * 95) * gaussian(x, y, 0, -0.76, 0.5, 0.2);
      }
      if (swift) z += 0.17 * gaussian(x, y, 0, -0.73, 0.42, 0.18)
        + 0.13 * gaussian(x, y, 0, 0.02, 0.11, 0.42)
        + 0.08 * gaussian(x, y, -0.38, -0.08, 0.24, 0.2)
        + 0.08 * gaussian(x, y, 0.38, -0.08, 0.24, 0.2)
        - 0.05 * gaussian(x, y, -0.33, 0.04, 0.2, 0.05)
        - 0.05 * gaussian(x, y, 0.33, 0.04, 0.2, 0.05);
    }
    p.setXYZ(i, x, y, z);
  }
  head.computeVertexNormals();
  stone(head, 0, 2.08, 0, 0.17, swift ? 0.218 : shakespeare ? 0.235 : 0.235 + variant % 3 * 0.008, 0.16);
  for (const side of [-1, 1]) stone(new THREE.SphereGeometry(1, 12, 10), side * 0.148, 2.065, -0.01, 0.034, 0.067, 0.028);
  // Continuous scalp with carved waves. Detached bead rows produced an
  // artificial crown silhouette and did not follow the underlying skull.
  const hairPositions: number[] = [], hairIndices: number[] = [];
  const longHair = !swift && variant % 3 === 0;
  const rows=28, columns=64;
  for(let row=0;row<=rows;row++) for(let column=0;column<=columns;column++) {
    const a=shakespeare ? 0.85+column*(Math.PI*2-1.7)/columns : column*Math.PI*2/columns;
    const front=Math.max(0,Math.cos(a));
    const limit=front>0.1 ? 0.78+0.62*(1-front) : (swift ? 2.03 + 0.12 * Math.sin(a * 5) : longHair ? 2.18 : 1.65);
    const start=shakespeare ? 0.32+front*0.75 : 0.01;
    const theta=start+((shakespeare ? 2.0 : limit)-start)*row/rows;
    const wave=1+(shakespeare ? 0.009 : 0.03)*Math.sin(a*17+theta*9)+0.008*Math.sin(a*31-theta*6);
    hairPositions.push(Math.sin(a)*Math.sin(theta)*0.158*wave,
      2.08+Math.cos(theta)*0.25,
      Math.cos(a)*Math.sin(theta)*0.175*wave-0.012);
    if(row>0 && column>0) {
      const q=row*(columns+1)+column;
      hairIndices.push(q,q-columns-2,q-1,q,q-columns-1,q-columns-2);
    }
  }
  const hair=new THREE.BufferGeometry();
  hair.setAttribute('position',new THREE.Float32BufferAttribute(hairPositions,3));
  hair.setIndex(hairIndices); hair.computeVertexNormals();
  stone(hair,0,0,0).name='Continuous carved hair surface';
  if (swift) {
    addSwiftCap(target, marble);
    addSwiftEyes(target, head, marble);
  }
  if (shakespeare) addShakespeareEyes(target, marble);
  if (!swift && !shakespeare && variant % 4 === 2) stone(new THREE.SphereGeometry(1, 14, 12), 0, 1.94, 0.095, 0.11, 0.14, 0.07);
  return root;
}


function addSwiftCap(root: THREE.Group, material: THREE.Material) {
  // The photographic cap wraps down behind the ears, with a tall asymmetric
  // crown and a folded cloth band rather than a rigid circular brim.
  const columns = 80, rows = 40;
  const baseY = (angle: number) => 2.155 + 0.075 * Math.cos(angle) + 0.012 * Math.sin(angle * 2);
  const surface = (band: boolean) => {
    const positions: number[] = [], indices: number[] = [];
    const rowCount = band ? 8 : rows;
    for (let row = 0; row <= rowCount; row++) for (let col = 0; col <= columns; col++) {
      const t = row / rowCount, angle = col / columns * Math.PI * 2;
      const base = baseY(angle);
      const radius = band ? 1 + 0.045 * Math.sin(t * Math.PI) : Math.sqrt(Math.max(0, 1 - t * t));
      const folds = 1 + (band ? 0.012 : 0.065 * Math.sin(t * Math.PI)) * Math.sin(angle * 5 + t * 9)
        + (band ? 0.007 : 0.025 * Math.sin(t * Math.PI)) * Math.cos(angle * 9 - t * 6);
      const x = Math.sin(angle) * 0.188 * radius * folds + (band ? 0 : 0.045 * t * t);
      const y = band ? base - 0.023 + t * 0.064 : base + (2.49 - base) * t
        + 0.025 * Math.sin(angle * 3 + t * 8) * Math.sin(Math.PI * t);
      const z = Math.cos(angle) * 0.184 * radius * folds - 0.025 - (band ? 0 : 0.07 * Math.sin(t * Math.PI / 2));
      positions.push(x, y, z);
      if (row && col) {
        const q = row * (columns + 1) + col;
        indices.push(q, q - 1, q - columns - 2, q, q - columns - 2, q - columns - 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = band ? 'Swift folded cloth cap band' : 'Swift tall asymmetric soft cap';
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  };
  surface(false); surface(true);
}

function addSwiftDress(parent: THREE.Group, material: THREE.Material) {
  const root = new THREE.Group(); root.name = 'Swift robe and collar';
  root.scale.y = 1.22; root.position.y = -1.58 * 0.22; parent.add(root);
  for (const side of [-1, 1]) {
    const positions: number[] = [], indices: number[] = [];
    for (let row = 0; row <= 32; row++) for (let col = 0; col <= 8; col++) {
      const t = row / 32, u = col / 8 - 0.5;
      const y = Math.min(1.96, 1.62 + t * 0.34);
      const x = side * (0.045 + 0.13 * Math.sin(t * Math.PI) + 0.055 * t) + u * 0.055;
      const profile = [[1.62,0.21,0.13],[1.72,0.32,0.16],[1.82,0.39,0.17],[1.89,0.31,0.15],[1.96,0.14,0.1]];
      const index = Math.min(profile.length - 2, profile.findIndex((point, i) => i < profile.length - 1 && y <= profile[i + 1][0]));
      const a = profile[Math.max(0, index)], b = profile[Math.max(0, index) + 1];
      const blend = Math.min(1, (y - a[0]) / (b[0] - a[0]));
      const rx = a[1] + (b[1] - a[1]) * blend, rz = a[2] + (b[2] - a[2]) * blend;
      positions.push(x, y, Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) * rz + 0.021
        + 0.008 * Math.sin(t * Math.PI * 22 + u * 5) + 0.004 * Math.cos(u * Math.PI));
      if (row && col) { const q = row * 9 + col; indices.push(q, q - 1, q - 10, q, q - 10, q - 9); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const trim = new THREE.Mesh(geometry, material); trim.name = 'Swift carved robe border'; trim.castShadow = trim.receiveShadow = true; root.add(trim);
    const collar = new THREE.Shape(); collar.moveTo(side * 0.012, 2.015); collar.lineTo(side * 0.077, 2.005);
    collar.lineTo(side * 0.095, 1.865); collar.quadraticCurveTo(side * 0.043, 1.845, side * 0.019, 1.873); collar.closePath();
    const band = new THREE.Mesh(new THREE.ExtrudeGeometry(collar, {depth: 0.012, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.003, bevelThickness: 0.003, steps: 1}), material);
    const collarVertices = band.geometry.getAttribute('position');
    for (let i = 0; i < collarVertices.count; i++) {
      const t = THREE.MathUtils.smoothstep(collarVertices.getY(i), 1.865, 2.015);
      collarVertices.setZ(i, collarVertices.getZ(i) - t * 0.098);
    }
    band.geometry.computeVertexNormals();
    band.position.z = 0.165; band.name = 'Swift clerical collar band'; band.castShadow = band.receiveShadow = true; root.add(band);
  }
  for (let i = 0; i < 3; i++) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), material);
    button.position.set(0, 1.73 + i * 0.046, 0.163); button.name = 'Swift coat button'; root.add(button);
  }
}


function createSwiftSocleGeometry() {
  const profile = [[1.375,0.25],[1.4,0.25],[1.42,0.21],[1.47,0.175],[1.53,0.165],[1.565,0.2],[1.59,0.22]];
  const positions: number[] = [], indices: number[] = [];
  const columns = 32;
  profile.forEach(([y, radius], row) => {
    for (let column = 0; column <= columns; column++) {
      const a = column / columns * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      positions.push(Math.sign(c) * Math.sqrt(Math.abs(c)) * radius, y, Math.sign(s) * Math.sqrt(Math.abs(s)) * radius * 0.75);
      if (row && column) { const q = row * (columns + 1) + column; indices.push(q, q - columns - 2, q - 1, q, q - columns - 1, q - columns - 2); }
    }
  });
  for (const row of [0, profile.length - 1]) {
    const center = positions.length / 3; positions.push(0, profile[row][0], 0);
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      if (row === 0) indices.push(center, a, a + 1); else indices.push(center, a + 1, a);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}


function addShakespeareDress(root: THREE.Group, material: THREE.Material) {
  for (const side of [-1, 1]) {
    const collar = new THREE.Shape(); collar.moveTo(side * 0.015, 2.1); collar.lineTo(side * 0.09, 2.13);
    collar.lineTo(side * 0.15, 2.01); collar.lineTo(side * 0.075, 1.96); collar.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(collar, {depth: 0.014, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2}), material);
    mesh.position.z = 0.12; mesh.name = 'Shakespeare pointed falling collar'; root.add(mesh);
  }
  for (let i = 0; i < 6; i++) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), material);
    button.position.set(0, 1.76 + i * 0.045, 0.168); button.name = 'Shakespeare doublet button'; root.add(button);
  }
  const positions: number[] = [], indices: number[] = [];
  for (let row = 0; row <= 24; row++) for (let col = 0; col <= 48; col++) {
    const v = row / 24, t = col / 48, bend = Math.pow(2 * t - 1, 2);
    const lower = 1.61 + 0.29 * bend - 0.05 * t, upper = 2.015 - 0.13 * t - 0.19 * Math.sin(Math.PI * t);
    positions.push((-0.30 + 0.60 * t) * (1 - v) + (-0.16 + 0.40 * t) * v, lower + (upper - lower) * v,
      0.13 + 0.055 * Math.sin(t * Math.PI) + 0.016 * Math.sin(v * Math.PI * 5) * Math.sin(t * Math.PI));
    if (row && col) { const q = row * 49 + col; indices.push(q, q - 1, q - 50, q, q - 50, q - 49); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mantleMaterial = material.clone(); mantleMaterial.side = THREE.DoubleSide;
  const drape = new THREE.Mesh(geometry, mantleMaterial); drape.name = 'Shakespeare continuous sweeping mantle'; root.add(drape);
}

function addShakespeareEyes(root: THREE.Group, material: THREE.Material) {
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
    eye.position.set(side * 0.052, 2.115, 0.119); eye.scale.set(0.021, 0.007, 0.008);
    eye.name = 'Shakespeare inset carved eye'; root.add(eye);
    for (const upper of [false, true]) {
      const points = Array.from({length: 25}, (_, i) => {
        const t = i / 24;
        return new THREE.Vector3(side * 0.052 + (t - 0.5) * 0.044,
          2.115 + (upper ? 0.008 : -0.005) * Math.sin(Math.PI * t),
          0.120 + 0.009 * Math.sin(Math.PI * t));
      });
      const lid = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.0025, 8, false), material);
      lid.name = upper ? 'Shakespeare upper eyelid' : 'Shakespeare lower eyelid'; root.add(lid);
    }
  }
}
