import * as THREE from 'three';
import { buildExteriorV6 } from './exterior-v6.js';
import { buildDoubleRoofV6, upperRoofSurfaceHeight as roofSurfaceHeight } from './roof-v6.js';

/**
 * Guanwen Library II — original Ming-inspired, two-storey palace shell.
 * Metres, Y up, principal entrance at +X. Lower body 44 × 62 m, upper body 36 × 52 m.
 * The lower encircling roof is open over the actual upper floor. Gallery datum 6.3 m.
 * All floor openings and stair geometry use the same constants as navigation.
 */
const UPPER_Y = 6.3;
const COLUMN_Z = [-21, -14, -7, 0, 7, 14, 21];
const ATRIUM_X = 6.30;
const ATRIUM_RAIL_X = 6.48;
const STAIR_WIDTH = 4.4;
const ROOF_THICKNESS = .22;
const STAIR_HOLES = [
  { minX: -15.95, maxX: -11.25, minZ: 8.5, maxZ: 21.5 },
  { minX: 11.25, maxX: 15.95, minZ: 8.5, maxZ: 21.5 },
];
const GEOMETRY = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 28),
  fineCylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
  octagon: new THREE.CylinderGeometry(1, 1, 1, 8),
  sphere: new THREE.SphereGeometry(1, 16, 10),
  plane: new THREE.PlaneGeometry(1, 1),
};

function random(seed = 5813) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}

function texture(width, height, paint, repeat) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

function timberTexture() {
  const r = random();
  return texture(256, 512, (c, w, h) => {
    c.fillStyle = '#b7a18a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1000; i++) {
      const x = r() * w, light = r() > .6;
      c.strokeStyle = `rgba(${light ? '255,235,203' : '47,28,15'},${.015 + r() * .07})`;
      c.lineWidth = .3 + r() * 1.2; c.beginPath(); c.moveTo(x, 0);
      for (let y = 0; y <= h; y += 8) c.lineTo(x + Math.sin(y * .012 + i * .73) * (2 + r() * 1.5), y);
      c.stroke();
    }
  });
}

function brickTexture() {
  const r = random(702);
  return texture(1024, 1024, (c, w, h) => {
    c.fillStyle = '#61615b'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = Math.floor(r() * 9); c.fillStyle = `rgb(${116 + v},${115 + v},${104 + v})`;
      c.fillRect(x * 256 + 2, y * 256 + 2, 252, 252);
      c.strokeStyle = 'rgba(225,218,195,.13)'; c.lineWidth = 1;
      c.strokeRect(x * 256 + 3, y * 256 + 3, 250, 250);
    }
    for (let i = 0; i < 65000; i++) {
      c.fillStyle = r() > .5 ? `rgba(245,235,210,${r() * .065})` : `rgba(35,36,31,${r() * .075})`;
      c.fillRect(r() * w, r() * h, .3 + r() * 1.7, .3 + r() * 1.7);
    }
  }, [7.5, 11]);
}

function plankTexture() {
  const r = random(8009);
  return texture(512, 512, (c, w, h) => {
    c.fillStyle = '#7a5b3d'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < 8; x++) {
      const v = r() * 17; c.fillStyle = `rgb(${135 + v},${104 + v},${68 + v})`; c.fillRect(x * 64 + 1, 0, 62, h);
      c.fillStyle = 'rgba(32,20,10,.25)'; c.fillRect(x * 64, 0, 1, h);
      const joint = (x % 3) * 153 + 43; c.fillRect(x * 64, joint, 64, 1);
      for (let k = 0; k < 28; k++) {
        c.strokeStyle = `rgba(54,29,9,${r() * .1})`; c.lineWidth = .5; c.beginPath();
        const xx = x * 64 + r() * 64; c.moveTo(xx, 0);
        for (let y = 0; y <= h; y += 16) c.lineTo(xx + Math.sin(y * .018 + k) * 2, y);
        c.stroke();
      }
    }
  }, [6, 9]);
}

function inscription(text, vertical = false) {
  const w = vertical ? 192 : 1536, h = vertical ? 1024 : 320;
  return texture(w, h, (c) => {
    c.fillStyle = '#283d34'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c0a56a'; c.lineWidth = vertical ? 7 : 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.lineWidth = 2; c.strokeRect(26, 26, w - 52, h - 52);
    c.fillStyle = '#dbc48c'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const chars = [...text]; c.font = `${vertical ? 92 : 190}px MingSerif, 'Songti SC', serif`;
    chars.forEach((ch, i) => c.fillText(ch, vertical ? w / 2 : w * (i + 1) / (chars.length + 1), vertical ? h * (i + 1) / (chars.length + 1) : h * .53));
  });
}

class Batch {
  constructor(group) { this.group = group; this.records = new Map(); this.object = new THREE.Object3D(); }
  add(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], cast = true) {
    const key = `${geometry.uuid}/${material.uuid}/${cast}`;
    if (!this.records.has(key)) this.records.set(key, { geometry, material, cast, matrices: [] });
    this.object.position.set(...position); this.object.rotation.set(...rotation); this.object.scale.set(...scale); this.object.updateMatrix();
    this.records.get(key).matrices.push(this.object.matrix.clone());
  }
  box(m, x, y, z, w, h, d, ry = 0, rz = 0) { this.add(GEOMETRY.box, m, [x, y, z], [w, h, d], [0, ry, rz]); }
  cylinder(m, x, y, z, r, h) { this.add(GEOMETRY.cylinder, m, [x, y, z], [r, h, r]); }
  rod(m, a, b, radius = .04) {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), length = p.distanceTo(q);
    const mid = p.clone().add(q).multiplyScalar(.5), quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.sub(p).normalize());
    const e = new THREE.Euler().setFromQuaternion(quat);
    this.add(radius < .04 ? GEOMETRY.fineCylinder : GEOMETRY.cylinder, m, mid.toArray(), [radius, length, radius], [e.x, e.y, e.z]);
  }
  finish(name) {
    let count = 0;
    for (const { geometry, material, cast, matrices } of this.records.values()) {
      const im = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((mat, i) => im.setMatrixAt(i, mat)); im.instanceMatrix.needsUpdate = true;
      im.castShadow = cast; im.receiveShadow = true; im.name = `${name}_${material.name}_${matrices.length}`;
      im.computeBoundingBox(); im.computeBoundingSphere(); this.group.add(im); count += matrices.length;
    }
    return count;
  }
}

function addMesh(group, name, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...position); mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}

function cloudBracket() {
  const s = new THREE.Shape(); s.moveTo(-.88, .12); s.lineTo(.88, .12); s.lineTo(.86, -.02);
  s.bezierCurveTo(.72, -.02, .73, -.18, .59, -.17); s.bezierCurveTo(.49, -.16, .57, -.36, .38, -.33);
  s.bezierCurveTo(.27, -.32, .35, -.48, .16, -.49); s.lineTo(-.16, -.49);
  s.bezierCurveTo(-.35, -.48, -.27, -.32, -.38, -.33); s.bezierCurveTo(-.57, -.36, -.49, -.16, -.59, -.17);
  s.bezierCurveTo(-.73, -.18, -.72, -.02, -.86, -.02); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: .23, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 2, steps: 1, curveSegments: 9 });
  g.translate(0, 0, -.115); return g;
}

function baseGeometry() {
  const p = [[1.6, 0], [1.6, .08], [1.47, .11], [1.39, .16], [1.28, .31], [1.16, .39], [1.04, .43]];
  return new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 28);
}

function decoratedBeam(batch, m, x, y, z, width, alongZ = false, fascia = false) {
  const h = fascia ? .44 : .56, d = fascia ? .24 : .54;
  if (alongZ) {
    batch.box(m.red, x, y, z, d, h + .20, width);
    for (const s of [-1, 1]) {
      batch.box(m.teal, x + s * (d / 2 + .012), y, z, .035, h, width - .10);
      for (const yy of [-h * .40, h * .40]) batch.box(m.gold, x + s * (d / 2 + .036), y + yy, z, .016, .027, width - .23);
      for (let zz = -width / 2 + .62; zz < width / 2 - .30; zz += 1.24) {
        batch.add(GEOMETRY.box, m.gold, [x + s * (d / 2 + .040), y, z + zz], [.015, .15, .15], [Math.PI / 4, 0, 0]);
      }
    }
  } else {
    batch.box(m.red, x, y, z, width, h + .20, d);
    for (const s of [-1, 1]) {
      batch.box(m.teal, x, y, z + s * (d / 2 + .012), width - .10, h, .035);
      for (const yy of [-h * .40, h * .40]) batch.box(m.gold, x, y + yy, z + s * (d / 2 + .036), width - .23, .027, .016);
      for (let xx = -width / 2 + .62; xx < width / 2 - .30; xx += 1.24) batch.box(m.gold, x + xx, y, z + s * (d / 2 + .040), .15, .15, .015, 0, Math.PI / 4);
    }
  }
}

function lantern(batch, m, x, y, z, hangFrom, lanterns, scale = 1) {
  const r = .39 * scale, h = .91 * scale;
  batch.rod(m.bronze, [x, y + h / 2, z], [x, hangFrom, z], .018);
  batch.add(GEOMETRY.octagon, m.paper, [x, y, z], [r, h, r], [0, Math.PI / 8, 0], false);
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + Math.PI / 8;
    batch.cylinder(m.dark, x + Math.cos(a) * r, y, z + Math.sin(a) * r, .022 * scale, h + .06);
  }
  for (const sign of [-1, 1]) {
    batch.add(GEOMETRY.octagon, m.dark, [x, y + sign * (h / 2 + .026), z], [r + .04, .06, r + .04], [0, Math.PI / 8, 0]);
    batch.add(GEOMETRY.octagon, m.gold, [x, y + sign * (h / 2 + .078), z], [r * .82, .028, r * .82], [0, Math.PI / 8, 0]);
  }
  batch.cylinder(m.red, x, y - h / 2 - .31, z, .024, .40);
  batch.add(GEOMETRY.sphere, m.red, [x, y - h / 2 - .52, z], [.057, .105, .057]);
  lanterns.push([x, y, z]);
}

/** A single newel is shared by every rail run that ends at the same joint. */
function railPost(batch, m, x, y, z, registry) {
  const key = [x, y, z].map(v => v.toFixed(4)).join('/');
  if (registry?.has(key)) return key;
  if (registry) registry.set(key, { id: key, x, y, z, radius: .105, minY: y + .01, maxY: y + 1.346 });
  batch.box(m.red, x, y + .60, z, .14, 1.18, .14);
  batch.box(m.dark, x, y + 1.19, z, .20, .07, .20);
  batch.add(GEOMETRY.octagon, m.wood, [x, y + 1.26, z], [.105, .07, .105]);
  batch.add(GEOMETRY.sphere, m.gold, [x, y + 1.31, z], [.034, .036, .034]);
  return key;
}

/** Flat rail panels stop at the faces of their posts rather than crossing them. */
function rail(batch, m, a, b, y, obstacles, options = {}) {
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]); if (width < .16) return;
  const alongX = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
  const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
  const put = (offset, yy, w, h, d, material, rz = 0) => {
    if (alongX) batch.box(material, cx + offset, y + yy, cz, w, h, d, 0, rz);
    else batch.box(material, cx, y + yy, cz + offset, d, h, w, 0, 0);
  };
  const bays = Math.max(1, Math.round(width / 1.34)), unit = width / bays, posts = [];
  for (let i = 0; i <= bays; i++) {
    const off = -width / 2 + i * unit;
    posts.push(railPost(batch, m, alongX ? cx + off : cx, y, alongX ? cz : cz + off, options.postRegistry));
  }
  for (let i = 0; i < bays; i++) {
    const off = -width / 2 + (i + .5) * unit, clear = Math.max(.03, unit - .145);
    put(off, .15, clear, .16, .18, m.dark);
    put(off, 1.03, clear, .11, .18, m.wood);
    put(off, 1.10, clear, .055, .22, m.red);
    put(off, .85, clear, .047, .095, m.wood);
    put(off, .32, clear, .047, .095, m.wood);
    put(off, .163, clear, .022, .205, m.gold);
    if (clear < .36) continue;
    for (const dx of [-clear * .30, clear * .30]) put(off + dx, .585, .033, .55, .055, m.wood);
    put(off, .585, clear * .44, .035, .055, m.wood);
    for (const dy of [.43, .74]) put(off, dy, clear * .46, .035, .055, m.wood);
    for (const dx of [-clear * .22, clear * .22]) put(off + dx, .585, .031, .34, .055, m.wood);
    const x = alongX ? cx + off : cx, z = alongX ? cz : cz + off;
    if (alongX) batch.box(m.gold, x, y + .585, z + .012, .085, .085, .028, 0, Math.PI / 4);
    else batch.add(GEOMETRY.box, m.gold, [x + .012, y + .585, z], [.028, .085, .085], [Math.PI / 4, 0, 0]);
  }
  const record = { id: options.id || 'rail-' + (options.segments?.length || 0), a: [...a], b: [...b], y, halfWidth: .11,
    minX: Math.min(a[0], b[0]) - .11, maxX: Math.max(a[0], b[0]) + .11,
    minZ: Math.min(a[1], b[1]) - .11, maxZ: Math.max(a[1], b[1]) + .11,
    minY: y, maxY: y + 1.40, type: 'balustrade', posts };
  options.segments?.push(record);
  if (options.collision !== false) obstacles.push({ ...record });
}

function caisson(batch, m, group, z, radius = 3.2) {
  const baseY = 14.55, tiers = 5, panelMaterial = m.teal.clone(); panelMaterial.side = THREE.DoubleSide; panelMaterial.name = 'Caisson_Panels';
  const panelVertices = [], panelIndices = [];
  for (let level = 0; level < tiers; level++) {
    const r = radius - level * .42, y = baseY + level * .36;
    for (let i = 0; i < 8; i++) {
      const angle = (i + .5) * Math.PI / 4, edge = 2 * r * Math.sin(Math.PI / 8), centerR = r * Math.cos(Math.PI / 8);
      batch.box(level % 2 ? m.red : m.teal, Math.cos(angle) * centerR, y, z + Math.sin(angle) * centerR, edge, .19, .18, -angle + Math.PI / 2);
      batch.box(m.gold, Math.cos(angle) * centerR, y - .101, z + Math.sin(angle) * centerR, edge, .022, .20, -angle + Math.PI / 2);
      if (level < tiers - 1) {
        const a0 = i * Math.PI / 4, a1 = (i + 1) * Math.PI / 4, r1 = r - .42, y1 = y + .36, k = panelVertices.length / 3;
        panelVertices.push(Math.cos(a0) * r, y, z + Math.sin(a0) * r, Math.cos(a1) * r, y, z + Math.sin(a1) * r, Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1, Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1);
        panelIndices.push(k, k + 1, k + 2, k, k + 2, k + 3);
        batch.rod(m.gold, [Math.cos(a0) * r, y - .035, z + Math.sin(a0) * r], [Math.cos(a0) * r1, y1 - .035, z + Math.sin(a0) * r1], .018);
      }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(panelVertices, 3)); geo.setIndex(panelIndices); geo.computeVertexNormals(); addMesh(group, 'Caisson_Continuous_Infill', geo, panelMaterial);
  const topR = radius - (tiers - 1) * .42;
  batch.add(GEOMETRY.octagon, m.blue, [0, baseY + 1.5, z], [topR, .12, topR], [0, Math.PI / 8, 0]);
  batch.add(GEOMETRY.octagon, m.gold, [0, baseY + 1.42, z], [.25, .05, .25], [0, Math.PI / 8, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4; batch.add(GEOMETRY.sphere, m.gold, [Math.cos(a) * .57, baseY + 1.42, z + Math.sin(a) * .57], [.16, .035, .25], [0, -a, 0]);
  }
  for (const s of [-1, 1]) {
    batch.box(m.red, s * radius * .94, baseY - .2, z, .22, .26, 7.4);
    batch.box(m.red, 0, baseY - .2, z + s * radius * .94, radius * 1.95, .26, .22);
  }
}

/** Consolidate repeated window frames after their local orientation is resolved. */
function consolidate(group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(), entries = new Map(), instance = new THREE.Matrix4();
  group.traverse(o => {
    if (!o.isMesh) return;
    const key = `${o.geometry.uuid}/${o.material.uuid}/${o.castShadow}/${o.receiveShadow}`;
    if (!entries.has(key)) entries.set(key, { geometry: o.geometry, material: o.material, cast: o.castShadow, receive: o.receiveShadow, matrices: [] });
    const matrices = entries.get(key).matrices, world = inverse.clone().multiply(o.matrixWorld);
    if (o.isInstancedMesh) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, instance); matrices.push(world.clone().multiply(instance)); }
    else matrices.push(world);
  });
  group.clear();
  for (const { geometry, material, cast, receive, matrices } of entries.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.name = `Envelope_${material.name}_${matrices.length}`;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
  }
}

export function buildArchitectureV2({ paintTexture = null } = {}) {
  const group = new THREE.Group(); group.name = 'MingLibraryV2_Architecture';
  const makeGroup = name => { const g = new THREE.Group(); g.name = name; group.add(g); return g; };
  const structure = makeGroup('01_TwoStorey_Columns_Beams');
  const envelope = makeGroup('02_Walls_And_Lattice_Windows');
  const upperFloor = makeGroup('03_Upper_Gallery_And_Balustrade');
  const ceiling = makeGroup('04_Rafters_Caissons_And_Timber_Ceiling');
  const roof = makeGroup('05_Double_Hipped_Glazed_Roofs');
  const staircase = makeGroup('06_Twin_Staircases');
  const details = makeGroup('07_Plaques_And_Lanterns');
  const timber = timberTexture();
  const make = (name, color, options = {}) => { const mat = new THREE.MeshStandardMaterial({ color, roughness: .72, ...options }); mat.name = name; return mat; };
  const m = {
    red: make('Aged_Vermilion', 0x7c352a, { map: timber, roughness: .49 }),
    redLight: make('Vermilion_Endgrain', 0x9d5140, { map: timber, roughness: .56 }),
    wood: make('Warm_Walnut', 0x785235, { map: timber, roughness: .53 }),
    dark: make('Dark_Joinery', 0x352b22, { map: timber }),
    teal: make('Mineral_Green', 0x3e6157), blue: make('Mineral_Blue', 0x344d53),
    gold: make('Muted_Gilt', 0xb89b5c, { metalness: .38, roughness: .55 }),
    bronze: make('Patinated_Bronze', 0x6a6546, { metalness: .62, roughness: .59 }),
    stone: make('Grey_Limestone', 0xa6a391, { roughness: .93 }),
    plaster: make('Ivory_Lime_Plaster', 0xd3c9af, { roughness: .96 }),
    paper: make('Lantern_Silk', 0xffe5b6, { emissive: 0xffbd67, emissiveIntensity: .45, roughness: .86 }),
    window: make('Lattice_Translucent_Paper', 0xece1c3, { emissive: 0xe9cda0, emissiveIntensity: .18, side: THREE.DoubleSide, roughness: .95 }),
  };
  const sb = new Batch(structure), wb = new Batch(envelope), fb = new Batch(upperFloor), cb = new Batch(ceiling), rb = new Batch(roof), tb = new Batch(staircase), db = new Batch(details);
  const obstacles = [], lanterns = [], galleryRects = [], landingRects = [], railSegments = [], columnFootprints = [], galleryBeamSegments = [];
  const railPosts = new Map();
  const railing = (batch, a, b, y, options = {}) => rail(batch, m, a, b, y, obstacles, { ...options, postRegistry: railPosts, segments: railSegments });
  const floorMat = make('Large_Grey_Floor_Brick', 0xffffff, { map: brickTexture(), roughness: .76 });
  const galleryMat = make('Gallery_Timber_Planks', 0xe1c99e, { map: plankTexture(), roughness: .67 });
  const floor = addMesh(group, '00_Ground_Stone_Floor', new THREE.BoxGeometry(48.4, .34, 66.4), floorMat, [0, -.17, 0]);
  floor.userData.floorY = 0;
  sb.box(m.stone, 0, -.50, 0, 48.8, .32, 66.8);
  sb.box(m.stone, 0, -.755, 0, 49.2, .19, 67.2);
  for (const x of [-1.9, 1.9]) sb.box(m.stone, x, .007, 0, .035, .013, 51.5);
  for (const z of [-24.4, 24.4]) sb.box(m.stone, 0, .007, z, 3.84, .013, .035);

  // Gallery is built as exact rectangles around the atrium and two staircase holes.
  const floorRect = (minX, maxX, minZ, maxZ) => {
    galleryRects.push({ minX, maxX, minZ, maxZ, y: UPPER_Y });
    const material = galleryMat.clone(); material.name = 'Gallery_Planks_' + galleryRects.length;
    if (galleryMat.map) { material.map = galleryMat.map.clone(); material.map.repeat.set((maxX - minX) / 2, (maxZ - minZ) / 8); }
    fb.box(material, (minX + maxX) / 2, UPPER_Y - .17, (minZ + maxZ) / 2, maxX - minX, .34, maxZ - minZ);
    fb.box(m.dark, (minX + maxX) / 2, UPPER_Y - .355, (minZ + maxZ) / 2, maxX - minX, .045, maxZ - minZ);
  };
  for (const side of [-1, 1]) {
    if (side > 0) {
      floorRect(ATRIUM_X, 18, -26, 8.5);
      floorRect(ATRIUM_X, 11.25, 8.5, 21.5);
      floorRect(15.95, 18, 8.5, 21.5);
      floorRect(ATRIUM_X, 18, 21.5, 26);
    } else {
      floorRect(-18, -ATRIUM_X, -26, 8.5);
      floorRect(-18, -15.95, 8.5, 21.5);
      floorRect(-11.25, -ATRIUM_X, 8.5, 21.5);
      floorRect(-18, -ATRIUM_X, 21.5, 26);
    }
  }
  floorRect(-ATRIUM_X, ATRIUM_X, -26, -17);
  floorRect(-ATRIUM_X, ATRIUM_X, 17, 26);
  upperFloor.userData = { floorY: UPPER_Y, atrium: { minX: -ATRIUM_X, maxX: ATRIUM_X, minZ: -17, maxZ: 17 }, galleryRects, stairHoles: STAIR_HOLES.map(h => ({ ...h })) };

  // Gallery beams are explicitly cut at the stairwell borders. A full-width
  // joist may not bridge the upper flight or lower its headroom.
  const galleryBox = (material, x, y, z, w, h, d, name = 'gallery-beam') => {
    let spans = [[x - w / 2, x + w / 2]];
    for (const hole of STAIR_HOLES) {
      if (z + d / 2 <= hole.minZ || z - d / 2 >= hole.maxZ) continue;
      spans = spans.flatMap(([lo, hi]) => {
        if (hi <= hole.minX || lo >= hole.maxX) return [[lo, hi]];
        return [[lo, Math.min(hi, hole.minX - .02)], [Math.max(lo, hole.maxX + .02), hi]].filter(([a, b]) => b - a > .03);
      });
    }
    for (const [lo, hi] of spans) {
      sb.box(material, (lo + hi) / 2, y, z, hi - lo, h, d);
      galleryBeamSegments.push({ name, minX: lo, maxX: hi, minZ: z - d / 2, maxZ: z + d / 2, minY: y - h / 2, maxY: y + h / 2 });
    }
  };
  for (const x of [-ATRIUM_X, ATRIUM_X]) decoratedBeam(fb, m, x, 5.86, 0, 34.0, true, true);
  for (const z of [-17, 17]) decoratedBeam(fb, m, 0, 5.86, z, ATRIUM_X * 2, false, true);
  for (const x of [-7.2, 7.2, -17.7, 17.7]) galleryBox(m.red, x, 5.85, 0, .43, .56, 52.0, 'longitudinal-support');
  for (const z of COLUMN_Z) {
    for (const side of [-1, 1]) {
      galleryBox(m.red, side * 12.45, 5.82, z, 10.65, .60, .34, 'cross-support');
      galleryBox(m.wood, side * 12.45, 5.63, z + .24, 10.5, .14, .09, 'cross-support-moulding');
      for (const offset of [-2.25, 0, 2.25]) {
        const jz = z + offset;
        if (Math.abs(jz) < 25.8) galleryBox(m.dark, side * 12.45, 5.92, jz, 10.5, .21, .13, 'gallery-joist');
      }
    }
  }
  // The open joist ends meet a continuous stairwell trimmer, never a hanging cut.
  for (const hole of STAIR_HOLES) {
    for (const x of [hole.minX - .12, hole.maxX + .12]) galleryBox(m.red, x, 5.86, 15.0, .20, .55, 13.44, 'stairwell-trimmer');
    for (const z of [hole.minZ - .12, hole.maxZ + .12]) galleryBox(m.red, (hole.minX + hole.maxX) / 2, 5.86, z, hole.maxX - hole.minX + .44, .55, .20, 'stairwell-header');
  }

  const cloud = cloudBracket(), plinth = baseGeometry();
  let columns = 0;
  for (const x of [-17.7, -7.2, 7.2, 17.7]) {
    // The long-side entrance axis reaches the atrium without a column in its
    // centre. Flanking supports carry continuous transfer beams above it.
    const columnZ = x === 17.7 ? [-21, -14, -5.7, 5.7, 14, 21]
      : x === 7.2 ? [-21, -14, -7, -3.5, 3.5, 7, 14, 21] : COLUMN_Z;
    for (const z of columnZ) {
    const main = Math.abs(x) < 10, radius = main ? .35 : .285;
    for (const level of [0, 1]) {
      const y = level ? UPPER_Y : 0, top = level ? 13.40 : 5.82, shaftBottom = y + .37;
      sb.add(plinth, m.stone, [x, y, z], [radius, 1, radius]);
      sb.cylinder(m.red, x, (shaftBottom + top) / 2, z, radius, top - shaftBottom);
      sb.cylinder(m.gold, x, y + .43, z, radius * 1.025, .028);
      sb.cylinder(m.redLight, x, top - .12, z, radius * 1.02, .10);
      sb.box(m.red, x, top + .04, z, radius * 2.4, .20, radius * 2.4);
      if (level) {
        for (let k = 0; k < 3; k++) {
          const yy = top + .18 + k * .19, span = .88 + k * .34;
          sb.box(k % 2 ? m.teal : m.red, x, yy, z, span, .17, .24);
          sb.box(k % 2 ? m.teal : m.red, x, yy + .085, z, .24, .17, span);
          for (const sign of [-1, 1]) {
            sb.box(m.gold, x + sign * (span / 2 - .13), yy + .12, z, .21, .025, .26);
            sb.box(m.redLight, x, yy + .19, z + sign * (span / 2 - .13), .28, .11, .24);
          }
        }
      }
      for (const angle of [0, Math.PI / 2]) sb.add(cloud, m.red, [x, top - .03, z], [main ? 1.2 : .95, 1, 1], [0, angle, 0]);
      const baseRadius = radius * 1.6;
      columnFootprints.push({ id: `column-${columns + 1}`, x, z, y, radius: baseRadius, shaftRadius: radius, baseRadius, baseHeight: .43, minY: y, maxY: top + .14 });
      obstacles.push({ minX: x - baseRadius, maxX: x + baseRadius, minZ: z - baseRadius, maxZ: z + baseRadius, minY: y, maxY: y + .43, type: 'columnBase' });
      obstacles.push({ minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius, minY: y + .43, maxY: level ? 14 : UPPER_Y, type: 'column' });
      columns++;
    }
    }
  }

  // Flanking portal columns meet new upper and gallery cross beams. These
  // remain above the 5.17 m doorway and outside the passage body volume.
  for (const z of [-3.5, 3.5]) {
    galleryBox(m.red, 12.45, 5.82, z, 10.65, .60, .34, 'entrance-transfer');
    decoratedBeam(sb, m, 12.48, 14.12, z, 10.12);
  }

  for (const x of [-17.7, -7.2, 7.2, 17.7]) decoratedBeam(sb, m, x, 14.10, 0, 52.1, true);
  for (const z of COLUMN_Z) {
    decoratedBeam(sb, m, 0, 14.12, z, 14.1);
    for (const side of [-1, 1]) decoratedBeam(sb, m, side * 12.48, 14.12, z, 10.12);
    // Hip-end trusses follow the real upper shell instead of retaining a
    // constant high ridge that would project through the sloping hip faces.
    const apex = roofSurfaceHeight(0, z) - .72;
    const tieY = Math.min(16.16, apex - .70);
    sb.rod(m.dark, [-7.1, 14.42, z], [0, apex, z], .15);
    sb.rod(m.dark, [0, apex, z], [7.1, 14.42, z], .15);
    sb.box(m.teal, 0, tieY, z, 5.9, .30, .29);
    sb.cylinder(m.red, 0, (tieY + .15 + apex) / 2, z, .12, apex - tieY - .15);
  }

  // Move the balustrade inward, keeping it on the slab and clear of the
  // 0.56m main-column plinths. Shared corner posts are generated exactly once.
  railing(fb, [-ATRIUM_RAIL_X, -17], [-ATRIUM_RAIL_X, 17], UPPER_Y, { id: 'atrium-west' });
  railing(fb, [ATRIUM_RAIL_X, -17], [ATRIUM_RAIL_X, 17], UPPER_Y, { id: 'atrium-east' });
  railing(fb, [-ATRIUM_RAIL_X, -17], [ATRIUM_RAIL_X, -17], UPPER_Y, { id: 'atrium-north' });
  railing(fb, [-ATRIUM_RAIL_X, 17], [ATRIUM_RAIL_X, 17], UPPER_Y, { id: 'atrium-south' });
  for (const x of [-17.96, 17.96]) fb.box(m.dark, x, 6.44, 0, .07, .28, 52);

  const stairs = [], stairZones = [];
  const makeFlight = (zone, label, bottomZ, topZ, bottomY, topY) => {
    const { minX, maxX, id: staircaseId } = zone, cx = (minX + maxX) / 2;
    const flight = { id: `${staircaseId}-${label}`, staircaseId, minX, maxX, minZ: topZ, maxZ: bottomZ,
      bottomZ, topZ, bottomY, topY, steps: 18 };
    stairs.push(flight);
    const rise = (topY - bottomY) / flight.steps, run = (bottomZ - topZ) / flight.steps;
    for (let i = 0; i < flight.steps; i++) {
      const top = bottomY + (i + 1) * rise, z = bottomZ - (i + .5) * run;
      tb.box(m.wood, cx, top - .08, z, STAIR_WIDTH, .16, run);
      // Close only the 15 mm gap below the solid 160 mm tread. A full-rise
      // riser would duplicate the tread's exposed front and upper surfaces.
      const riserHeight = rise - .16;
      tb.box(m.dark, cx, top - .16 - riserHeight / 2, z + run / 2 - .022, STAIR_WIDTH - .04, riserHeight, .044);
      // The nosing stands 3 mm proud; inset its ends by 2 mm so its side faces
      // also cannot lie in the tread's exposed side planes.
      tb.box(m.redLight, cx, top + .003 - .014, z + run / 2 - .004, STAIR_WIDTH - .004, .028, .050);
    }
    for (const x of [minX + .07, maxX - .07]) {
      tb.rod(m.dark, [x, bottomY + .10, bottomZ], [x, topY - .10, topZ], .105);
      tb.rod(m.red, [x, bottomY + 1.10, bottomZ], [x, topY + 1.10, topZ], .070);
      tb.rod(m.wood, [x, bottomY + .64, bottomZ], [x, topY + .64, topZ], .032);
      const postCount = 9;
      for (let i = 0; i <= postCount; i++) {
        const t = i / postCount, z = bottomZ + (topZ - bottomZ) * t, y = bottomY + (topY - bottomY) * t;
        railPost(tb, m, x, y, z, railPosts);
      }
      for (let i = 0; i < 12; i++) {
        const t0 = i / 12, t1 = (i + 1) / 12;
        const z0 = bottomZ + (topZ - bottomZ) * t0, z1 = bottomZ + (topZ - bottomZ) * t1;
        const y0 = bottomY + (topY - bottomY) * t0, y1 = bottomY + (topY - bottomY) * t1;
        obstacles.push({ minX: x - .105, maxX: x + .105, minZ: Math.min(z0, z1) - .025, maxZ: Math.max(z0, z1) + .025,
          minY: y0, maxY: y1 + 1.35, type: 'stairRail', staircaseId });
      }
    }
    return flight;
  };
  for (const side of [-1, 1]) {
    const minX = side < 0 ? -15.8 : 11.4, maxX = side < 0 ? -11.4 : 15.8, cx = (minX + maxX) / 2;
    const id = side < 0 ? 'west' : 'east';
    const zone = { id, minX, maxX, minZ: 8.5, maxZ: 21.5, minY: 0, maxY: UPPER_Y,
      width: STAIR_WIDTH, clearWidth: STAIR_WIDTH - .28, steps: 36,
      hole: { minX: minX - .15, maxX: maxX + .15, minZ: 8.5, maxZ: 21.5 },
      groundLanding: { minX: minX - .15, maxX: maxX + .15, minZ: 21.5, maxZ: 26, y: 0 },
      topLanding: { minX: minX - .15, maxX: maxX + .15, minZ: 5, maxZ: 8.5, y: UPPER_Y } };
    stairZones.push(zone);
    makeFlight(zone, 'lower', 21.5, 16.1, 0, 3.15);
    makeFlight(zone, 'upper', 13.9, 8.5, 3.15, UPPER_Y);
    const landing = { id: `${id}-mid-landing`, staircaseId: id, minX, maxX, minZ: 13.9, maxZ: 16.1, y: 3.15 };
    landingRects.push(landing);
    tb.box(m.wood, cx, 3.03, 15.0, STAIR_WIDTH, .24, 2.2);
    tb.box(m.dark, cx, 2.88, 15.0, STAIR_WIDTH - .06, .06, 2.16);
    for (const x of [minX + .15, maxX - .15]) for (const z of [14.05, 15.95]) {
      tb.box(m.red, x, 1.43, z, .20, 2.86, .20);
      tb.box(m.stone, x, .09, z, .30, .18, .30);
      obstacles.push({ minX: x - .15, maxX: x + .15, minZ: z - .15, maxZ: z + .15, minY: 0, maxY: 3.15, type: 'stairLandingSupport', staircaseId: id });
    }
    for (const x of [minX + .07, maxX - .07]) railing(tb, [x, 13.9], [x, 16.1], 3.15, { id: `${id}-landing-side-${x}` });
    const outerLeft = zone.hole.minX - .15, outerRight = zone.hole.maxX + .15;
    railing(fb, [outerLeft, 8.5], [outerLeft, 21.65], UPPER_Y, { id: `${id}-well-left` });
    railing(fb, [outerRight, 8.5], [outerRight, 21.65], UPPER_Y, { id: `${id}-well-right` });
    railing(fb, [outerLeft, 21.65], [outerRight, 21.65], UPPER_Y, { id: `${id}-well-end` });
    railing(fb, [outerLeft, 8.5], [minX + .07, 8.5], UPPER_Y, { id: `${id}-left-return` });
    railing(fb, [maxX - .07, 8.5], [outerRight, 8.5], UPPER_Y, { id: `${id}-right-return` });
    fb.box(m.wood, cx, UPPER_Y - .0175, 8.45, STAIR_WIDTH, .035, .10);
    const signMap = inscription('二層藏書');
    addMesh(details, side < 0 ? 'West_Stair_Sign' : 'East_Stair_Sign', new THREE.PlaneGeometry(1.05, .25), make(`Stair_Sign_${side}`, 0xffffff, { map: signMap }), [side * 15.98, UPPER_Y + .585, 9.1575], [0, -side * Math.PI / 2, 0]);
  }

  // Both envelope levels have different footprints, with the larger lower
  // portico supporting a separate encircling hipped roof.

  // Layered exposed roof timbers and three caissons unify the two-storey atrium.
  for (let z = -25.4; z <= 25.41; z += .66) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const x0 = side * i * 2.05, x1 = side * (i + 1) * 2.05;
        cb.rod(m.wood, [x0, roofSurfaceHeight(x0, z) - .42, z], [x1, roofSurfaceHeight(x1, z) - .42, z], .068);
      }
    }
  }
  for (const x of [-17.8, -14.2, -10.65, -7.1, -3.55, 0, 3.55, 7.1, 10.65, 14.2, 17.8]) {
    for (let j = 0; j < 32; j++) {
      const z0 = -24.8 + j * 1.55, z1 = -24.8 + (j + 1) * 1.55;
      cb.rod(m.red, [x, roofSurfaceHeight(x, z0) - .52, z0], [x, roofSurfaceHeight(x, z1) - .52, z1], .16);
    }
  }
  caisson(cb, m, ceiling, 0, 3.35); caisson(cb, m, ceiling, -14, 2.65); caisson(cb, m, ceiling, 14, 2.65);
  const doubleRoof = buildDoubleRoofV6({ roof, timberMaterial: m.wood });
  const roofShell = doubleRoof.upperShell;
  const exterior = buildExteriorV6({ envelope, roof, obstacles, paintTexture });
  envelope.userData.exterior = exterior.metadata;

  const plaque = (name, words, x, y, z, w, h, vertical = false) => {
    db.box(m.dark, x, y, z - .05, w + .16, h + .16, .22);
    db.box(m.gold, x, y, z + .075, w + .07, h + .07, .045);
    const material = make(name, 0xffffff, { map: inscription(words, vertical), roughness: .84 });
    addMesh(details, name, new THREE.PlaneGeometry(w, h), material, [x, y, z + .105]);
  };
  plaque('Guanwen_Main_Nameplate', '閣藏文觀', 0, 11.55, -25.91, 6.65, 1.35);
  plaque('First_Floor_Nameplate', '海書卷萬', 0, 4.70, -25.91, 3.45, .74);
  plaque('East_Inscription', '開卷通古今', 4.8, 9.6, -25.91, .56, 3.50, true);
  plaque('West_Inscription', '藏書納天地', -4.8, 9.6, -25.91, .56, 3.50, true);
  for (const side of [-1, 1]) for (const z of [-21, -7, 7, 21]) lantern(db, m, side * 10.0, 4.50, z, 5.90, lanterns, .90);
  for (const side of [-1, 1]) for (const z of [-17.5, -3.5, 10.5]) lantern(db, m, side * 10.0, 11.95, z, 14.0, lanterns, 1.0);
  for (const z of [-14, 14]) lantern(db, m, 0, 11.85, z, 14.35, lanterns, 1.20);

  let detailInstances = 0;
  for (const [b, name] of [[sb, 'Structure'], [wb, 'Envelope'], [fb, 'Gallery'], [cb, 'Ceiling'], [rb, 'Roof'], [tb, 'Stairs'], [db, 'Details']]) detailInstances += b.finish(name);
  consolidate(envelope);
  detailInstances = 0; group.traverse(o => { if (o.isInstancedMesh) detailInstances += o.count; });
  const groundRects = [{ minX: -24.2, maxX: 24.2, minZ: -33.2, maxZ: 33.2, y: 0 }];
  group.userData = { version: '4.0', style: 'Reference-led two-storey palace with double hipped roofs', entrance: '+X', units: 'metres', upperFloorY: UPPER_Y,
    width: 44, depth: 62, upperWidth: 36, upperDepth: 52, roofCount: 2, stairStepCount: 36, atriumHalfWidth: ATRIUM_X, stairWidth: STAIR_WIDTH };
  return { group, roof, roofShell, roofShells: doubleRoof.shells, lowerRoofShell: doubleRoof.lowerShell, doubleRoof, exterior,
    roofMetadata: { ...roofShell.geometry.userData }, ceiling, envelope, upperFloor, staircase, obstacles, stairs, stairZones, landingRects, lanterns, galleryRects, groundRects,
    railSegments, railPosts: [...railPosts.values()], columnFootprints, galleryBeamSegments, materials: m,
    stats: { floors: 2, width: 44, depth: 62, upperWidth: 36, upperDepth: 52, height: doubleRoof.stats?.height ?? 22.5, roofCount: 2, roofThickness: ROOF_THICKNESS,
      floorHeight: UPPER_Y, columns, exteriorColumns: exterior.metadata.columnCount, staircases: 2, stairFlights: stairs.length, stairWidth: STAIR_WIDTH, stepsPerStair: 36, landingDepth: 2.2,
      atriumWidth: ATRIUM_X * 2, exteriorWindowLeaves: exterior.metadata.windowLeaves, exteriorInstances: exterior.metadata.exteriorInstances,
      entranceSide: '+X', detailInstances, groundArea: 44 * 62, upperArea: 36 * 52 - ATRIUM_X * 2 * 34 - 2 * 4.7 * 13 },
  };
}

export { UPPER_Y };
