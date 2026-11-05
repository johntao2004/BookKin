import * as THREE from 'three';

/**
 * Ming-inspired furniture, built in metres, Y up, fronts facing +Z.
 * The tall shelf assemblies are an original arrangement of two three-tier
 * open racks. They are not replicas of a surviving imperial bookcase.
 * All visible books are volumetric models. Repeated parts use GPU instancing.
 */

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  threadCylinder: new THREE.CylinderGeometry(1, 1, 1, 6),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  plane: new THREE.PlaneGeometry(1, 1),
  ring: new THREE.TorusGeometry(1, 0.14, 6, 16),
};
let materials;
const titleCache = new Map();
const TITLES = ['論語', '孟子', '詩經', '周易', '史記', '漢書', '文選', '本草綱目', '天工開物', '資治通鑑', '禮記', '大學'];
const COVER_COLORS = [0x243d53, 0x2b434a, 0x5a4335, 0x516255, 0x334d6b, 0x806b48, 0x584450, 0x66645c];

function canvasTexture(w, h, paint) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  paint(ctx, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function grainTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c3986c'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 240; i++) {
      const x = (i * 41.31) % w;
      ctx.strokeStyle = `rgba(${i % 3 ? '69,34,10' : '249,218,162'},${0.03 + (i % 6) * 0.014})`;
      ctx.lineWidth = i % 11 === 0 ? 2 : 0.7;
      ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = 0; y <= h; y += 16) ctx.lineTo(x + Math.sin(y * 0.022 + i * 0.7) * (2.5 + i % 7), y);
      ctx.stroke();
    }
  });
}

function paperTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d8c9a5'; ctx.fillRect(0, 0, w, h);
    for (let y = 1; y < h; y += 4) {
      ctx.fillStyle = y % 12 ? '#c6b993' : '#bbae8a';
      ctx.fillRect(0, y, w, 0.7);
    }
  });
}

function getMaterials() {
  if (materials) return materials;
  const grain = grainTexture();
  const page = paperTexture();
  materials = {
    wood: new THREE.MeshStandardMaterial({ color: 0x85502e, map: grain, roughness: 0.47, metalness: 0.025 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0xb27a46, map: grain, roughness: 0.45, metalness: 0.025 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x493021, map: grain, roughness: 0.54 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xaf8a43, roughness: 0.36, metalness: 0.72 }),
    pages: new THREE.MeshStandardMaterial({ color: 0xf4ead5, map: page, roughness: 0.94 }),
    thread: new THREE.MeshStandardMaterial({ color: 0xd6c6a2, roughness: 0.96 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x273b4d, roughness: 0.98 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xe5d8b9, roughness: 0.94, side: THREE.DoubleSide }),
    ink: new THREE.MeshStandardMaterial({ color: 0x202329, roughness: 0.36 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x64634c, roughness: 0.64, metalness: 0.6 }),
    porcelain: new THREE.MeshStandardMaterial({ color: 0xe0ded1, roughness: 0.25, metalness: 0.02 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x31516f, roughness: 0.37 }),
    covers: COVER_COLORS.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.91 })),
  };
  Object.entries(materials).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((v, i) => { v.name = `Book cloth ${i + 1}`; });
    else value.name = `Furniture ${key}`;
  });
  return materials;
}

function add(group, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], name = '') {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...(rotation || [0, 0, 0]));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = name;
  group.add(mesh); return mesh;
}
function box(group, mat, pos, size, rotation, name) {
  return add(group, G.box, mat, pos, size, rotation, name);
}
function cylinder(group, mat, pos, radius, height, rotation = [0, 0, 0]) {
  return add(group, G.cylinder, mat, pos, [radius, height, radius], rotation);
}
function rod(group, mat, a, b, r = 0.015) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const direction = vb.clone().sub(va);
  const geometry = r < 0.003 ? G.threadCylinder : G.cylinder;
  const mesh = add(group, geometry, mat, va.clone().add(vb).multiplyScalar(0.5).toArray(), [r, direction.length(), r]);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function getTitleMaterial(title) {
  if (titleCache.has(title)) return titleCache.get(title);
  const texture = canvasTexture(96, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ded1ae'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#978463'; ctx.lineWidth = 2; ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.strokeStyle = '#b2a386'; ctx.lineWidth = 1; ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#322f28'; ctx.font = '44px Silvae Serif, Noto Serif SC, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [...title].forEach((ch, i, arr) => ctx.fillText(ch, w / 2, 33 + i * Math.min(48, 184 / arr.length)));
    ctx.fillStyle = '#91694b'; ctx.fillRect(60, 218, 18, 18);
    ctx.fillStyle = '#e1ccb1'; ctx.font = '12px Silvae Serif, Noto Serif SC, serif'; ctx.fillText('藏', 69, 228);
  });
  const mat = new THREE.MeshStandardMaterial({ color: 0xf4e6c7, map: texture, roughness: 0.94, side: THREE.DoubleSide });
  mat.name = `Vertical title ${title}`;
  titleCache.set(title, mat); return mat;
}

/** A closed, four-hole thread-bound book, lying flat, top cover facing +Y. */
export function createBookModel(options = {}) {
  const {
    title = '論語', width = 0.43, depth = 0.51, thickness = 0.061,
    colorIndex = 0, withStitches = true,
  } = options;
  const m = getMaterials();
  const group = new THREE.Group(); group.name = `Thread-bound book · ${title}`;
  group.userData = { type: 'book', title, binding: 'four-hole thread binding', units: 'metres' };
  const cover = m.covers[((colorIndex % m.covers.length) + m.covers.length) % m.covers.length];
  const cy = thickness / 2;
  box(group, m.pages, [-0.003, cy, 0], [width - 0.019, thickness - 0.012, depth - 0.018], null, 'Folded paper block');
  box(group, cover, [0, 0.003, 0], [width, 0.006, depth], null, 'Lower cloth cover');
  box(group, cover, [0, thickness - 0.003, 0], [width, 0.006, depth], null, 'Upper cloth cover');
  box(group, cover, [width / 2 - 0.007, cy, 0], [0.014, thickness, depth], null, 'Bound edge');
  add(group, G.plane, getTitleMaterial(title), [-width * 0.25, thickness + 0.0008, -depth * 0.085], [width * 0.19, depth * 0.62, 1], [-Math.PI / 2, 0, 0], 'Title slip');
  // Small stitched loops pass through the cover and over its bound edge.
  if (withStitches) {
    const bx = width / 2 - 0.034, outside = width / 2 + 0.002;
    const top = thickness + 0.0018, bottom = -0.0018, radius = 0.00215;
    for (const f of [-0.37, -0.12, 0.12, 0.37]) {
      const z = depth * f;
      rod(group, m.thread, [bx, top, z], [outside, top, z], radius);
      rod(group, m.thread, [outside, top, z], [outside, bottom, z], radius);
      rod(group, m.thread, [outside, bottom, z], [bx, bottom, z], radius);
    }
    rod(group, m.thread, [bx, top, -depth * 0.37], [bx, top, depth * 0.37], radius);
    rod(group, m.thread, [bx, bottom, -depth * 0.37], [bx, bottom, depth * 0.37], radius);
  }
  return group;
}

function makeCase(width = 0.49, depth = 0.57, height = 0.18) {
  const m = getMaterials(), group = new THREE.Group();
  group.name = 'Cloth book case';
  box(group, m.cloth, [0, height / 2, 0], [width, height, depth]);
  box(group, m.pages, [0, height / 2, depth / 2 + 0.001], [width * 0.75, height * 0.65, 0.003]);
  for (const x of [-width * 0.29, width * 0.29]) {
    box(group, m.woodLight, [x, height + 0.001, 0], [0.012, 0.003, depth + 0.003]);
    box(group, m.woodLight, [x, height / 2, depth / 2 + 0.003], [0.012, height, 0.003]);
    box(group, m.brass, [x, height / 2, depth / 2 + 0.006], [0.032, 0.018, 0.008]);
  }
  return group;
}

function makeScroll() {
  const m = getMaterials(), group = new THREE.Group();
  group.name = 'Rolled paper scroll';
  cylinder(group, m.paper, [0, 0.042, 0], 0.039, 0.43, [0, 0, Math.PI / 2]);
  cylinder(group, m.woodDark, [0, 0.042, 0], 0.018, 0.49, [0, 0, Math.PI / 2]);
  for (const x of [-0.105, 0.105]) add(group, G.ring, m.cloth, [x, 0.042, 0], [0.040, 0.040, 0.040], [0, Math.PI / 2, 0]);
  return group;
}

/** Original tall assembly of slender Ming-style open jige racks. */
export function createShelfModel(options = {}) {
  const { width = 4.2, depth = 0.8, height = 3.65, seed = 0, withBooks = true, instanced = false } = options;
  const m = getMaterials(), group = new THREE.Group(); group.name = 'Composite open book rack';
  const bays = 3, unit = width / bays;
  const boards = [0.34, 0.88, 1.42, 2.01, 2.55, 3.09].map(y => y * height / 3.65);
  let books = 0;
  for (let c = 0; c < bays; c++) {
    const cx = -width / 2 + unit * (c + 0.5);
    // Each narrow rack remains visually independent instead of one thick cabinet.
    for (const dx of [-unit / 2 + 0.045, unit / 2 - 0.045]) {
      for (const z of [-depth / 2 + 0.05, depth / 2 - 0.05]) {
        box(group, m.wood, [cx + dx, height / 2, z], [0.076, height, 0.076]);
        box(group, m.woodDark, [cx + dx, 0.065, z], [0.09, 0.13, 0.09]);
      }
    }
    for (const y of [...boards, height - 0.06, height * 0.5]) {
      box(group, m.wood, [cx, y, 0], [unit - 0.055, 0.072, depth - 0.02]);
      box(group, m.woodLight, [cx, y + 0.028, depth / 2], [unit - 0.04, 0.018, 0.024]);
    }
    // Through-view rear lattice, tenons and side rails.
    for (const y of [0.59, 1.13, 1.67, 2.26, 2.8, 3.36]) {
      box(group, m.woodDark, [cx, y * height / 3.65, -depth / 2 + 0.015], [unit - 0.12, 0.028, 0.032]);
    }
    for (let k = 0; k < 5; k++) {
      const x = cx + (k - 2) * (unit - 0.19) / 4;
      box(group, m.woodDark, [x, height / 2 + 0.1, -depth / 2 + 0.015], [0.026, height - 0.48, 0.032]);
    }
    for (const dx of [-unit / 2 + 0.045, unit / 2 - 0.045]) {
      for (const y of boards) box(group, m.wood, [cx + dx, y + 0.22, 0], [0.032, 0.027, depth - 0.1]);
      for (const z of [-depth * 0.21, depth * 0.21]) box(group, m.wood, [cx + dx, height / 2 + 0.1, z], [0.028, height - 0.47, 0.028]);
    }
    // Low drawers and small cast-brass drop handles.
    box(group, m.woodDark, [cx, 0.22, 0], [unit - 0.16, 0.20, depth - 0.11]);
    for (let j = 0; j < 2; j++) {
      const x = cx + (j ? 1 : -1) * unit * 0.22;
      box(group, m.wood, [x, 0.22, depth / 2 + 0.012], [unit * 0.43, 0.15, 0.03]);
      cylinder(group, m.brass, [x, 0.232, depth / 2 + 0.035], 0.022, 0.01, [Math.PI / 2, 0, 0]);
      add(group, G.ring, m.brass, [x, 0.207, depth / 2 + 0.045], [0.025, 0.031, 0.025]);
    }
    // Overhanging flush caps, rounded bead profile suggested by a fine rail.
    box(group, m.wood, [cx, height - 0.006, 0], [unit + 0.015, 0.042, depth + 0.06]);
    rod(group, m.woodLight, [cx - unit / 2, height + 0.015, depth / 2], [cx + unit / 2, height + 0.015, depth / 2], 0.01);
    if (!withBooks) continue;
    for (let level = 0; level < boards.length; level++) {
      const count = 3 + ((c + level + seed) % 2);
      let by = boards[level] + 0.038;
      const offset = Math.sin(seed * 3.2 + c * 7 + level) * 0.025;
      for (let n = 0; n < count; n++) {
        const thickness = 0.057 + ((seed + level + n) % 3) * 0.009;
        const title = TITLES[(seed * 3 + c + level * 2) % TITLES.length];
        const book = createBookModel({ title, width: 0.43 + (n % 2) * 0.025, depth: 0.50 + ((level + n) % 2) * 0.026, thickness, colorIndex: seed + c * 3 + level + n });
        book.position.set(cx - unit * 0.13 + offset + Math.sin(n * 2 + seed) * 0.009, by, 0.038);
        book.rotation.y = Math.sin(n * 9 + level) * 0.022;
        group.add(book); books++; by += thickness + 0.003;
      }
      if ((c + level + seed) % 3 === 0) {
        const bookCase = makeCase(0.31, 0.51, 0.18);
        bookCase.position.set(cx + unit * 0.29, boards[level] + 0.038, 0.02); group.add(bookCase);
      } else if ((c + level + seed) % 3 === 1) {
        const scroll = makeScroll(); scroll.scale.setScalar(0.75);
        scroll.position.set(cx + unit * 0.25, boards[level] + 0.038, 0.05); scroll.rotation.y = Math.PI / 2; group.add(scroll);
        const scroll2 = scroll.clone(); scroll2.position.z -= 0.10; group.add(scroll2);
      }
    }
  }
  group.userData = { type: 'shelf', books, rackStyle: 'Original stacked three-tier Ming-style open racks' };
  if (instanced) { const optimized = batchGroup(group); optimized.name = group.name; optimized.userData = { ...group.userData }; return optimized; }
  return group;
}

let chairPrototype;
function makeChair() {
  if (chairPrototype) return chairPrototype.clone(true);
  const m = getMaterials(), group = new THREE.Group(); group.name = 'Ming-style yoke-back chair';
  box(group, m.wood, [0, 0.48, 0], [0.60, 0.055, 0.53]);
  box(group, m.woodLight, [0, 0.509, 0], [0.52, 0.008, 0.45]);
  for (const x of [-0.245, 0.245]) for (const z of [-0.205, 0.205]) {
    rod(group, m.wood, [x * 1.06, 0.035, z * 1.1], [x, 0.46, z], 0.027);
    cylinder(group, m.woodDark, [x * 1.05, 0.045, z * 1.1], 0.028, 0.045);
  }
  for (const x of [-0.245, 0.245]) rod(group, m.wood, [x, 0.17, -0.205], [x, 0.17, 0.205], 0.017);
  rod(group, m.wood, [-0.245, 0.13, 0.205], [0.245, 0.13, 0.205], 0.019);
  rod(group, m.wood, [-0.245, 0.22, -0.205], [0.245, 0.22, -0.205], 0.017);
  for (const x of [-0.25, 0.25]) {
    rod(group, m.wood, [x, 0.49, -0.22], [x, 1.10, -0.27], 0.025);
    rod(group, m.wood, [x, 0.49, 0.18], [x, 0.77, 0.17], 0.020);
    rod(group, m.wood, [x, 0.77, 0.22], [x, 0.80, -0.24], 0.025);
  }
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.36, 1.09, -0.26), new THREE.Vector3(-0.26, 1.13, -0.27),
    new THREE.Vector3(0, 1.115, -0.30), new THREE.Vector3(0.26, 1.13, -0.27), new THREE.Vector3(0.36, 1.09, -0.26),
  ]);
  const rail = new THREE.TubeGeometry(curve, 16, 0.032, 8, false);
  add(group, rail, m.wood, [0, 0, 0]);
  box(group, m.wood, [0, 0.81, -0.255], [0.135, 0.56, 0.028], [-0.065, 0, 0]);
  box(group, m.woodLight, [0, 0.88, -0.23], [0.063, 0.22, 0.008]);
  for (const x of [-0.30, 0.30]) box(group, m.woodDark, [x, 0.42, 0], [0.022, 0.085, 0.45]);
  chairPrototype = group; return group.clone(true);
}

let vaseGeometry;
function makeVase() {
  const m = getMaterials();
  if (!vaseGeometry) {
    const profile = [[0, 0], [0.07, 0], [0.075, 0.018], [0.10, 0.07], [0.105, 0.16], [0.075, 0.23], [0.035, 0.28], [0.035, 0.34], [0.049, 0.355], [0.044, 0.368], [0.032, 0.368], [0.027, 0.29]];
    vaseGeometry = new THREE.LatheGeometry(profile.map(v => new THREE.Vector2(...v)), 24);
  }
  const group = new THREE.Group(); group.name = 'Blue-and-white scholar vase';
  add(group, vaseGeometry, m.porcelain, [0, 0, 0]);
  for (const [r, y] of [[0.073, 0.027], [0.10, 0.105], [0.103, 0.14], [0.036, 0.31]]) {
    add(group, G.ring, m.blue, [0, y, 0], [r, r, r], [Math.PI / 2, 0, 0]);
  }
  // Three restrained twigs, fitting the scholar's desk rather than a flower shop.
  for (let k = 0; k < 3; k++) {
    const x = (k - 1) * 0.07;
    rod(group, m.woodDark, [0, 0.30, 0], [x, 0.60 + (k % 2) * 0.08, 0.025 * (k - 1)], 0.003);
    rod(group, m.woodDark, [x * 0.65, 0.49, 0.02], [x + 0.05, 0.59, 0.05], 0.002);
  }
  return group;
}

let manuscriptMaterial;
function getManuscriptMaterial() {
  if (manuscriptMaterial) return manuscriptMaterial;
  const texture = canvasTexture(512, 384, (ctx, w, h) => {
    ctx.fillStyle = '#e6d8b4'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ba9b74'; ctx.lineWidth = 1.3; ctx.strokeRect(22, 22, w - 44, h - 44);
    const lines = ['學而時習之', '不亦說乎', '有朋自遠方來', '不亦樂乎', '學而不思則罔', '思而不學則殆'];
    ctx.fillStyle = '#494237'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    ctx.font = '23px Silvae Serif, Noto Serif SC, serif';
    lines.forEach((line, n) => [...line].forEach((ch, i) => ctx.fillText(ch, w - 55 - n * 72, 46 + i * 37)));
    ctx.fillStyle = '#9e513e'; ctx.fillRect(40, 294, 30, 30);
  });
  manuscriptMaterial = new THREE.MeshStandardMaterial({ color: 0xf6e8ca, map: texture, roughness: 0.95, side: THREE.DoubleSide });
  manuscriptMaterial.name = 'Classical manuscript'; return manuscriptMaterial;
}

function makeDesk(seed = 0) {
  const m = getMaterials(), group = new THREE.Group(); group.name = 'Scholar reading desk';
  const width = 2.70, depth = 1.45, height = 0.85;
  box(group, m.wood, [0, height - 0.035, 0], [width, 0.07, depth]);
  box(group, m.woodLight, [0, height + 0.004, 0], [width - 0.15, 0.009, depth - 0.15]);
  for (const x of [-width / 2, width / 2]) box(group, m.woodDark, [x, height - 0.025, 0], [0.024, 0.035, depth]);
  for (const z of [-depth / 2, depth / 2]) box(group, m.woodDark, [0, height - 0.025, z], [width, 0.035, 0.024]);
  for (const x of [-1.12, 1.12]) for (const z of [-0.54, 0.54]) {
    cylinder(group, m.wood, [x, 0.407, z], 0.047, 0.784);
    cylinder(group, m.woodDark, [x, 0.055, z], 0.05, 0.085);
    box(group, m.wood, [x, 0.73, z], [0.12, 0.16, 0.12]);
  }
  for (const z of [-0.54, 0.54]) {
    box(group, m.wood, [0, 0.718, z], [2.32, 0.14, 0.048]);
    rod(group, m.woodLight, [-1.13, 0.645, z + Math.sign(z) * 0.012], [1.13, 0.645, z + Math.sign(z) * 0.012], 0.010);
    for (const x of [-1.02, 1.02]) box(group, m.wood, [x, 0.615, z], [0.20, 0.10, 0.05], [0, 0, Math.sign(x) * 0.22]);
  }
  for (const x of [-1.12, 1.12]) {
    box(group, m.wood, [x, 0.71, 0], [0.048, 0.14, 1.1]);
    rod(group, m.wood, [x, 0.25, -0.54], [x, 0.25, 0.54], 0.027);
  }
  add(group, G.plane, getManuscriptMaterial(), [0.05, 0.861, 0.1], [0.78, 0.59, 1], [-Math.PI / 2, 0, 0.03], 'Manuscript sheet');
  // Book stacks on the work surface.
  let by = 0.86;
  for (let k = 0; k < 2; k++) {
    const b = createBookModel({ title: TITLES[(seed * 2 + k) % TITLES.length], colorIndex: seed + k, width: 0.39, depth: 0.47 });
    b.position.set(-0.82, by, 0.07); b.rotation.y = -0.04 + 0.05 * k; group.add(b); by += 0.064;
  }
  // Inkstone with raised rim, inkstick, brush rest and bamboo brush pot.
  box(group, m.ink, [0.72, 0.875, 0.04], [0.27, 0.031, 0.18]);
  box(group, m.ink, [0.72, 0.894, 0.04], [0.24, 0.009, 0.15]);
  box(group, m.woodDark, [0.91, 0.875, 0.15], [0.023, 0.029, 0.14], [0, -0.22, 0]);
  rod(group, m.woodLight, [0.37, 0.88, -0.04], [0.65, 0.88, -0.04], 0.008);
  rod(group, m.ink, [0.65, 0.88, -0.04], [0.70, 0.88, -0.04], 0.011);
  cylinder(group, m.woodLight, [0.95, 0.952, -0.44], 0.065, 0.18);
  cylinder(group, m.woodDark, [0.95, 1.045, -0.44], 0.052, 0.006);
  for (let k = 0; k < 4; k++) {
    const a = k * 2.1, x = Math.cos(a) * 0.035, z = Math.sin(a) * 0.035;
    rod(group, m.woodLight, [0.95 + x, 0.98, -0.44 + z], [0.95 + x * 1.5, 1.23 + k * 0.025, -0.44 + z * 1.5], 0.004);
    rod(group, m.ink, [0.95 + x * 1.5, 1.23 + k * 0.025, -0.44 + z * 1.5], [0.95 + x * 1.5, 1.27 + k * 0.025, -0.44 + z * 1.5], 0.006);
  }
  const vase = makeVase(); vase.position.set(-1.04, 0.858, -0.43); group.add(vase);
  return group;
}

/** Keep objects individually meaningful in metadata while batching every repeated part. */
function batchGroup(source) {
  source.updateMatrixWorld(true);
  const groups = new Map();
  source.traverse(object => {
    if (!object.isMesh) return;
    const key = `${object.geometry.uuid}/${object.material.uuid}`;
    if (!groups.has(key)) groups.set(key, { geometry: object.geometry, material: object.material, matrices: [] });
    groups.get(key).matrices.push(object.matrixWorld.clone());
  });
  const result = new THREE.Group(); result.name = 'Ming furniture · instanced';
  for (const { geometry, material, matrices } of groups.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = material.name !== 'Furniture thread' && !material.name.startsWith('Vertical title');
    mesh.receiveShadow = true;
    mesh.name = `${material.name || 'Furniture'} · ${matrices.length} parts`;
    mesh.computeBoundingSphere(); result.add(mesh);
  }
  return result;
}

/** Main module entry. No network resources or external fonts are required. */
export function buildFurniture({ textures } = {}) {
  // Optional parameter reserved for integrations; procedurally generated textures
  // are intentionally the default, so this asset can travel as an offline GLB.
  void textures;
  const raw = new THREE.Group(); raw.name = 'Ming library furniture';
  const obstacles = [], catalog = [];
  let books = 0, shelves = 0, tables = 0;
  const categories = ['經部', '史部', '子部', '集部'];
  function placeShelf(x, z, rotation, width, category) {
    const shelf = createShelfModel({ width, seed: shelves });
    shelf.position.set(x, 0, z); shelf.rotation.y = rotation;
    raw.add(shelf); books += shelf.userData.books; shelves++;
    const acrossX = Math.abs(Math.cos(rotation)) > 0.5;
    const halfX = acrossX ? width / 2 + 0.08 : 0.50;
    const halfZ = acrossX ? 0.50 : width / 2 + 0.08;
    obstacles.push({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ });
    catalog.push({
      id: `shelf-${shelves}`, title: `${category} · 第${String(shelves).padStart(2, '0')}架`, category,
      description: `明式細方材開敞架格，上下三層組合。置線裝書 ${shelf.userData.books} 冊，配函套與卷軸；題簽為示意書名。`,
      position: [x + Math.sin(rotation) * 0.52, 1.8, z + Math.cos(rotation) * 0.52],
      bounds: { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ },
      bookCount: shelf.userData.books,
    });
  }
  for (const side of [-1, 1]) {
    for (const [index, z] of [-12, -6, 0, 6, 12].entries()) {
      placeShelf(side * 10.8, z, -side * Math.PI / 2, 4.2, categories[(index + (side > 0 ? 2 : 0)) % 4]);
    }
  }
  for (const [index, x] of [-8.8, -4.4, 4.4, 8.8].entries()) placeShelf(x, -15.8, 0, 3.6, categories[index]);
  for (const x of [-3.5, 3.5]) for (const z of [-5.2, 5.2]) {
    const desk = makeDesk(tables); desk.position.set(x, 0, z); raw.add(desk);
    books += 2; tables++;
    obstacles.push({ minX: x - 1.40, maxX: x + 1.40, minZ: z - 0.78, maxZ: z + 0.78 });
    for (const side of [-1, 1]) {
      const chair = makeChair(); chair.position.set(x, 0, z + side * 1.18); chair.rotation.y = side > 0 ? Math.PI : 0; raw.add(chair);
      obstacles.push({ minX: x - 0.38, maxX: x + 0.38, minZ: z + side * 1.18 - 0.38, maxZ: z + side * 1.18 + 0.38 });
    }
  }
  const group = batchGroup(raw);
  group.userData = { type: 'furniture', shelfAssemblies: shelves, books, tables, source: 'Original procedural Ming-inspired study furniture' };
  return { group, obstacles, catalog, stats: { books, shelves, tables } };
}
