/**
 * Original narrow hall for the live virtual library.
 * Procedural meshes and textures only: no film names, crests, characters,
 * or extracted game assets. Run:
 *   node --experimental-strip-types scripts/hogwarts-library/build_narrow_hall.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {
  REFERENCE_LIBRARY as R,
  REFERENCE_BAY_BOUNDARIES,
  NARROW_HALL,
  referenceLibraryRoofY,
} from '../../apps/web/src/pages/virtual-library-model/hogwartsLibraryLayout.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'apps/web/public/assets/hogwarts-library');
const MODULES = path.join(OUT, 'modules');
const TEXTURES = path.join(OUT, 'textures');
const REVISION = NARROW_HALL.revision;
const TRIANGLE_BUDGET = 400_000;

const MAT = {
  walnut: 'Walnut • hand-rubbed',
  oak: 'Oak • worn edge',
  stone: 'Stone • dark floor',
  plaster: 'Plaster • vault shadow',
  iron: 'Iron • gate and rail',
  brass: 'Brass • lamp collar',
  glass: 'Glass • green shade',
  candle: 'Light • lamp glow',
  window: 'Glass • high window',
  still: 'Canvas • lamp and books',
  leather: 'Leather • reading top',
};

const MATERIAL_ORDER = Object.values(MAT);
const PARTS = ['entrance', 'west-bays', 'east-bays', 'north-gate'];

function partFor(x, z) {
  if (z >= 8) return 'north-gate';
  if (z < -4) return 'entrance';
  return x >= 0 ? 'east-bays' : 'west-bays';
}

function crc32(buffer) {
  let c = ~0;
  for (const byte of buffer) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function writePng(file, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, {level: 9})),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  return png;
}

function grain(width, height, rgb, vessels) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const v = y / height;
      const phase = u * Math.PI * 2 * 18 + 0.65 * Math.sin(v * Math.PI * 4);
      let n = 0.9 + 0.07 * Math.sin(phase) + 0.03 * Math.sin(phase * 3.1 + v * 12);
      n -= vessels * Math.max(0, Math.sin(phase * 7)) ** 18;
      n += ((x * 17 + y * 31) % 7) * 0.004 - 0.012;
      const offset = (y * width + x) * 4;
      pixels[offset] = Math.max(0, Math.min(255, rgb[0] * n));
      pixels[offset + 1] = Math.max(0, Math.min(255, rgb[1] * n));
      pixels[offset + 2] = Math.max(0, Math.min(255, rgb[2] * n));
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

function stillLife(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  const set = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    pixels[offset] = rgb[0];
    pixels[offset + 1] = rgb[1];
    pixels[offset + 2] = rgb[2];
    pixels[offset + 3] = 255;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) set(x, y, [42, 32, 26]);
  }
  const rect = (x0, y0, x1, y1, rgb) => {
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) set(x, y, rgb);
  };
  rect(70, 70, width - 70, height - 70, [28, 22, 18]);
  for (let t = 0; t < 10; t += 1) {
    rect(78 + t, 78 + t, width - 78 - t, 88 + t, [168, 132, 78]);
    rect(78 + t, height - 88 - t, width - 78 - t, height - 78 - t, [168, 132, 78]);
    rect(78 + t, 78 + t, 88 + t, height - 78 - t, [168, 132, 78]);
    rect(width - 88 - t, 78 + t, width - 78 - t, height - 78 - t, [168, 132, 78]);
  }
  rect(150, 250, 230, 390, [92, 48, 36]);
  rect(236, 270, 300, 390, [48, 62, 78]);
  rect(306, 230, 390, 390, [120, 78, 42]);
  const cx = 250;
  const cy = 150;
  for (let y = 80; y < 230; y += 1) {
    for (let x = 160; x < 340; x += 1) {
      const dx = (x - cx) / 90;
      const dy = (y - cy) / 48;
      if (dx * dx + dy * dy <= 1) set(x, y, [36, 92, 64]);
    }
  }
  rect(236, 188, 264, 250, [150, 112, 58]);
  return pixels;
}

function createBin() {
  const groups = new Map();
  const touch = (name) => {
    if (!groups.has(name)) groups.set(name, {positions: [], normals: [], uvs: [], indices: []});
    return groups.get(name);
  };
  const pushVertex = (group, position, normal, uv) => {
    const index = group.positions.length / 3;
    group.positions.push(...position);
    group.normals.push(...normal);
    group.uvs.push(...uv);
    return index;
  };
  return {
    box(name, cx, cy, cz, sx, sy, sz) {
      if (sx <= 0 || sy <= 0 || sz <= 0) return;
      const group = touch(name);
      const hx = sx / 2;
      const hy = sy / 2;
      const hz = sz / 2;
      const faces = [
        {normal: [1, 0, 0], corners: [[hx, -hy, -hz], [hx, -hy, hz], [hx, hy, hz], [hx, hy, -hz]]},
        {normal: [-1, 0, 0], corners: [[-hx, -hy, hz], [-hx, -hy, -hz], [-hx, hy, -hz], [-hx, hy, hz]]},
        {normal: [0, 1, 0], corners: [[-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]]},
        {normal: [0, -1, 0], corners: [[-hx, -hy, hz], [hx, -hy, hz], [hx, -hy, -hz], [-hx, -hy, -hz]]},
        {normal: [0, 0, 1], corners: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]},
        {normal: [0, 0, -1], corners: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]},
      ];
      for (const face of faces) {
        const ids = face.corners.map((corner, cornerIndex) => pushVertex(
          group,
          [cx + corner[0], cy + corner[1], cz + corner[2]],
          face.normal,
          [cornerIndex % 2, cornerIndex < 2 ? 0 : 1],
        ));
        group.indices.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
      }
    },
    quad(name, corners) {
      const group = touch(name);
      const ax = corners[1][0] - corners[0][0];
      const ay = corners[1][1] - corners[0][1];
      const az = corners[1][2] - corners[0][2];
      const bx = corners[3][0] - corners[0][0];
      const by = corners[3][1] - corners[0][1];
      const bz = corners[3][2] - corners[0][2];
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length; ny /= length; nz /= length;
      const ids = corners.map((corner, index) => pushVertex(group, corner, [nx, ny, nz], [index % 2, index < 2 ? 0 : 1]));
      group.indices.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    },
    stats() {
      let triangles = 0;
      let primitives = 0;
      let vertices = 0;
      for (const group of groups.values()) {
        if (!group.indices.length) continue;
        primitives += 1;
        triangles += group.indices.length / 3;
        vertices += group.positions.length / 3;
      }
      return {triangles, primitives, vertices};
    },
    bounds() {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const group of groups.values()) {
        for (let i = 0; i < group.positions.length; i += 3) {
          for (let axis = 0; axis < 3; axis += 1) {
            min[axis] = Math.min(min[axis], group.positions[i + axis]);
            max[axis] = Math.max(max[axis], group.positions[i + axis]);
          }
        }
      }
      return {min, max};
    },
    toGlb() {
      const used = MATERIAL_ORDER.filter(name => groups.get(name)?.indices.length);
      const json = {
        asset: {version: '2.0', generator: 'BookKin narrow hall'},
        scene: 0,
        scenes: [{nodes: used.map((_, index) => index)}],
        nodes: used.map((_, index) => ({mesh: index})),
        meshes: used.map(() => ({primitives: []})),
        materials: MATERIAL_ORDER.map(name => ({name, pbrMetallicRoughness: {baseColorFactor: [1, 1, 1, 1]}})),
        buffers: [{byteLength: 0}],
        bufferViews: [],
        accessors: [],
      };
      const parts = [];
      let offset = 0;
      const align = () => {
        const pad = (4 - (offset % 4)) % 4;
        if (pad) parts.push(Buffer.alloc(pad));
        offset += pad;
      };
      used.forEach((name, meshIndex) => {
        const group = groups.get(name);
        const vertexCount = group.positions.length / 3;
        const indexType = vertexCount > 65535 ? 5125 : 5123;
        const indexBytes = Buffer.alloc(group.indices.length * (indexType === 5125 ? 4 : 2));
        group.indices.forEach((value, index) => {
          if (indexType === 5125) indexBytes.writeUInt32LE(value, index * 4);
          else indexBytes.writeUInt16LE(value, index * 2);
        });
        const positionBytes = Buffer.from(new Float32Array(group.positions).buffer);
        const normalBytes = Buffer.from(new Float32Array(group.normals).buffer);
        const uvBytes = Buffer.from(new Float32Array(group.uvs).buffer);
        const blocks = [
          {bytes: indexBytes, target: 34963},
          {bytes: positionBytes, target: 34962},
          {bytes: normalBytes, target: 34962},
          {bytes: uvBytes, target: 34962},
        ];
        const views = [];
        for (const block of blocks) {
          align();
          views.push(offset);
          json.bufferViews.push({buffer: 0, byteOffset: offset, byteLength: block.bytes.length, target: block.target});
          parts.push(block.bytes);
          offset += block.bytes.length;
        }
        const positionMin = [Infinity, Infinity, Infinity];
        const positionMax = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < group.positions.length; i += 3) {
          for (let axis = 0; axis < 3; axis += 1) {
            positionMin[axis] = Math.min(positionMin[axis], group.positions[i + axis]);
            positionMax[axis] = Math.max(positionMax[axis], group.positions[i + axis]);
          }
        }
        const indexAccessor = json.accessors.length;
        json.accessors.push({
          bufferView: json.bufferViews.length - 4, componentType: indexType, count: group.indices.length, type: 'SCALAR',
        });
        json.accessors.push({
          bufferView: json.bufferViews.length - 3, componentType: 5126, count: vertexCount, type: 'VEC3',
          min: positionMin, max: positionMax,
        });
        json.accessors.push({
          bufferView: json.bufferViews.length - 2, componentType: 5126, count: vertexCount, type: 'VEC3',
        });
        json.accessors.push({
          bufferView: json.bufferViews.length - 1, componentType: 5126, count: vertexCount, type: 'VEC2',
        });
        json.meshes[meshIndex].primitives.push({
          attributes: {POSITION: indexAccessor + 1, NORMAL: indexAccessor + 2, TEXCOORD_0: indexAccessor + 3},
          indices: indexAccessor,
          material: MATERIAL_ORDER.indexOf(name),
        });
        void views;
      });
      align();
      const bin = Buffer.concat(parts);
      json.buffers[0].byteLength = bin.length;
      const jsonText = Buffer.from(JSON.stringify(json));
      const jsonPad = Buffer.alloc((4 - (jsonText.length % 4)) % 4, 0x20);
      const jsonChunk = Buffer.concat([jsonText, jsonPad]);
      const header = Buffer.alloc(12);
      const jsonHeader = Buffer.alloc(8);
      const binHeader = Buffer.alloc(8);
      const total = 12 + 8 + jsonChunk.length + 8 + bin.length;
      header.writeUInt32LE(0x46546c67, 0);
      header.writeUInt32LE(2, 4);
      header.writeUInt32LE(total, 8);
      jsonHeader.writeUInt32LE(jsonChunk.length, 0);
      jsonHeader.writeUInt32LE(0x4e4f534a, 4);
      binHeader.writeUInt32LE(bin.length, 0);
      binHeader.writeUInt32LE(0x004e4942, 4);
      return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]);
    },
  };
}

const bins = Object.fromEntries(PARTS.map(id => [id, createBin()]));
const colliders = [];

function mesh(part, material, cx, cy, cz, sx, sy, sz) {
  bins[part].box(material, cx, cy, cz, sx, sy, sz);
}
function collider(id, cx, cy, cz, sx, sy, sz) {
  colliders.push({id, shape: 'box', center: {x: cx, y: cy, z: cz}, size: {x: sx, y: sy, z: sz}});
}

function addVault(part, z0, z1, x0, x1) {
  const segX = 6;
  const segZ = 3;
  for (let i = 0; i < segX; i += 1) {
    for (let j = 0; j < segZ; j += 1) {
      const xa = x0 + (x1 - x0) * i / segX;
      const xb = x0 + (x1 - x0) * (i + 1) / segX;
      const za = z0 + (z1 - z0) * j / segZ;
      const zb = z0 + (z1 - z0) * (j + 1) / segZ;
      bins[part].quad(MAT.plaster, [
        [xa, referenceLibraryRoofY(xa), za],
        [xb, referenceLibraryRoofY(xb), za],
        [xb, referenceLibraryRoofY(xb), zb],
        [xa, referenceLibraryRoofY(xa), zb],
      ]);
    }
  }
}

function addShell() {
  const slices = [
    {part: 'entrance', z0: -20, z1: -4},
    {part: 'west-bays', z0: -4, z1: 8, x0: -8, x1: 0},
    {part: 'east-bays', z0: -4, z1: 8, x0: 0, x1: 8},
    {part: 'north-gate', z0: 8, z1: 20},
  ];
  for (const slice of slices) {
    const x0 = slice.x0 ?? -8;
    const x1 = slice.x1 ?? 8;
    mesh(slice.part, MAT.stone, (x0 + x1) / 2, -0.04, (slice.z0 + slice.z1) / 2, x1 - x0, 0.08, slice.z1 - slice.z0);
    addVault(slice.part, slice.z0, slice.z1, x0, x1);
    if (x0 < -1) mesh(slice.part, MAT.plaster, -7.95, 5.4, (slice.z0 + slice.z1) / 2, 0.28, 10.4, slice.z1 - slice.z0);
    if (x1 > 1) mesh(slice.part, MAT.plaster, 7.95, 5.4, (slice.z0 + slice.z1) / 2, 0.28, 10.4, slice.z1 - slice.z0);
  }
  collider('floor-south', 0, -0.08, -12, 15.6, 0.16, 16);
  collider('floor-mid', 0, -0.08, 2, 15.6, 0.16, 12);
  collider('floor-north', 0, -0.08, 14, 15.6, 0.16, 12);
  collider('wall-west', -7.95, 5.4, 0, 0.28, 10.8, 39.5);
  collider('wall-east', 7.95, 5.4, 0, 0.28, 10.8, 39.5);
  collider('wall-south', 0, 5.4, -19.86, 15.6, 10.8, 0.28);
  collider('wall-north', 0, 5.4, 19.86, 15.6, 10.8, 0.28);
  mesh('entrance', MAT.walnut, -0.7, 1.7, -19.55, 1.1, 3.2, 0.08);
  mesh('entrance', MAT.walnut, 0.7, 1.7, -19.55, 1.1, 3.2, 0.08);
  mesh('entrance', MAT.still, -6.4, 2.2, -17.2, 0.06, 1.5, 1.1);
  for (const side of [-1, 1]) {
    for (const z of [-16, -8, 0, 8, 14]) {
      const part = partFor(side * 7.7, z);
      mesh(part, MAT.window, side * 7.78, 7.3, z, 0.06, 1.6, 0.7);
    }
    mesh(partFor(side * 2.75, -12), MAT.oak, side * 2.75, R.galleryY - 0.05, -12, 0.9, 0.1, 15);
    mesh(partFor(side * 2.75, 3), MAT.oak, side * 2.75, R.galleryY - 0.05, 3, 0.9, 0.1, 13);
    collider(`gallery-floor-${side < 0 ? 'west' : 'east'}-south`, side * 2.75, R.galleryY - 0.08, -12, 0.9, 0.16, 15);
    collider(`gallery-floor-${side < 0 ? 'west' : 'east'}-north`, side * 2.75, R.galleryY - 0.08, 4, 0.9, 0.16, 16);
    collider(`gallery-rail-${side < 0 ? 'west' : 'east'}`, side * 2.16, R.galleryY + 0.85, -2, 0.1, 1.5, 32);
    mesh(partFor(side * 2.16, -2), MAT.iron, side * 2.16, R.galleryY + 0.7, -8, 0.06, 1.1, 20);
    mesh(partFor(side * 2.16, 6), MAT.iron, side * 2.16, R.galleryY + 0.7, 6, 0.06, 1.1, 12);
  }
}

function addCases() {
  for (const [bay, z] of REFERENCE_BAY_BOUNDARIES.entries()) {
    for (const side of [-1, 1]) {
      for (const level of [0, 1]) {
        const inner = level === 0 ? R.lowerCaseInnerX : R.upperCaseInnerX;
        const outer = level === 0 ? R.caseOuterX : R.upperCaseOuterX;
        const width = outer - inner;
        const centerX = side * (inner + width / 2);
        const baseY = level === 0 ? 0 : R.galleryY;
        const height = level === 0 ? R.lowerCaseHeight : R.upperCaseHeight;
        const part = partFor(centerX, z);
        mesh(part, MAT.walnut, centerX, baseY + height / 2, z, width, height, R.shelfBackThickness);
        const boardBase = level === 0 ? R.lowerShelfBase : R.upperShelfBase;
        const pitch = level === 0 ? R.lowerShelfPitch : R.upperShelfPitch;
        for (const face of [-1, 1]) {
          const prefix = `gallery-${level === 0 ? 'ground' : 'upper'}-${side < 0 ? 'west' : 'east'}-${bay}-${face}`;
          for (let row = 0; row < R.shelfRows; row += 1) {
            mesh(part, MAT.oak, centerX, boardBase + row * pitch, z + face * 0.2, width - 0.16, R.shelfBoardThickness, 0.26);
          }
          for (const end of [0, 1]) {
            const x = centerX + (end === 0 ? -1 : 1) * (width / 2);
            collider(`case-stile-${prefix}-${end}`, x, baseY + height / 2, z + face * 0.16, 0.12, height, 0.24);
            mesh(part, MAT.walnut, x, baseY + height / 2, z + face * 0.16, 0.1, height, 0.22);
          }
        }
        const casePrefix = `gallery-${level === 0 ? 'ground' : 'upper'}-${side < 0 ? 'west' : 'east'}-${bay}`;
        collider(`case-back-${casePrefix}`, centerX, baseY + height / 2, z, width, height, R.shelfBackThickness);
      }
      if (bay % 2 === 0) {
        const x = side * (R.lowerCaseInnerX - 0.22);
        const part = partFor(x, z);
        mesh(part, MAT.oak, x, 1.15, z - 0.15, 0.06, 2.2, 0.06);
        mesh(part, MAT.oak, x, 1.15, z + 0.15, 0.06, 2.2, 0.06);
        for (const y of [0.45, 0.9, 1.35, 1.8]) mesh(part, MAT.oak, x, y, z, 0.05, 0.04, 0.3);
        mesh(part, MAT.brass, x, 0.12, z, 0.12, 0.08, 0.34);
        collider(`ladder-${side < 0 ? 'west' : 'east'}-${bay}`, x, 1.15, z, 0.16, 2.3, 0.4);
      }
    }
  }
}

function addStair(name, spec) {
  const side = spec.x < 0 ? -1 : 1;
  const part = partFor(spec.x, spec.z);
  const steps = 22;
  const start = side < 0 ? 0 : Math.PI;
  const route = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const angle = start + t * Math.PI * 2;
    const x = spec.x + Math.cos(angle) * spec.radius;
    const z = spec.z + Math.sin(angle) * spec.radius;
    const y = t * R.galleryY;
    route.push({x, y, z});
    if (step < steps) {
      mesh(part, MAT.walnut, x, y + 0.04, z, 0.28, 0.05, 0.16);
      collider(`stair-tread-${name}-${step}`, x, y + 0.03, z, 0.22, 0.04, 0.12);
    }
  }
  const end = route[route.length - 1];
  const walkX = side * NARROW_HALL.galleryWalkX;
  const stop = side * 3.28;
  const span = Math.abs(end.x - stop);
  const mid = (end.x + stop) / 2;
  mesh(part, MAT.walnut, mid, R.galleryY - 0.06, spec.z, span, 0.1, 0.7);
  collider(`stair-exit-infill-${name}`, mid, R.galleryY - 0.08, spec.z, span, 0.14, 0.7);
  route.push({x: walkX, y: R.galleryY, z: spec.z});
  mesh(part, MAT.iron, spec.x, R.galleryY / 2, spec.z, 0.14, R.galleryY + 0.3, 0.14);
  collider(`stair-pole-${name}`, spec.x, R.galleryY / 2, spec.z, 0.14, R.galleryY + 0.2, 0.14);
  const railX = spec.x + side * 1.55;
  mesh(part, MAT.iron, railX, R.galleryY / 2, spec.z, 0.08, R.galleryY, 1.2);
  collider(`stair-outer-rail-${name}`, railX, R.galleryY / 2, spec.z, 0.1, R.galleryY, 1.2);
  for (let step = 0; step < 8; step += 1) {
    const angle = start + (step / 8) * Math.PI * 2;
    const x = spec.x + Math.cos(angle) * 1.05;
    const z = spec.z + Math.sin(angle) * 1.05;
    mesh(part, MAT.iron, x, 1.1, z, 0.04, 1.6, 0.04);
  }
  return route;
}

function addFurniture() {
  NARROW_HALL.tableZ.forEach((z, index) => {
    const part = partFor(0, z);
    mesh(part, MAT.walnut, 0, 0.38, z, 1.6, 0.74, 0.86);
    mesh(part, MAT.leather, 0, 0.76, z, 1.45, 0.04, 0.72);
    mesh(part, MAT.brass, 0, 1.05, z, 0.08, 0.42, 0.08);
    mesh(part, MAT.glass, 0, 1.28, z, 0.28, 0.16, 0.28);
    mesh(part, MAT.candle, 0, 1.28, z, 0.08, 0.08, 0.08);
    const crown = referenceLibraryRoofY(0);
    mesh(part, MAT.iron, 0, (crown + 1.5) / 2, z, 0.03, crown - 1.7, 0.03);
    mesh(part, MAT.candle, 0, crown - 0.35, z, 0.18, 0.08, 0.18);
    collider(`reading-table-${index}`, 0, 0.39, z, 1.6, 0.78, 0.86);
  });
  const gateZ = NARROW_HALL.gateZ;
  collider('gate-post-west', -1.72, 1.55, gateZ, 0.12, 3.1, 0.12);
  collider('gate-post-east', 1.72, 1.55, gateZ, 0.12, 3.1, 0.12);
  collider('gate-post-gap-west', -0.74, 1.55, gateZ, 0.1, 3.1, 0.1);
  collider('gate-post-gap-east', 0.74, 1.55, gateZ, 0.1, 3.1, 0.1);
  mesh('north-gate', MAT.iron, 0, 3.15, gateZ, 3.6, 0.1, 0.1);
  for (const side of [-1, 1]) {
    mesh('north-gate', MAT.iron, side * 1.72, 1.55, gateZ, 0.1, 3.1, 0.1);
    mesh('north-gate', MAT.iron, side * 0.74, 1.55, gateZ, 0.08, 3.1, 0.08);
    for (let x = 0.9; x <= 1.58; x += 0.16) {
      mesh('north-gate', MAT.iron, side * x, 1.5, gateZ, 0.04, 2.9, 0.04);
      collider(`gate-bar-${side < 0 ? 'west' : 'east'}-${Math.round(x * 100)}`, side * x, 1.5, gateZ, 0.06, 3, 0.08);
    }
  }
  for (const z of [17, 18.6]) {
    for (const side of [-1, 1]) {
      const centerX = side * 4.6;
      mesh('north-gate', MAT.walnut, centerX, 2.2, z, 5.2, 4.2, 0.5);
      for (let row = 0; row < 5; row += 1) mesh('north-gate', MAT.oak, centerX, 0.5 + row * 0.7, z + side * 0.02, 4.8, 0.05, 0.28);
    }
  }
}

const stairRoutes = {
  left: addStair('left', NARROW_HALL.stairs.left),
  right: addStair('right', NARROW_HALL.stairs.right),
};
addShell();
addCases();
addFurniture();

function colorMaterial(name, factor, extras = {}) {
  return {
    name,
    doubleSided: true,
    pbrMetallicRoughness: {metallicFactor: extras.metal ?? 0, roughnessFactor: extras.rough ?? 0.82, ...factor},
    ...(extras.emissive ? {emissiveFactor: extras.emissive} : {}),
  };
}

function buildMaterials(images) {
  const textures = images.map((_, index) => ({sampler: 0, source: index}));
  const byName = {
    [MAT.walnut]: colorMaterial(MAT.walnut, {baseColorTexture: {index: 0}}, {rough: 0.78}),
    [MAT.oak]: colorMaterial(MAT.oak, {baseColorTexture: {index: 1}}, {rough: 0.7}),
    [MAT.stone]: colorMaterial(MAT.stone, {baseColorTexture: {index: 2}}, {rough: 0.92}),
    [MAT.plaster]: colorMaterial(MAT.plaster, {baseColorFactor: [0.52, 0.46, 0.4, 1]}, {rough: 0.9}),
    [MAT.iron]: colorMaterial(MAT.iron, {baseColorFactor: [0.2, 0.19, 0.18, 1]}, {metal: 0.72, rough: 0.46}),
    [MAT.brass]: colorMaterial(MAT.brass, {baseColorFactor: [0.62, 0.42, 0.18, 1]}, {metal: 0.64, rough: 0.4}),
    [MAT.glass]: colorMaterial(MAT.glass, {baseColorFactor: [0.1, 0.32, 0.18, 1]}, {metal: 0.08, rough: 0.22}),
    [MAT.candle]: colorMaterial(MAT.candle, {baseColorFactor: [1, 0.72, 0.38, 1]}, {rough: 0.4, emissive: [1, 0.62, 0.28]}),
    [MAT.window]: colorMaterial(MAT.window, {baseColorFactor: [0.72, 0.8, 0.84, 1]}, {rough: 0.18, emissive: [0.22, 0.24, 0.26]}),
    [MAT.still]: colorMaterial(MAT.still, {baseColorTexture: {index: 3}}, {rough: 0.86}),
    [MAT.leather]: colorMaterial(MAT.leather, {baseColorFactor: [0.32, 0.18, 0.1, 1]}, {rough: 0.74}),
  };
  return {
    asset: {version: '2.0', generator: 'BookKin narrow hall'},
    scene: 0,
    scenes: [{nodes: []}],
    nodes: [],
    materials: MATERIAL_ORDER.map(name => byName[name]),
    textures,
    samplers: [{magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497}],
    images: images.map(image => ({mimeType: 'image/png', uri: `textures/${image}`})),
  };
}

fs.mkdirSync(MODULES, {recursive: true});
fs.mkdirSync(TEXTURES, {recursive: true});
const textureFiles = {
  'walnut-albedo.png': grain(512, 512, [168, 112, 70], 0.18),
  'oak-albedo.png': grain(512, 512, [204, 156, 102], 0.08),
  'stone-albedo.png': grain(512, 512, [148, 138, 126], 0),
  'still-life-lamp-books.png': stillLife(512, 512),
};
for (const [name, pixels] of Object.entries(textureFiles)) writePng(path.join(TEXTURES, name), 512, 512, pixels);

const chunks = [];
let triangles = 0;
for (const id of PARTS) {
  const bin = bins[id];
  const glb = bin.toGlb();
  const stats = bin.stats();
  const bounds = bin.bounds();
  const file = path.join(MODULES, `${id}.glb`);
  fs.writeFileSync(file, glb);
  triangles += stats.triangles;
  const vertexBytes = stats.vertices * (3 + 3 + 2) * 4;
  const indexBytes = stats.triangles * 3 * (stats.vertices > 65535 ? 4 : 2);
  chunks.push({
    id,
    url: `modules/${id}.glb?v=${REVISION}`,
    bytes: glb.length,
    sha256: crypto.createHash('sha256').update(glb).digest('hex'),
    triangles: stats.triangles,
    primitives: stats.primitives,
    decodedGeometryBytes: vertexBytes + indexBytes,
    bounds: {min: bounds.min.map(value => Number(value.toFixed(4))), max: bounds.max.map(value => Number(value.toFixed(4)))},
    core: id === 'entrance',
    startup: id === 'entrance',
  });
}

if (triangles >= TRIANGLE_BUDGET) {
  console.error(`Triangle budget exceeded: ${triangles}`);
  process.exit(1);
}

const manifest = {
  version: 1,
  revision: REVISION,
  materialsUrl: `materials.gltf?v=${REVISION}`,
  materialCapacityLimits: MATERIAL_ORDER.map(name => ({name, vertices: 120000, indices: 240000})),
  chunks,
};
fs.writeFileSync(path.join(OUT, 'materials.gltf'), JSON.stringify(buildMaterials(Object.keys(textureFiles))));
fs.writeFileSync(path.join(OUT, 'library-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const config = {
  version: 1,
  revision: REVISION,
  scaleNote: 'Original 16 m × 40 m narrow hall. Not a film set and not surveyed from one.',
  dimensions: {width: R.width, length: R.length, galleryY: R.galleryY, vaultCrownY: R.height},
  shelves: {
    boardThickness: R.shelfBoardThickness,
    backThickness: R.shelfBackThickness,
    lower: {xMin: R.lowerCaseInnerX, xMax: R.caseOuterX, baseY: R.lowerShelfBase},
    upper: {xMin: R.upperCaseInnerX, xMax: R.upperCaseOuterX, baseY: R.upperShelfBase},
  },
  colliders,
  stairRoutes,
  cameras: [{id: 'entrance', position: [0, 1.5, -16.4], target: [0, R.camera.targetY, R.camera.targetZ], fov: 58}],
  lighting: {
    // ACES plus the directional cap (under 0.6) leaves a 0.3 lux sun invisible.
    // Warm hemisphere and ambient carry the room; the three lamps stay local.
    exposure: 0.88,
    hemisphere: {sky: '#c4a07a', ground: '#3a2418', intensity: 1.45},
    ambient: {color: '#f0d7b0', intensity: 0.85},
    directional: [{
      color: '#f3d7b4', intensity: 0.5,
      position: [0.4, 7.2, -13], target: [0, 0.4, -13],
    }],
    points: NARROW_HALL.tableZ.map(z => ({color: '#ffb15a', intensity: 64, distance: 5.6, position: [0, 1.7, z]})),
  },
  omissions: [
    'No non-catalog filler or decorative books. Empty shelves stay empty.',
    'The scholar portrait is replaced by an original still life of a lamp and books.',
    'No school names, crests, characters, chains, or film props.',
  ],
};
fs.writeFileSync(path.join(OUT, 'scene-config.json'), `${JSON.stringify(config, null, 2)}\n`);

for (const file of fs.readdirSync(MODULES)) {
  if (!PARTS.includes(file.replace(/\.glb$/, ''))) fs.unlinkSync(path.join(MODULES, file));
}
for (const file of fs.readdirSync(TEXTURES)) {
  if (!Object.hasOwn(textureFiles, file)) fs.unlinkSync(path.join(TEXTURES, file));
}

console.log(JSON.stringify({
  triangles,
  modules: chunks.map(chunk => ({id: chunk.id, triangles: chunk.triangles, bytes: chunk.bytes, startup: chunk.startup})),
  colliders: colliders.length,
  bytes: chunks.reduce((sum, chunk) => sum + chunk.bytes, 0),
}, null, 2));
