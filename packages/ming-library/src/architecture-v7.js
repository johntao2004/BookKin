import * as THREE from 'three';
import { buildExteriorV6 } from './exterior-v6.js';
import { buildDoubleRoofV6, upperRoofSurfaceHeight as roofSurfaceHeight } from './roof-v6.js';
import { prepareContinuousFriezeTexture, continuousFriezeGeometry } from './continuous-frieze-v9.js';
import { PALACE_FRAME_V10 as FRAME, palaceBayStations } from './palace-frame-v10.js';
import { CAISSON_V10, addReferenceCaissonV10, addReferenceCofferTilesV10 } from './caisson-v10.js';
import { ARCHITECTURAL_HEIGHT_SCALE } from './height-v11.js';
import { upperLocalYV15 } from './height-v15.js';
import {V12_COLUMN_COLOR,V12_JOINERY_COLOR} from './design-v12.js';
import {palaceColumnMaterialV12,palaceStoneMaterialV12,palaceColumnBaseGeometryV12,palaceJoineryMaterialV12,palacePiercedPanelV12} from './timber-style-v12.js';

/**
 * Guanwen Library V7 — entrance-aligned palace structure with explicit bearing joints.
 * Metres, Y up, principal entrance at +X. Lower body 44 × 62 m, upper body 36 × 52 m.
 * The lower encircling roof is open over the actual upper floor. Gallery datum 6.3 m.
 * All floor openings and stair geometry use the same constants as navigation.
 */
const UPPER_Y = FRAME.upperY;
const HUMAN_RAIL_SCALE = 1 / ARCHITECTURAL_HEIGHT_SCALE;
const STAIR_WIDTH = FRAME.stairs.width;
const ROOF_THICKNESS = .22;
const COLUMN_X = FRAME.columns.x;
const COLUMN_Z = FRAME.columns.z;
const ATRIUM = Object.freeze({minX:-FRAME.atrium.openingHalfX,maxX:FRAME.atrium.openingHalfX,minZ:-FRAME.atrium.openingHalfZ,maxZ:FRAME.atrium.openingHalfZ});
const STAIR_HOLES = [-1,1].map(side=>({minX:FRAME.stairs.holeMinX,maxX:FRAME.stairs.holeMaxX,minZ:side*FRAME.stairs.centerZ-FRAME.stairs.holeHalfZ,maxZ:side*FRAME.stairs.centerZ+FRAME.stairs.holeHalfZ}));
const GEOMETRY = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 36),
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
    const chars = [...text]; c.font = `${vertical ? 92 : 190}px Silvae Serif, Noto Serif SC, serif`;
    chars.forEach((ch, i) => c.fillText(ch, vertical ? w / 2 : w * (i + 1) / (chars.length + 1), vertical ? h * (i + 1) / (chars.length + 1) : h * .53));
  });
}

class Batch {
  constructor(group, keepSolid = false) { this.group = group; this.keepSolid = keepSolid; this.records = new Map(); this.object = new THREE.Object3D(); }
  add(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], cast = true, record = null) {
    const key = `${geometry.uuid}/${material.uuid}/${cast}`;
    if (!this.records.has(key)) this.records.set(key, { geometry, material, cast, matrices: [], references: [] });
    this.object.position.set(...position); this.object.rotation.set(...rotation); this.object.scale.set(...scale); this.object.updateMatrix();
    if(this.verticalTransform)this.object.matrix.premultiply(this.verticalTransform);
    this.records.get(key).matrices.push(this.object.matrix.clone()); this.records.get(key).references.push(record);
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
    let count = 0,batchIndex=0;
    for (const { geometry, material, cast, matrices, references } of this.records.values()) {
      const im = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((mat, i) => im.setMatrixAt(i, mat)); im.instanceMatrix.needsUpdate = true;
      im.castShadow = cast; im.receiveShadow = true; im.name = `${name}_${material.name}_${matrices.length}_${batchIndex++}`;
      im.userData.keepSolidInFallback = this.keepSolid; im.userData.partIds = references.map(r=>r?.id ?? null);
      references.forEach((record,index)=>{if(record){record.meshName=im.name;record.instanceIndex=index;}});
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

/** Preserve a human-size guard above its own walking datum while the hall
 * gets taller. For flights the datum is the sloping pitch line; the shear
 * changes the stair slope without stretching vertical guard ornaments. */
function humanRailBatch(batch, datumY, slopeX=0) {
  const copy=new Batch(batch.group,batch.keepSolid);copy.records=batch.records;
  copy.verticalTransform=new THREE.Matrix4().set(
    1,0,0,0,
    (1-HUMAN_RAIL_SCALE)*slopeX,HUMAN_RAIL_SCALE,0,(1-HUMAN_RAIL_SCALE)*datumY,
    0,0,1,0,
    0,0,0,1,
  );
  return copy;
}

/** A single newel is shared by every rail run that ends at the same joint. */
function railPost(batch, m, x, y, z, registry) {
  const key = [x, y, z].map(v => v.toFixed(4)).join('/');
  if (registry?.has(key)) return key;
  if (registry) registry.set(key, { id: key, x, y, z, radius: .105, minY: y, maxY: y + 1.346 * HUMAN_RAIL_SCALE });
  batch.box(m.red, x, y + .60, z, .14, 1.20, .14);
  batch.box(m.dark, x, y + 1.19, z, .20, .07, .20);
  batch.add(GEOMETRY.octagon, m.wood, [x, y + 1.26, z], [.105, .07, .105]);
  batch.add(GEOMETRY.sphere, m.gold, [x, y + 1.31, z], [.034, .036, .034]);
  return key;
}

/** Flat rail panels stop at the faces of their posts rather than crossing them. */
function rail(batch, m, a, b, y, obstacles, options = {}) {
  batch=humanRailBatch(batch,y);
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
    if(i===0&&options.startColumn)posts.push(options.startColumn.id);
    else if(i===bays&&options.endColumn)posts.push(options.endColumn.id);
    else posts.push(railPost(batch, m, alongX ? cx + off : cx, y, alongX ? cz : cz + off, options.postRegistry));
  }
  for (let i = 0; i < bays; i++) {
    const start=-width/2+i*unit+(i===0&&options.startColumn?options.startColumn.radius:.0725);
    const end=-width/2+(i+1)*unit-(i===bays-1&&options.endColumn?options.endColumn.radius:.0725);
    const off=(start+end)/2,clear=Math.max(.03,end-start);
    const spanning=(yy,h,d,material)=>{
      const left=i===0?options.startColumn:null,right=i===bays-1?options.endColumn:null;
      if(!left&&!right){put(off,yy,clear,h,d,material);return;}
      // A concave end grain follows the round pillar. No endpoint newel is
      // hidden in the main shaft, and no square cut floats from its sides.
      const shape=new THREE.Shape(),steps=10,half=d/2;
      const edge=(column,v,isLeft)=>column?(isLeft?-width/2:width/2)+(isLeft?1:-1)*(Math.sqrt(column.radius**2-v**2)+.001):(isLeft?start:end);
      shape.moveTo(edge(left,-half,true),-half);shape.lineTo(edge(right,-half,false),-half);
      for(let k=1;k<=steps;k++){const v=-half+k*d/steps;shape.lineTo(edge(right,v,false),v);}
      shape.lineTo(edge(left,half,true),half);
      for(let k=steps-1;k>=0;k--){const v=-half+k*d/steps;shape.lineTo(edge(left,v,true),v);}shape.closePath();
      const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,-h/2,0);
      batch.add(g,material,[cx,y+yy,cz],[1,1,1],alongX?[0,0,0]:[0,-Math.PI/2,0]);
    };
    spanning(.15,.16,.18,m.dark);spanning(1.03,.11,.18,m.wood);spanning(1.10,.055,.22,m.red);
    spanning(.85,.047,.095,m.wood);spanning(.32,.047,.095,m.wood);spanning(.163,.022,.205,m.gold);
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
    minY: y, maxY: y + 1.40 * HUMAN_RAIL_SCALE, handrailTopY:y+1.1275*HUMAN_RAIL_SCALE, heightPolicy:'human-scale', type: 'balustrade', posts, startColumn:options.startColumn?.id, endColumn:options.endColumn?.id, fittedEnds:!!(options.startColumn&&options.endColumn) };
  options.segments?.push(record);
  if (options.collision !== false) obstacles.push({ ...record });
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

/** Subtract rectangular openings without any overlapping floor faces. */
function subtractRect(rect, cut) {
  const x0=Math.max(rect.minX,cut.minX),x1=Math.min(rect.maxX,cut.maxX),z0=Math.max(rect.minZ,cut.minZ),z1=Math.min(rect.maxZ,cut.maxZ);
  if(x1<=x0||z1<=z0)return [rect];
  return [
    {...rect,maxX:x0}, {...rect,minX:x1},
    {...rect,minX:x0,maxX:x1,maxZ:z0}, {...rect,minX:x0,maxX:x1,minZ:z1},
  ].filter(r=>r.maxX-r.minX>1e-5&&r.maxZ-r.minZ>1e-5);
}
const intersectsXZ=(a,b,eps=1e-7)=>Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)>eps&&Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)>eps;

export function buildArchitectureV7({ paintTexture=null, reliefTexture=null, caissonTexture=null, ridgeBeastAtlasTexture=null, ridgeCeramicTexture=null }={}) {
  const group=new THREE.Group();group.name='MingLibraryV7_Architecture';
  const makeGroup=name=>{const g=new THREE.Group();g.name=name;group.add(g);return g;};
  const structure=makeGroup('01_TwoStorey_Columns_Beams');
  const envelope=makeGroup('02_Walls_And_Lattice_Windows');
  const upperFloor=makeGroup('03_Upper_Gallery_And_Balustrade');
  const ceiling=makeGroup('04_Rafters_Caissons_And_Timber_Ceiling');
  const roof=makeGroup('05_Double_Hipped_Glazed_Roofs');
  const staircase=makeGroup('06_Twin_Staircases');
  const details=makeGroup('07_Architectural_Details');
  const timber=timberTexture();
  const make=(name,color,options={})=>{const mat=new THREE.MeshStandardMaterial({color,roughness:.72,...options});mat.name=name;return mat;};
  const m={
    red:make('Aged_Vermilion',V12_COLUMN_COLOR,{map:timber,roughness:.53}),redLight:make('Vermilion_Endgrain',V12_COLUMN_COLOR,{map:timber,roughness:.57}),
    wood:make('Warm_Walnut',0x765334,{map:timber,roughness:.58}),dark:make('Dark_Joinery',0x37291d,{map:timber}),
    teal:make('Mineral_Green',0x24685f),blue:make('Mineral_Blue',0x143f6a),gold:make('Muted_Gilt',0xc6a146,{metalness:.48,roughness:.43}),
    bronze:make('Patinated_Bronze',0x706145,{metalness:.62,roughness:.59}),stone:palaceStoneMaterialV12(),
    plaster:make('Ivory_Lime_Plaster',0xd3c9af,{roughness:.96}),
    paper:make('Lantern_Silk',0xffe5b6,{emissive:0xffbd67,emissiveIntensity:.45,roughness:.86}),
    window:make('Lattice_Translucent_Paper',0xece1c3,{emissive:0xe9cda0,emissiveIntensity:.18,side:THREE.DoubleSide,roughness:.95}),
  };
  m.column=palaceColumnMaterialV12();m.joinery=palaceJoineryMaterialV12();
  m.joineryEdge=make('Traditional_Hardwood_Worn_Edge',0x79583d,{roughness:.67});
  const stairMaterials={...m,red:m.joinery,wood:m.joinery,dark:m.joinery,gold:m.joineryEdge};
  let pillarRelief=null;
  if(reliefTexture?.image){
    if(typeof document!=='undefined'){
      const image=reliefTexture.image,w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
      pillarRelief=texture(1536,1536,(ctx,width,height)=>ctx.drawImage(image,w*.08,h*.08,w*.84,h*.84,0,0,width,height),[1,3]);
    }else{
      // Reusable/Node construction keeps the same source relief attached to
      // the real shaft even when canvas cropping is unavailable.
      pillarRelief=reliefTexture.clone();pillarRelief.wrapS=pillarRelief.wrapT=THREE.RepeatWrapping;pillarRelief.repeat.set(1,3);
    }
    // Keep the photographed motif's metres per repeat as the shaft shortens.
    // The upper edge crops a repeat instead of vertically squeezing every dragon.
    pillarRelief.repeat.y=3*(upperLocalYV15(13.30)-.30)/13;
    pillarRelief.anisotropy=16;pillarRelief.name='ArchitecturalDetail_Engraved_Gold_Column';
  }
  m.goldPillar=make('Gold_Column_Engraved_Surface',0xd4ac4d,{map:pillarRelief,metalness:.44,roughness:.46});
  const sb=new Batch(structure,true),sd=new Batch(structure),fb=new Batch(upperFloor,true),fd=new Batch(upperFloor),cb=new Batch(ceiling,true),cd=new Batch(ceiling),tb=new Batch(staircase,true),td=new Batch(staircase),db=new Batch(details);
  const obstacles=[],lanterns=[],landingRects=[],railSegments=[],columnFootprints=[],galleryBeamSegments=[],supportConnections=[],joinery=[],structuralParts=[],stairs=[],stairZones=[],paintedBeamRuns=[],sharedPerimeterSupports=[],kneeBraces=[];
  const unifiedFrame={version:10,lowerCeilingRects:[],lowerCeilingParts:[],lowerJoists:[],lowerLaths:[],groundTransfers:[],primaryBeams:[],rimSockets:[],cornerRimExtensions:[],sharedGroundCarriers:[],upperCeilingRects:[],upperCeilingParts:[],upperEdgeLedgers:[],upperEdgeRisers:[]};
  const partMap=new Map(),railPosts=new Map();let serial=0,columns=0;
  const solidBox=(batch,material,id,x,y,z,w,h,d,type='beam')=>{
    const r={id:id||`part-${++serial}`,type,minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2};
    structuralParts.push(r);partMap.set(r.id,r);batch.add(GEOMETRY.box,material,[x,y,z],[w,h,d],[0,0,0],true,r);return r;
  };
  const solidCylinder=(batch,material,id,x,y,z,radius,h,type='column')=>{
    const r={id,type,minX:x-radius,maxX:x+radius,minY:y-h/2,maxY:y+h/2,minZ:z-radius,maxZ:z+radius,radius};
    structuralParts.push(r);partMap.set(id,r);batch.add(GEOMETRY.cylinder,material,[x,y,z],[radius,h,radius],[0,0,0],true,r);return r;
  };
  const columnBaseGeometry=palaceColumnBaseGeometryV12();
  const solidColumnBase=(id,x,z,radius)=>{
    const r={id,type:'columnBase',minX:x-radius,maxX:x+radius,minY:0,maxY:.30,minZ:z-radius,maxZ:z+radius,radius,baseFamily:'closed-profiled-low-drum'};
    structuralParts.push(r);partMap.set(id,r);sb.add(columnBaseGeometry,m.stone,[x,0,z],[radius/.64,1,radius/.64],[0,0,0],true,r);return r;
  };
  const connect=(upper,lower,type='bearing',axis='y',extra={})=>{
    const a=typeof upper==='string'?partMap.get(upper):upper,b=typeof lower==='string'?partMap.get(lower):lower;
    if(!a||!b)throw new Error('Missing structural connection member');
    const record={id:`connection-${supportConnections.length+1}`,type,upperId:a.id,lowerId:b.id,axis,
      contactY:axis==='y'?(a.minY+b.maxY)/2:null,
      overlapX:Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX),overlapZ:Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ),...extra};
    supportConnections.push(record);return record;
  };
  const railing=(batch,a,b,y,options={})=>rail(batch,options.materials??m,a,b,y,obstacles,{...options,postRegistry:railPosts,segments:railSegments});
  const floorMat=make('Large_Grey_Floor_Brick',0xffffff,{map:brickTexture(),roughness:.76});
  const galleryMat=make('Gallery_Timber_Planks',0xe1c99e,{map:plankTexture(),roughness:.67});
  const floor=solidBox(sb,floorMat,'ground-floor',0,-.17,0,48.4,.34,66.4,'floor');
  const groundRects=[{minX:-24.2,maxX:24.2,minZ:-33.2,maxZ:33.2,y:0}];
  // The inlay and the visitor's main axis are now both X, facing the throne.
  for(const z of [-2.65,2.65])sd.box(m.stone,1.8,.007,z,39.8,.013,.035);
  for(const x of [-17.8,21.7])sd.box(m.stone,x,.007,0,.035,.013,5.34);
  let galleryRects=[{minX:-FRAME.gallery.halfX,maxX:FRAME.gallery.halfX,minZ:-FRAME.gallery.halfZ,maxZ:FRAME.gallery.halfZ,y:UPPER_Y}];
  for(const hole of [ATRIUM,...STAIR_HOLES])galleryRects=galleryRects.flatMap(r=>subtractRect(r,hole));
  for(const [i,r]of galleryRects.entries()) {
    const mat=galleryMat.clone();mat.name=`Gallery_Planks_${i+1}`;
    if(galleryMat.map){mat.map=galleryMat.map.clone();mat.map.repeat.set((r.maxX-r.minX)/2,(r.maxZ-r.minZ)/8);}
    solidBox(fb,mat,`gallery-slab-${i+1}`,(r.minX+r.maxX)/2,6.19,(r.minZ+r.maxZ)/2,r.maxX-r.minX,.22,r.maxZ-r.minZ,'floor');
  }
  upperFloor.userData={floorY:UPPER_Y,atrium:{...ATRIUM},galleryRects,stairHoles:STAIR_HOLES.map(h=>({...h}))};
  // The exterior's real 28 floor-to-roof posts are already part of this frame.
  // Build them before the upper beams so the end rows can share their actual
  // bearing members instead of duplicating a second row just 730 mm inside.
  const exterior=buildExteriorV6({envelope,obstacles,paintTexture});envelope.userData.exterior=exterior.metadata;
  const sharedGroundCarriers=exterior.supportConnections.filter(r=>r.kind==='continuous-wall-header').map(r=>{
    const part={id:'shared-'+r.id,type:'shared-lower-wall-header',...r.bounds,meshName:r.meshName,instanceIndex:r.instanceIndex,externalSource:true,face:r.face};
    structuralParts.push(part);partMap.set(part.id,part);unifiedFrame.sharedGroundCarriers.push(part.id);return part;
  });
  const sharedGroundIds=new Set((exterior.groundFrameConnections??[]).flatMap(c=>[c.upperId,c.lowerId,c.tenonId].filter(Boolean)));
  const sharedGroundMembers=[];
  for(const r of exterior.supportConnections.filter(r=>sharedGroundIds.has(r.id))){
    const id='shared-'+r.id;let part=partMap.get(id);
    if(!part){part={id,type:'shared-lower-'+r.kind,...r.bounds,meshName:r.meshName,instanceIndex:r.instanceIndex,externalSource:true,face:r.face};structuralParts.push(part);partMap.set(id,part);}
    sharedGroundMembers.push(part);
    if(r.kind==='column-plinth')connect(part,floor);
  }
  for(const c of exterior.groundFrameConnections??[]){
    const extra={...c,tenonId:c.tenonId?'shared-'+c.tenonId:undefined,externalFrame:true};delete extra.id;delete extra.upperId;delete extra.lowerId;delete extra.axis;delete extra.type;
    connect('shared-'+c.upperId,'shared-'+c.lowerId,c.type,c.axis,extra);
  }
  const sharedWallPosts=exterior.supportConnections.filter(r=>r.kind==='floor-to-roof-upper-post').map(r=>{
    const part={id:'shared-'+r.id,type:'shared-exterior-post',...r.bounds,radius:r.radius??.42,meshName:r.meshName,instanceIndex:r.instanceIndex,externalSource:true,continuous:true};
    structuralParts.push(part);partMap.set(part.id,part);sharedPerimeterSupports.push(part);
    const baseRecord=exterior.supportConnections.find(q=>q.id===r.baseId);
    if(baseRecord){
      const base={id:'shared-'+baseRecord.id,type:'columnBase',...baseRecord.bounds,meshName:baseRecord.meshName,instanceIndex:baseRecord.instanceIndex,externalSource:true};
      structuralParts.push(base);partMap.set(base.id,base);connect(base,floor);connect(part,base);
    }
    columnFootprints.push({id:part.id,x:(part.minX+part.maxX)/2,z:(part.minZ+part.maxZ)/2,y:0,radius:.56,shaftRadius:part.radius,baseRadius:.56,baseHeight:.30,minY:0,maxY:upperLocalYV15(14.12),continuous:true,externalSource:true});
    columns++;return part;
  });
  const columnNodes=COLUMN_X.flatMap(x=>COLUMN_Z.map(z=>({x,z})));
  const nodes=[new Map(),new Map()];
  const key=(x,z)=>`${x.toFixed(3)}/${z.toFixed(3)}`;
  const collarCache=new Map();
  // Each intermediate joint is bored around the continuous shaft. A solid
  // cube through an uncut cylinder would be a visible modelling collision.
  const columnCollar=(id,x,y,z,width,height,radius,type='joint-node')=>{
    const cacheKey=[width,height,radius].join('/');
    if(!collarCache.has(cacheKey)){
      const shape=new THREE.Shape(),h=width/2;shape.moveTo(-h,-h);shape.lineTo(h,-h);shape.lineTo(h,h);shape.lineTo(-h,h);shape.closePath();
      const hole=new THREE.Path();hole.absarc(0,0,radius+.001,0,Math.PI*2,true);shape.holes.push(hole);
      const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1,curveSegments:28});g.rotateX(-Math.PI/2);g.translate(0,-height/2,0);collarCache.set(cacheKey,g);
    }
    const part={id,type,minX:x-width/2,maxX:x+width/2,minY:y-height/2,maxY:y+height/2,minZ:z-width/2,maxZ:z+width/2,boreRadius:radius+.001};
    structuralParts.push(part);partMap.set(id,part);sb.add(collarCache.get(cacheKey),m.red,[x,y,z],[1,1,1],[0,0,0],true,part);return part;
  };
  const continuousColumns=[];
  const makeContinuousColumn=(x,z,{id=`continuous-column-${x}-${z}`,radius=.42,material=m.column,shared=null,ceremonial=false}={})=>{
    let shaft=shared,base=null,cap=null;
    if(!shared){
      const baseRadius=ceremonial?.72:.56;base=solidColumnBase(`${id}-base`,x,z,baseRadius);
      const shaftBottom=.30,shaftTop=upperLocalYV15(13.30);
      shaft=solidCylinder(sb,material,`${id}-shaft`,x,(shaftBottom+shaftTop)/2,z,radius,shaftTop-shaftBottom,'column');
      cap=solidBox(sb,material,`${id}-capital`,x,upperLocalYV15(13.41),z,1.12,.22,1.12,'capital');
      connect(base,floor);connect(shaft,base);connect(cap,shaft);
      columnFootprints.push({id,x,z,y:0,radius:baseRadius,shaftRadius:radius,baseRadius,baseHeight:.30,minY:0,maxY:upperLocalYV15(13.52),continuous:true,ceremonial});
      obstacles.push({minX:x-baseRadius,maxX:x+baseRadius,minZ:z-baseRadius,maxZ:z+baseRadius,minY:0,maxY:.30,type:'columnBase'},{minX:x-radius,maxX:x+radius,minZ:z-radius,maxZ:z+radius,minY:.30,maxY:upperLocalYV15(13.52),type:'column'});columns++;
    }
    const record={id,x,z,radius,shaftId:shaft.id,baseId:base?.id,continuous:true,shared:!!shared,ceremonial};continuousColumns.push(record);
    for(const level of[0,1]){
      if(ceremonial&&!level)continue;
      const node=(!level||shared)?columnCollar(`${id}-node-${level}`,x,level?upperLocalYV15(13.82):5.62,z,1.12,level?.60:.64,radius):solidBox(sb,m.red,`${id}-node-${level}`,x,upperLocalYV15(13.82),z,1.12,.60,1.12,'joint-node');
      if(!level||shared)connect(node,shaft,'housed-through-column','x',{continuousColumn:true,boreRadius:radius+.001});else connect(node,cap);
      nodes[level].set(key(x,z),{x,z,part:node,shaft,small:false,sharedExterior:!!shared,continuous:true,ceremonial});
    }
    return record;
  };
  const clearGalleryTransferNodes=[];
  for(const n of columnNodes){
    const peripheral=Math.abs(n.x)===17.73||Math.abs(n.z)===25.73;
    // Four outer members formerly stood in the cross-gallery, next to the
    // genuine atrium corner columns. Their column shafts and bases are gone.
    // Short back-spanned arms from those inner columns carry these joints;
    // the joints remain real timber intersections, not imaginary supports.
    if(Math.abs(Math.abs(n.x)-17.73)<1e-6&&Math.abs(Math.abs(n.z)-7.35)<1e-6){
      for(const level of[0,1]){
        const part=solidBox(sb,m.red,`clear-gallery-transfer-node-${level}-${n.x}-${n.z}`,n.x,level?upperLocalYV15(13.82):5.62,n.z,1.12,level?.60:.64,1.12,'joint-node');
        nodes[level].set(key(n.x,n.z),{...n,part,shaft:null,small:false,sharedExterior:false,continuous:false,transferOnly:true});
        clearGalleryTransferNodes.push({id:part.id,level,x:n.x,z:n.z,carrierColumnX:Math.sign(n.x)*14.68,projection:3.05});
      }
      continue;
    }
    const shared=peripheral?sharedWallPosts.find(p=>Math.abs((p.minX+p.maxX)/2-n.x)<.001&&Math.abs((p.minZ+p.maxZ)/2-n.z)<.001):null;
    if(peripheral&&!shared)throw new Error(`Missing continuous perimeter column at ${n.x}/${n.z}`);
    makeContinuousColumn(n.x,n.z,{shared});
  }
  for(const x of[-14.68,14.68])for(const z of[-7.35,7.35])makeContinuousColumn(x,z,{id:`atrium-corner-column-${x}-${z}`});
  const stairTrimX=[-1.22,13.18];
  // Stairwell headers are carried by the common primary beam grid below.
  // No independent slender posts are introduced around each opening.

  const continuousPaint=prepareContinuousFriezeTexture(paintTexture);
  const paintMaterial=continuousPaint?make('Crisp_Continuous_Painted_Beam',0xffffff,{map:continuousPaint,roughness:.69,side:THREE.DoubleSide}):null;
  const paintAspect=(paintTexture?.image?.width||2172)/(paintTexture?.image?.height||724);
  const paintGeometryCache=new Map();
  const paintStrip=(axis,x,y,z,length,depth,height=.42)=>{
    if(length<.22)return;
    for(const sign of [-1,1]){
      if(axis==='x'){
        sd.box(m.teal,x,y,z+sign*(depth/2+.008),length,height,.016);
        for(const dy of[-height/2+.022,height/2-.022])sd.box(m.gold,x,y+dy,z+sign*(depth/2+.02),length,.025,.012);
      }else{
        sd.box(m.teal,x+sign*(depth/2+.008),y,z,.016,height,length);
        for(const dy of[-height/2+.022,height/2-.022])sd.box(m.gold,x+sign*(depth/2+.02),y+dy,z,.012,.025,length);
      }
      if(paintMaterial){
        // One full-length face. A global coordinate phase makes adjacent beam
        // and joint-block faces meet at exactly the same source-image position.
        const ph=height-.07,direction=axis==='x'?sign:-sign,center=axis==='x'?x:z;
        const phase=(direction*center-length/2)/(ph*paintAspect),cacheKey=[length,ph,phase].map(v=>v.toFixed(6)).join('/');
        if(!paintGeometryCache.has(cacheKey))paintGeometryCache.set(cacheKey,continuousFriezeGeometry(length,ph,{aspect:paintAspect,phase}));
        const geometry=paintGeometryCache.get(cacheKey),position=axis==='x'?[x,y,z+sign*(depth/2+.021)]:[x+sign*(depth/2+.021),y,z],rotation=axis==='x'?[0,sign<0?Math.PI:0,0]:[0,sign*Math.PI/2,0];
        const id=`interior-frieze-${paintedBeamRuns.length+1}`,record={id,axis,sign,position,width:length,height:ph,depth,phase,sourceAspect:paintAspect,direction,center};
        sd.add(geometry,paintMaterial,position,[length,ph,1],rotation,false,record);paintedBeamRuns.push(record);
      }else{
        for(let o=-length/2+.52;o<length/2-.25;o+=.95){
          if(axis==='x')sd.box(m.gold,x+o,y,z+sign*(depth/2+.022),.12,.12,.018,0,Math.PI/4);
          else sd.add(GEOMETRY.box,m.gold,[x+sign*(depth/2+.022),y,z+o],[.018,.12,.12],[Math.PI/4,0,0]);
        }
      }
    }
  };
  const deepenAndBrace=(beam,a,b,axis,level,depth)=>{
    const length=axis==='x'?beam.maxX-beam.minX:beam.maxZ-beam.minZ;if(length<12||!a.shaft||!b.shaft)return;
    const alongX=axis==='x',cx=(beam.minX+beam.maxX)/2,cz=(beam.minZ+beam.maxZ)/2;
    // The throne-axis transfer already bears on two full-height gold columns.
    // Its datum-adjusted soffit must meet their capitals; a lower deepening
    // would cut into those existing intermediate bearings.
    const soffit=solidBox(sb,m.red,beam.id+'-deepened-underside',cx,beam.minY-.18,cz,alongX?length-.60:depth,.36,alongX?depth:length-.60,'deepened-transfer-beam');
    connect(beam,soffit);
    // The deeper horizontal timber is seated against the beam's underside.
    // Reference photographs show no diagonal knee members in this hall.
    // The original beam shoulders and their housed column joints remain.

  };
  const housedBeam=(a,b,level,label='frame-beam',depth=.84)=>{
    const alongX=Math.abs(a.x-b.x)>Math.abs(a.z-b.z),axis=alongX?'x':'z';
    const amin=alongX?a.part.minX:a.part.minZ,amax=alongX?a.part.maxX:a.part.maxZ,bmin=alongX?b.part.minX:b.part.minZ,bmax=alongX?b.part.maxX:b.part.maxZ;
    const forward=(alongX?b.x-a.x:b.z-a.z)>0,start=forward?amax:bmax,end=forward?bmin:amin,len=end-start;
    if(len<=.01)return null;
    const x=alongX?(start+end)/2:a.x,z=alongX?a.z:(start+end)/2,y=level?upperLocalYV15(13.82):5.62;
    const beam=solidBox(sb,m.red,`${label}-${level}-${a.x}-${a.z}-${b.x}-${b.z}`,x,y,z,alongX?len:depth,level?.60:.64,alongX?depth:len,label);
    for(const n of[a,b]){
      const coord=alongX?n.x:n.z,near=coord<(start+end)/2?start:end,sign=coord<(start+end)/2?-1:1;
      const t=solidBox(sb,m.wood,`${beam.id}-tenon-${n.x}-${n.z}`,alongX?near+sign*.08:x,y,alongX?z:near+sign*.08,alongX?.16:.20,.24,alongX?.20:.16,'tenon');
      // A transfer-only outer node is carried by the transverse arm from
      // its real inner column; it cannot also be that arm's support. Keep
      // the same housed geometry while recording the actual load direction.
      const carriedNode=alongX&&n.transferOnly&&[a,b].some(q=>q!==n&&q.shaft);
      const c=connect(carriedNode?n.part:beam,carriedNode?beam:n.part,'housed-tenon',axis,{tenonId:t.id,tenonDepth:.16,visibleGap:0,...(carriedNode?{backspannedTransfer:true}: {})});joinery.push(c);
      // Endgrain pegs are embedded in the joint block, not suspended decor.
      if(alongX)sd.rod(m.gold,[n.x,y,n.z-(n.small?.135:.426)],[n.x,y,n.z+(n.small?.135:.426)],.025);
      else sd.rod(m.gold,[n.x-(n.small?.135:.426),y,n.z],[n.x+(n.small?.135:.426),y,n.z],.025);
    }
    paintStrip(axis,x,y,z,len,depth);
    deepenAndBrace(beam,a,b,axis,level,depth);
    if(!level)galleryBeamSegments.push({...beam,name:label});return beam;
  };

  // One perimeter beam line connects the same continuous wall columns.
  const sharedTransferLinks=[];
  // Joint-block paintings share the same phase as the full beam surfaces.
  for(const level of[0,1])for(const n of nodes[level].values())for(const axis of['x','z'])paintStrip(axis,n.x,level?upperLocalYV15(13.82):5.62,n.z,n.small?.26:1.12,n.small?.26:1.12);
  for(const level of[0,1]){
    for(const z of COLUMN_Z){const line=[...nodes[level].values()].filter(n=>Math.abs(n.z-z)<1e-5).sort((a,b)=>a.x-b.x);for(let i=0;i<line.length-1;i++)housedBeam(line[i],line[i+1],level);}
    for(const x of [...COLUMN_X,-14.68,14.68]){
      const line=[...nodes[level].values()].filter(n=>Math.abs(n.x-x)<1e-5).sort((a,b)=>a.z-b.z);
      for(let i=0;i<line.length-1;i++){
        const a=line[i],b=line[i+1],mid={minX:x-.19,maxX:x+.19,minZ:a.z+.01,maxZ:b.z-.01};
        if(!level&&([ATRIUM,...STAIR_HOLES].some(h=>intersectsXZ(mid,h))))continue;
        // The throne-axis span is framed around the real caisson opening
        // below, with headers carried by the gold columns and side trimmers
        // connected back into these original upper frames.
        if(level&&Math.abs(x)<.00001&&Math.abs(a.z+7.35)<.00001&&Math.abs(b.z-7.35)<.00001)continue;
        housedBeam(a,b,level);
      }
    }
  }
  const goldColumnPositions=[],ceremonialColumnPositions=[];
  for(const x of[-4.9,4.9])for(const z of[-4.9,4.9]){
    const front=x>0,gold=true,id=`${front?'gold':'red-couplet'}-pillar-${z}`;
    const record=makeContinuousColumn(x,z,{id,radius:front?.50:.42,material:m.goldPillar,ceremonial:true});
    const position={...record,shaftRadius:front?.50:.42,shaftBottomY:.30,shaftTopY:upperLocalYV15(13.30),baseTopY:.30,capitalTopY:upperLocalYV15(13.52),topY:upperLocalYV15(13.52)};
    ceremonialColumnPositions.push(position);if(gold)goldColumnPositions.push(position);
    for(const axis of['x','z'])paintStrip(axis,x,upperLocalYV15(13.82),z,1.12,1.12);
  }
  const caissonMainFrame={headers:[],sides:[],outerStubs:[],connections:[],columnIds:ceremonialColumnPositions.map(p=>p.id),supportMethod:'four-column-main-frame-with-housed-ceiling-bridges',removedInnerParallelMembers:6};
  const caissonHousedEnd=(beam,host,axis,edge,direction,label)=>{
    const x=(beam.minX+beam.maxX)/2,z=(beam.minZ+beam.maxZ)/2;
    const tenon=solidBox(sb,m.wood,`${beam.id}-tenon-${label}`,axis==='x'?edge+direction*.08:x,upperLocalYV15(13.82),axis==='x'?z:edge+direction*.08,axis==='x'?.16:.18,.22,axis==='x'?.18:.16,'tenon');
    const c=connect(beam,host,'housed-tenon',axis,{tenonId:tenon.id,tenonDepth:.16,visibleGap:0,caissonFrame:true});joinery.push(c);caissonMainFrame.connections.push(c.id);
  };
  for(const z of[-4.9,4.9]){const beam=housedBeam(nodes[1].get(key(-4.9,z)),nodes[1].get(key(4.9,z)),1,'caisson-main-header',.84);caissonMainFrame.headers.push(beam.id);}
  for(const x of[-4.9,4.9]){const beam=housedBeam(nodes[1].get(key(x,-4.9)),nodes[1].get(key(x,4.9)),1,'ceremonial-crossbeam',.84);caissonMainFrame.headers.push(beam.id);}
  // The marked narrow parallel members and their returns are removed at
  // source, including paint and tenons. The well curb retains its existing
  // ceiling-level housed bridges and joists, seated on this four-column
  // primary square. No replacement rail crosses the open throne well.
  for(const side of[-1,1]){
    const header=partMap.get(caissonMainFrame.headers[side<0?0:1]),node=nodes[1].get(key(0,side*7.35));
    const a=side*5.32,b=side*6.79,stub=solidBox(sb,m.red,`caisson-axis-outer-beam-${side}`,0,upperLocalYV15(13.82),(a+b)/2,.84,.60,Math.abs(b-a),'frame-beam');
    caissonHousedEnd(stub,header,'z',a,-side,'header');caissonHousedEnd(stub,node.part,'z',b,side,'original-node');paintStrip('z',0,upperLocalYV15(13.82),(a+b)/2,Math.abs(b-a),.84);caissonMainFrame.outerStubs.push(stub.id);
  }
  // Each opening is framed into the existing primary beams, rather than
  // receiving four extra ground columns. The pair of transverse headers
  // tenons into the Z=±17.05 / ±25.73 girders; the side trimmers then tenon
  // into those headers. Every visible shoulder has a measured real carrier.
  const stairOpeningFrames=[];
  const framedEnd=(beam,host,axis,edge,direction,label)=>{
    const x=(beam.minX+beam.maxX)/2,z=(beam.minZ+beam.maxZ)/2,y=FRAME.groundBeam.centerY;
    const tenon=solidBox(sb,m.wood,`${beam.id}-tenon-${label}`,axis==='x'?edge+direction*.08:x,y,axis==='x'?z:edge+direction*.08,axis==='x'?.16:.18,.24,axis==='x'?.18:.16,'tenon');
    const c=connect(beam,host,'housed-tenon',axis,{tenonId:tenon.id,tenonDepth:.16,visibleGap:0,sharedStairOpening:true});joinery.push(c);return c;
  };
  for(const s of[-1,1]){
    const mainLines=[s*17.05,s*25.73].sort((a,b)=>a-b),headers=[];
    for(const x of stairTrimX){
      const hosts=mainLines.map(z=>structuralParts.find(p=>p.type==='frame-beam'&&p.maxY<6&&Math.abs((p.minZ+p.maxZ)/2-z)<1e-5&&p.minX<x&&p.maxX>x));
      if(hosts.some(p=>!p))throw new Error(`Stair header has no primary beam carrier ${s}/${x}`);
      const start=hosts[0].maxZ,end=hosts[1].minZ;
      const beam=solidBox(sb,m.red,`stairwell-header-${s}-${x}`,x,5.62,(start+end)/2,.44,.64,end-start,'stairwell-header');
      framedEnd(beam,hosts[0],'z',start,-1,'near-primary');framedEnd(beam,hosts[1],'z',end,1,'far-primary');
      galleryBeamSegments.push({...beam,name:beam.type});paintStrip('z',x,5.62,(start+end)/2,end-start,.44);headers.push(beam);
      stairOpeningFrames.push({id:beam.id,role:'shared-primary-carried-header',carrierIds:hosts.map(p=>p.id)});
    }
    for(const z of[s*(FRAME.stairs.centerZ-FRAME.stairs.holeHalfZ-.15),s*(FRAME.stairs.centerZ+FRAME.stairs.holeHalfZ+.15)]){
      const start=headers[0].maxX,end=headers[1].minX;
      const beam=solidBox(sb,m.red,`stairwell-trimmer-${s}-${z}`,(start+end)/2,5.62,z,end-start,.64,.30,'stairwell-trimmer');
      framedEnd(beam,headers[0],'x',start,-1,'left-header');framedEnd(beam,headers[1],'x',end,1,'right-header');
      galleryBeamSegments.push({...beam,name:beam.type});paintStrip('x',(start+end)/2,5.62,z,end-start,.30);
      stairOpeningFrames.push({id:beam.id,role:'header-carried-side-trimmer',carrierIds:headers.map(p=>p.id)});
    }
  }
  const frameBeam=(id,x,z,w,d,type='gallery-rim',paintAxis=null)=>{
    const b=solidBox(sb,m.red,id,x,5.62,z,w,.64,d,type);galleryBeamSegments.push({...b,name:type});paintStrip(paintAxis??(w>d?'x':'z'),x,5.62,z,Math.max(w,d),Math.min(w,d));return b;
  };
  const rims=[],outerRimAssemblies={x:{},z:{}},rimSockets=[];
  // The primary perimeter beams themselves are the gallery rim. There is no
  // second parallel rim passing through the continuous column shafts.
  for(const axis of['x','z'])for(const side of[-1,1]){
    const normal=side*(axis==='x'?17.73:25.73),lo=axis==='x'?'minZ':'minX',hi=axis==='x'?'maxZ':'maxX';
    const members=structuralParts.filter(p=>p.type==='frame-beam'&&p.maxY<6&&Math.abs((axis==='x'?(p.minX+p.maxX)/2:(p.minZ+p.maxZ)/2)-normal)<.001).sort((a,b)=>a[lo]-b[lo]);
    for(const p of members)Object.assign(p,{normalAxis:axis,side,spanStart:p[lo],spanEnd:p[hi]});
    outerRimAssemblies[axis][side]=members;rims.push(...members);
  }
  for(const x of[-14.68,14.68]){
    const beam=housedBeam(nodes[0].get(key(x,-7.35)),nodes[0].get(key(x,7.35)),0,'gallery-rim',.36);rims.push(beam);
  }
  for(const p of structuralParts.filter(p=>p.type==='frame-beam'&&p.maxY<6&&Math.abs(Math.abs((p.minZ+p.maxZ)/2)-7.35)<.001))rims.push(p);
  // Every floor joist ends over a primary beam or a framed opening; the narrow
  // outer strips are short cantilevers over the perimeter ring.
  const lowerSupports=structuralParts.filter(p=>Math.abs(p.maxY-5.94)<1e-6&&p.type!=='tenon');
  for(let k=0;k<=70;k++){
    const z=-25.83+k*(51.66/70),line={minX:-17.94,maxX:17.94,minZ:z-.07,maxZ:z+.07};
    let spans=[line];for(const cut of[ATRIUM,...STAIR_HOLES])spans=spans.flatMap(r=>subtractRect(r,cut));
    for(const span of spans){
      if(span.maxZ-span.minZ<.139)continue;
      const xs=[span.minX,...COLUMN_X.filter(x=>x>span.minX+.02&&x<span.maxX-.02),span.maxX];
      for(let i=0;i<xs.length-1;i++){
        const lo=xs[i],hi=xs[i+1];if(hi-lo<.02)continue;
        const joist=solidBox(sb,m.wood,`floor-joist-${k}-${serial++}`, (lo+hi)/2,6.01,z,hi-lo,.14,.14,'floor-joist');galleryBeamSegments.push({...joist,name:'floor-joist'});
        for(const support of lowerSupports)if(intersectsXZ(joist,support))connect(joist,support);
      }
    }
  }
  for(const slab of structuralParts.filter(p=>p.type==='floor'&&p.id.startsWith('gallery-slab')))for(const joist of structuralParts.filter(p=>p.type==='floor-joist'))if(intersectsXZ(slab,joist))connect(slab,joist);

  // The lower hall, its wall and the external colonnade are one frame. Real
  // radial beams enter the shared wall receiver, which in turn is housed into
  // the existing external columns. The setback above is retained, while a
  // supported timber ceiling closes the entire ground-floor perimeter aisle.
  const registerExteriorPart=(r,type='shared-exterior-joint')=>{
    const id='shared-'+r.id;let p=partMap.get(id);
    if(!p){p={id,type,...r.bounds,meshName:r.meshName,instanceIndex:r.instanceIndex,externalSource:true,face:r.face};structuralParts.push(p);partMap.set(id,p);}
    return p;
  };
  const primaryBeams=[];
  for(const axis of['x','z'])for(const side of[-1,1])for(const u of axis==='x'?COLUMN_Z:COLUMN_X){
    const innerX=axis==='x'?side*17.73:u,innerZ=axis==='x'?u:side*25.73,node=nodes[0].get(key(innerX,innerZ));
    const outerNormal=side*(axis==='x'?FRAME.lower.outerColumnX:FRAME.lower.outerColumnZ),outerX=axis==='x'?outerNormal:u,outerZ=axis==='x'?u:outerNormal;
    const shaftRecord=exterior.supportConnections.find(r=>r.kind==='load-bearing-round-column'&&Math.abs((r.bounds.minX+r.bounds.maxX)/2-outerX)<.001&&Math.abs((r.bounds.minZ+r.bounds.maxZ)/2-outerZ)<.001);
    // Principal radial timbers terminate at their restored or retained outer
    // shafts. If a primary station is omitted later, require paired eave
    // transfer sections and the retained inner-column backspan.
    const face=axis==='x'?(side>0?'east':'west'):(side>0?'south':'north');
    const lintelRecords=!shaftRecord?exterior.supportConnections.filter(r=>r.kind==='continuous-colonnade-beam'&&r.face===face&&(Math.abs(r.spanEnd-(u-FRAME.groundTransfers.mainWidth/2))<1e-6||Math.abs(r.spanStart-(u+FRAME.groundTransfers.mainWidth/2))<1e-6)):[];
    if(!shaftRecord&&lintelRecords.length!==2)throw new Error(`No two-sided eave joint for complete timber frame ${axis}/${side}/${u}`);
    const shaft=shaftRecord?registerExteriorPart(shaftRecord,'shared-lower-load-bearing-round-column'):null,lintels=lintelRecords.map(r=>registerExteriorPart(r,'shared-entrance-carried-lintel'));
    const lo=axis==='x'?'minX':'minZ',hi=axis==='x'?'maxX':'maxZ';
    const start=node.part[side>0?hi:lo],end=shaftRecord?outerNormal-side*.30:outerNormal+side*.235,length=Math.abs(end-start),x=axis==='x'?(start+end)/2:u,z=axis==='x'?u:(start+end)/2,id=`unified-primary-${axis}-${side}-${u}`;
    const beam=solidBox(sb,m.red,id,x,FRAME.groundBeam.centerY,z,axis==='x'?length:FRAME.groundTransfers.mainWidth,FRAME.groundTransfers.mainHeight,axis==='x'?FRAME.groundTransfers.mainWidth:length,'column-to-column-primary-beam');
    const record={id,axis,side,coordinate:u,innerNodeId:node.part.id,innerColumnId:node.shaft?.id??null,outerColumnId:shaft?.id??null,outerCarrierId:shaft?.id??null,tenonIds:[],rimSocketIds:[],wallSocketIds:[],length,...(!shaft?{bearingMode:'backspanned-entrance-outrigger',carriedEaveIds:lintels.map(p=>p.id)}:{})};
    const endJoints=[[node.part,start,-side,false],...(shaft?[[shaft,end,side,true]]:[])];
    for(const[receiver,edge,direction,round]of endJoints){
      const tenon=solidBox(sb,m.wood,`${id}-tenon-${direction}`,axis==='x'?edge+direction*.08:u,FRAME.groundBeam.centerY,axis==='x'?u:edge+direction*.08,axis==='x'?.16:.20,.24,axis==='x'?.20:.16,'tenon');
      const connection=connect(beam,receiver,round?'housed-round-column-joint':'housed-tenon',axis,{tenonId:tenon.id,tenonDepth:.16,visibleGap:0,columnToColumn:true});joinery.push(connection);record.tenonIds.push(tenon.id);
    }
    if(!shaft){
      const supportArm=structuralParts.find(p=>p.type==='frame-beam'&&p.maxY<6&&Math.abs((p.minZ+p.maxZ)/2-u)<1e-6&&Math.abs(p.maxX-node.part.minX)<1e-6);
      const innerColumn=continuousColumns.find(c=>Math.abs(c.x-14.68)<1e-6&&Math.abs(c.z-u)<1e-6),backColumn=continuousColumns.find(c=>Math.abs(c.x-10.2)<1e-6&&Math.abs(c.z-u)<1e-6);
      const backspan=structuralParts.find(p=>p.type==='frame-beam'&&p.maxY<6&&Math.abs((p.minZ+p.maxZ)/2-u)<1e-6&&p.minX>10.2&&p.maxX<14.68);
      if(!supportArm||!innerColumn||!backColumn||!backspan)throw new Error(`Entrance outrigger lacks its retained inner-column backspan: ${id}`);
      record.backspanIds=[supportArm.id,backspan.id];record.anchorColumnIds=[innerColumn.shaftId,backColumn.shaftId];
      for(const lintel of lintels){
        const direction=(lintel.minZ+lintel.maxZ)/2<u?1:-1,edge=u-direction*FRAME.groundTransfers.mainWidth/2;
        const tenon=solidBox(sb,m.wood,`${id}-eave-tenon-${direction}`,outerNormal,FRAME.groundBeam.centerY,edge+direction*.08,.20,.24,.16,'tenon');
        joinery.push(connect(lintel,beam,'housed-eave-to-backspanned-primary','z',{tenonId:tenon.id,tenonDepth:.16,visibleGap:0,carriedPortalEave:true}));record.tenonIds.push(tenon.id);
      }
    }
    // The node is already the housed junction of the perimeter girder and
    // this radial beam, so no second rim or crossing socket is generated.
    const tangent=axis==='x'?'z':'x';
    const wallSocket=exterior.groundWallBeamSockets?.find(s=>s.axis===axis&&s.side===side&&Math.abs(s.u-u)<.00001);
    if(wallSocket){
      for(const t of wallSocket.tenons){
        const tenon=registerExteriorPart(t,'shared-wall-frame-tenon'),header=partMap.get('shared-'+t.headerId);
        if(!header)throw new Error(`Missing actual wall socket member ${t.headerId}`);
        joinery.push(connect(header,beam,'housed-tenon',tangent,{tenonId:tenon.id,tenonDepth:.10,visibleGap:0,wallFrameSocket:true}));record.wallSocketIds.push(header.id);
      }
    }
    unifiedFrame.primaryBeams.push(record);primaryBeams.push(beam);galleryBeamSegments.push({...beam,name:beam.type});paintStrip(axis,x,FRAME.groundBeam.centerY,z,length,FRAME.groundTransfers.mainWidth);
  }
  // The 13 marked/intermediate narrow radial fillers have no columns of
  // their own and are removed symmetrically. The 22 main frame timbers,
  // perimeter girders and the ceiling joists' two actual bearings remain.
  unifiedFrame.removedSecondaryRadialBeams=13;
  for(const joist of structuralParts.filter(p=>p.type==='floor-joist'))for(const primary of primaryBeams)if(intersectsXZ(joist,primary))connect(joist,primary);
  for(const axis of['x','z'])for(const side of[-1,1]){
    const normal=side*((axis==='x'?FRAME.lower.wallX:FRAME.lower.wallZ)+FRAME.lower.headerOffset),half=axis==='x'?FRAME.lower.innerZ:FRAME.lower.innerX;
    paintStrip(axis==='x'?'z':'x',axis==='x'?normal:0,FRAME.groundBeam.centerY,axis==='x'?0:normal,half*2,FRAME.lower.headerDepth);
  }
  const lowerCeilingRects=[
    {id:'unified-aisle-ceiling-west',minX:-FRAME.lower.innerX,maxX:-FRAME.gallery.halfX,minZ:-FRAME.lower.innerZ,maxZ:FRAME.lower.innerZ},
    {id:'unified-aisle-ceiling-east',minX:FRAME.gallery.halfX,maxX:FRAME.lower.innerX,minZ:-FRAME.lower.innerZ,maxZ:FRAME.lower.innerZ},
    {id:'unified-aisle-ceiling-north',minX:-FRAME.gallery.halfX,maxX:FRAME.gallery.halfX,minZ:-FRAME.lower.innerZ,maxZ:-FRAME.gallery.halfZ},
    {id:'unified-aisle-ceiling-south',minX:-FRAME.gallery.halfX,maxX:FRAME.gallery.halfX,minZ:FRAME.gallery.halfZ,maxZ:FRAME.lower.innerZ},
  ];
  const aisleJoists=[],aisleSupports=[...rims,...[...nodes[0].values()].map(n=>n.part),...sharedGroundCarriers,...primaryBeams];
  const aisleJoist=(id,minX,maxX,minZ,maxZ)=>{
    const p=solidBox(cb,m.wood,id,(minX+maxX)/2,FRAME.lowerAisleCeiling.joistBottomY+FRAME.lowerAisleCeiling.joistHeight/2,(minZ+maxZ)/2,maxX-minX,FRAME.lowerAisleCeiling.joistHeight,maxZ-minZ,'lower-aisle-ceiling-joist');
    const bearings=aisleSupports.filter(q=>intersectsXZ(p,q)),continuousBearer=bearings.find(q=>p.minX>=q.minX-.00001&&p.maxX<=q.maxX+.00001&&p.minZ>=q.minZ-.00001&&p.maxZ<=q.maxZ+.00001);
    if(bearings.length<2&&!continuousBearer)throw new Error(`Aisle joist lacks two real bearings: ${id}`);
    if(continuousBearer)p.continuousBearerId=continuousBearer.id;
    for(const support of bearings)connect(p,support);aisleJoists.push(p);unifiedFrame.lowerJoists.push(p.id);return p;
  };
  const sideJoistZ=[];
  for(let i=0;i<70;i++)sideJoistZ.push(-25.83+(i+.5)*(51.66/70));
  for(const side of[-1,1]){
    for(let i=0;i<7;i++)sideJoistZ.push(side*(26.07+(i+.5)*(FRAME.lower.innerZ-26.07)/7));
    sideJoistZ.push(side*(FRAME.lower.innerZ-.07));
  }
  for(const side of[-1,1])for(const [i,z]of sideJoistZ.entries()){
    const inner=side*17.94,outer=side*(FRAME.lower.wallX+FRAME.lower.headerOffset);
    aisleJoist(`unified-aisle-joist-x-${side}-${i}`,Math.min(inner,outer),Math.max(inner,outer),z-.07,z+.07);
  }
  const endJoistCount=50,endJoistSpan=35.12,endJoistX=[-17.85,17.85];
  for(let i=0;i<endJoistCount;i++)endJoistX.push(-endJoistSpan/2+(i+.5)*endJoistSpan/endJoistCount);
  for(const side of[-1,1])for(const [i,x]of endJoistX.entries()){
    const inner=side*25.90,outer=side*(FRAME.lower.wallZ+FRAME.lower.headerOffset);
    aisleJoist(`unified-aisle-joist-z-${side}-${i}`,x-.07,x+.07,Math.min(inner,outer),Math.max(inner,outer));
  }
  unifiedFrame.lowerCeilingRegions=lowerCeilingRects.map(r=>({...r}));
  for(const r of lowerCeilingRects){
    const sideAisle=r.id.endsWith('east')||r.id.endsWith('west'),material=galleryMat.clone();material.name='Unified_Aisle_Timber_Planks_'+r.id;
    if(galleryMat.map){material.map=galleryMat.map.clone();material.map.repeat.set(.93/2,.74/8);}
    const n0=sideAisle?r.minX:r.minZ,n1=sideAisle?r.maxX:r.maxZ,t0=sideAisle?r.minZ:r.minX,t1=sideAisle?r.maxZ:r.maxX;
    const divisions=Math.ceil((n1-n0)/.94),normalCuts=Array.from({length:divisions+1},(_,i)=>n0+i*(n1-n0)/divisions);
    const alongCuts=[t0,...(sideAisle?sideJoistZ:endJoistX).filter(v=>v>t0&&v<t1).sort((a,b)=>a-b),t1],laths=[];
    for(const [i,cut]of normalCuts.entries())for(let j=0;j<alongCuts.length-1;j++){
      const normal=i===0?cut+.0175:i===normalCuts.length-1?cut-.0175:cut,a=alongCuts[j],b=alongCuts[j+1];
      const lath=solidBox(cb,m.wood,`${r.id}-lath-${i}-${j}`,sideAisle?normal:(a+b)/2,FRAME.lowerAisleCeiling.bottomY-FRAME.lowerAisleCeiling.lathHeight/2,sideAisle?(a+b)/2:normal,sideAisle?.035:b-a,FRAME.lowerAisleCeiling.lathHeight,sideAisle?b-a:.035,'lower-ceiling-support-lath');
      const bearings=aisleJoists.filter(q=>intersectsXZ(lath,q));if(!bearings.length)throw new Error(`Ceiling lath has no real timber bearing: ${lath.id}`);
      for(const joist of bearings)connect(lath,joist);laths.push(lath);unifiedFrame.lowerLaths.push(lath.id);
    }
    for(let i=0;i<normalCuts.length-1;i++)for(let j=0;j<alongCuts.length-1;j++){
      const minX=sideAisle?normalCuts[i]:alongCuts[j],maxX=sideAisle?normalCuts[i+1]:alongCuts[j+1],minZ=sideAisle?alongCuts[j]:normalCuts[i],maxZ=sideAisle?alongCuts[j+1]:normalCuts[i+1],id=`${r.id}-board-${i}-${j}`;
      const p=solidBox(cb,material,id,(minX+maxX)/2,FRAME.lowerAisleCeiling.bottomY+FRAME.lowerAisleCeiling.thickness/2,(minZ+maxZ)/2,maxX-minX,FRAME.lowerAisleCeiling.thickness,maxZ-minZ,'lower-aisle-ceiling-panel');
      for(const lath of laths)if(intersectsXZ(p,lath))connect(p,lath);
      unifiedFrame.lowerCeilingRects.push({id,minX,maxX,minZ,maxZ,minY:p.minY,maxY:p.maxY});unifiedFrame.lowerCeilingParts.push(p.id);
    }
  }

  // Four corner pillars and the intervening primary pillars are the actual
  // balustrade endpoints. Each concave rail end meets that same round shaft.
  const joinedRail=(id,list)=>{
    for(let i=0;i<list.length-1;i++){
      const a=list[i],b=list[i+1];railing(fd,[a.x,a.z],[b.x,b.z],UPPER_Y,{id:`${id}-${i}`,startColumn:{id:a.id,radius:a.radius},endColumn:{id:b.id,radius:b.radius}});
    }
  };
  for(const z of[-7.35,7.35])joinedRail(`atrium-${z<0?'north':'south'}`,continuousColumns.filter(p=>Math.abs(p.z-z)<.001&&Math.abs(p.x)<=14.68+.001).sort((a,b)=>a.x-b.x));
  for(const x of[-14.68,14.68])joinedRail(`atrium-${x<0?'west':'east'}`,continuousColumns.filter(p=>Math.abs(p.x-x)<.001).sort((a,b)=>a.z-b.z));

  const makeFlight=(zone,label,bottomX,topX,bottomY,topY)=>{
    const {minZ,maxZ,id:staircaseId}=zone,zc=(minZ+maxZ)/2;
    const f={id:`${staircaseId}-${label}`,staircaseId,axis:'x',minX:topX,maxX:bottomX,minZ,maxZ,bottomX,topX,bottomY,topY,steps:21};stairs.push(f);
    const rise=(topY-bottomY)/21,run=(bottomX-topX)/21;
    const stringerShape=new THREE.Shape();stringerShape.moveTo(bottomX,bottomY);
    for(let i=0;i<21;i++){const yy=bottomY+(i+1)*rise-.12;stringerShape.lineTo(bottomX-i*run,yy);stringerShape.lineTo(bottomX-(i+1)*run,yy);}
    stringerShape.lineTo(topX,topY-.48);stringerShape.lineTo(bottomX,bottomY);stringerShape.closePath();
    const stringerGeo=new THREE.ExtrudeGeometry(stringerShape,{depth:.18,bevelEnabled:false,steps:1});
    for(const zz of[minZ+.30,zc,maxZ-.30]){
      const mesh=addMesh(staircase,`${f.id}-notched-stringer-${zz}`,stringerGeo,m.joinery,[0,0,zz-.09]);mesh.userData.keepSolidInFallback=true;mesh.userData.collision='triangle-mesh';
      structuralParts.push({id:mesh.name,type:'notched-stringer',minX:topX,maxX:bottomX,minY:bottomY,maxY:topY-.12,minZ:zz-.09,maxZ:zz+.09,meshName:mesh.name,treadSeats:21});
    }
    for(let i=0;i<21;i++){
      const top=bottomY+(i+1)*rise,x=bottomX-(i+.5)*run;
      const tread=solidBox(tb,m.joinery,`${f.id}-tread-${i+1}`,x,top-.06,zc,run,.12,STAIR_WIDTH,'stair-tread');
      const h=rise-.12;solidBox(tb,m.joinery,`${f.id}-riser-${i+1}`,x+run/2-.022,top-.12-h/2,zc,.044,h,STAIR_WIDTH-.04,'stair-riser');
      td.box(m.joineryEdge,x+run/2-.006,top-.011,zc,.035,.022,STAIR_WIDTH-.004);
      for(const zz of[minZ+.30,zc,maxZ-.30])supportConnections.push({id:`connection-${supportConnections.length+1}`,type:'notched-stair-bearing',upperId:tread.id,lowerId:`${f.id}-notched-stringer-${zz}`,axis:'y',contactY:top-.12,overlapX:run,overlapZ:.18,seatX:x,seatZ:zz});
    }
    const pitchSlope=(topY-bottomY)/(topX-bottomX),flightRail=humanRailBatch(td,bottomY-pitchSlope*bottomX,pitchSlope);
    f.handrailOffsetY=1.10*HUMAN_RAIL_SCALE;
    for(const z of[minZ+.08,maxZ-.08]){
      flightRail.rod(m.joinery,[bottomX,bottomY+1.10,z],[topX,topY+1.10,z],.065);
      flightRail.rod(m.joinery,[bottomX,bottomY+.32,z],[topX,topY+.32,z],.035);
      flightRail.rod(m.joinery,[bottomX,bottomY+.90,z],[topX,topY+.90,z],.035);
      const newelSteps=[0,3,6,9,12,15,18,20],newelXs=[];
      for(const i of newelSteps){
        const x=bottomX-(i+.5)*run,baseY=bottomY+(i+1)*rise,height=1.10-rise/(2*HUMAN_RAIL_SCALE),postRail=humanRailBatch(td,baseY);
        postRail.box(m.joinery,x,baseY+height/2,z,.14,height,.14);
        postRail.box(m.joinery,x,baseY+.055,z,.18,.11,.18);
        postRail.box(m.joineryEdge,x,baseY+height-.02,z,.19,.04,.19);
        postRail.add(GEOMETRY.octagon,m.joinery,[x,baseY+height+.025,z],[.108,.05,.108]);
        postRail.add(GEOMETRY.octagon,m.joineryEdge,[x,baseY+height+.060,z],[.078,.035,.078]);
        newelXs.push(x);
        railPosts.set(`${f.id}-${z}-${i}`,{id:`${f.id}-${z}-${i}`,x,y:baseY,z,radius:.108,minY:baseY,maxY:baseY+(height+.0775)*HUMAN_RAIL_SCALE});
      }
      for(let i=0;i<newelXs.length-1;i++){
        const x=(newelXs[i]+newelXs[i+1])/2,span=newelXs[i]-newelXs[i+1]-.18,pitchY=bottomY+pitchSlope*(x-bottomX);
        const panel=palacePiercedPanelV12(span,.50,.07).clone();
        panel.applyMatrix4(new THREE.Matrix4().set(1,0,0,0,pitchSlope,1,0,0,0,0,1,0,0,0,0,1));
        flightRail.add(panel,m.joinery,[x,pitchY+.61,z],[1,1,1]);
        // Recessed raised bead follows the sloping lower apron.
        flightRail.rod(m.joineryEdge,[x-span/2,pitchY+.355-pitchSlope*span/2,z],[x+span/2,pitchY+.355+pitchSlope*span/2,z],.012);
      }
      for(let i=0;i<12;i++){
        const a=i/12,b=(i+1)/12,x0=bottomX+(topX-bottomX)*a,x1=bottomX+(topX-bottomX)*b,y0=bottomY+(topY-bottomY)*a,y1=bottomY+(topY-bottomY)*b;
        obstacles.push({minX:Math.min(x0,x1)-.025,maxX:Math.max(x0,x1)+.025,minZ:z-.10,maxZ:z+.10,minY:y0,maxY:y1+1.25*HUMAN_RAIL_SCALE,type:'stairRail',staircaseId});
      }
    }
    return f;
  };
  for(const side of[-1,1]){
    const centerZ=side*FRAME.stairs.centerZ,minZ=centerZ-STAIR_WIDTH/2,maxZ=centerZ+STAIR_WIDTH/2,id=side<0?'north':'south',hole=STAIR_HOLES[side<0?0:1];
    const zone={id,axis:'x',minX:-1,maxX:12.96,minZ,maxZ,minY:0,maxY:6.3,width:4.4,clearWidth:4.12,steps:42,hole:{...hole},
      groundLanding:{minX:12.96,maxX:18,minZ:hole.minZ,maxZ:hole.maxZ,y:0},topLanding:{minX:-4.5,maxX:-1,minZ:hole.minZ,maxZ:hole.maxZ,y:6.3}};
    stairZones.push(zone);makeFlight(zone,'lower',12.96,7.08,0,3.15);makeFlight(zone,'upper',4.88,-1,3.15,6.3);
    const landing={id:`${id}-mid-landing`,staircaseId:id,minX:4.88,maxX:7.08,minZ,maxZ,y:3.15};landingRects.push(landing);
    const deck=solidBox(tb,m.joinery,`${id}-landing-deck`,5.98,3.03,centerZ,2.2,.24,4.4,'stair-landing');
    // A low, closed joined-timber landing plinth carries both flights. It is
    // part of the staircase furniture, not another independent building post.
    const pedestalBase=solidBox(tb,m.stone,`${id}-landing-plinth-base`,5.98,.09,centerZ,2.2,.18,4.24,'stair-landing-plinth-base');connect(pedestalBase,floor);
    const pedestal=solidBox(tb,m.joinery,`${id}-landing-joined-plinth`,5.98,1.445,centerZ,2.2,2.53,4.24,'stair-landing-joined-plinth');connect(pedestal,pedestalBase);
    obstacles.push({minX:4.88,maxX:7.08,minZ:centerZ-2.12,maxZ:centerZ+2.12,minY:0,maxY:2.91,type:'stairLandingSupport',staircaseId:id});
    for(const sideFace of[-1,1])for(let panel=0;panel<3;panel++){
      const x=5.25+panel*.73,z=centerZ+sideFace*2.126;
      td.box(m.joineryEdge,x,1.40,z,.60,1.75,.012);
      td.box(m.joinery,x,1.40,z+sideFace*.010,.51,1.64,.012);
    }
    for(const z of[minZ+.20,maxZ-.20]){
      const beam=solidBox(tb,m.joinery,`${id}-landing-beam-${z}`,5.98,2.81,z,2.2,.20,.24,'landing-beam');connect(deck,beam);connect(beam,pedestal);
      railing(td,[4.88,z+(z<centerZ?-.12:.12)],[7.08,z+(z<centerZ?-.12:.12)],3.15,{id:`${id}-mid-rail-${z}`,materials:stairMaterials});
    }
    const near=hole.minZ-.13,far=hole.maxZ+.13;
    railing(fd,[-1,near],[13.11,near],6.3,{id:`${id}-well-near`,materials:stairMaterials});
    railing(fd,[-1,far],[13.11,far],6.3,{id:`${id}-well-far`,materials:stairMaterials});
    railing(fd,[13.11,near],[13.11,far],6.3,{id:`${id}-well-end`,materials:stairMaterials});
    // Only small returns flank the top arrival; the full 4.12 m opening stays clear.
    railing(fd,[-1,near],[-1,minZ+.08],6.3,{id:`${id}-return-near`,collision:false,materials:stairMaterials});
    railing(fd,[-1,maxZ-.08],[-1,far],6.3,{id:`${id}-return-far`,collision:false,materials:stairMaterials});
  }

  // Painted coffered ceiling carried directly by the upper frame. The open
  // central octagon is supported by cross rails, not a floating ornamental cap.
  const cofferMaterial=make('Coffer_Painted_Inset',0x174e58,{roughness:.75});
  const cofferX=palaceBayStations(COLUMN_X,FRAME.timber.cofferMaxPitch),cofferZ=palaceBayStations(COLUMN_Z,FRAME.timber.cofferMaxPitch);
  const caissonOuter={minX:CAISSON_V10.centerX-CAISSON_V10.outerHalf,maxX:CAISSON_V10.centerX+CAISSON_V10.outerHalf,minZ:-CAISSON_V10.outerHalf,maxZ:CAISSON_V10.outerHalf};
  const caissonOpening={minX:CAISSON_V10.centerX-CAISSON_V10.openingHalf,maxX:CAISSON_V10.centerX+CAISSON_V10.openingHalf,minZ:-CAISSON_V10.openingHalf,maxZ:CAISSON_V10.openingHalf};
  const ceilingJoists=[],joistsByZ=new Map();
  for(const z of cofferZ){
    const pieces=subtractRect({minX:-35.65/2,maxX:35.65/2,minZ:z-.095,maxZ:z+.095},caissonOpening),members=[];
    for(const [i,r]of pieces.entries()){
      const p=solidBox(cb,m.red,`ceiling-joist-${z}-${i}`,(r.minX+r.maxX)/2,upperLocalYV15(14.23),(r.minZ+r.maxZ)/2,r.maxX-r.minX,.22,r.maxZ-r.minZ,'ceiling-joist');ceilingJoists.push(p);members.push(p);
      for(const beam of structuralParts.filter(q=>q.maxY===upperLocalYV15(14.14)||Math.abs(q.maxY-upperLocalYV15(14.12))<1e-6))if(intersectsXZ(beam,p))connect(p,beam);
    }
    joistsByZ.set(z,members);
  }
  for(const x of cofferX)for(let j=0;j<cofferZ.length-1;j++){
    const lo=cofferZ[j]+.095,hi=cofferZ[j+1]-.095;
    const pieces=subtractRect({minX:x-.095,maxX:x+.095,minZ:lo,maxZ:hi},caissonOpening);
    for(const [i,r]of pieces.entries()){
      const bar=solidBox(cb,m.teal,`ceiling-crossbar-${x}-${j}-${i}`,(r.minX+r.maxX)/2,upperLocalYV15(14.23),(r.minZ+r.maxZ)/2,r.maxX-r.minX,.22,r.maxZ-r.minZ,'ceiling-crossbar');
      for(const carrier of [...joistsByZ.get(cofferZ[j]),...joistsByZ.get(cofferZ[j+1])]){
        if(bar.minX<carrier.maxX&&bar.maxX>carrier.minX&&(Math.abs(bar.minZ-carrier.maxZ)<.00001||Math.abs(bar.maxZ-carrier.minZ)<.00001))connect(bar,carrier,'housed-ceiling-joint','z');
      }
    }
  }
  for(let i=0;i<cofferX.length-1;i++)for(let j=0;j<cofferZ.length-1;j++){
    const x=(cofferX[i]+cofferX[i+1])/2,z=(cofferZ[j]+cofferZ[j+1])/2,w=cofferX[i+1]-cofferX[i]-.14,d=cofferZ[j+1]-cofferZ[j]-.14;
    const pieces=subtractRect({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2},caissonOuter);
    for(const [partIndex,r]of pieces.entries()){
      const cx=(r.minX+r.maxX)/2,cz=(r.minZ+r.maxZ)/2,width=r.maxX-r.minX,depth=r.maxZ-r.minZ;
      const p=solidBox(cb,cofferMaterial,`coffer-inset-${i}-${j}-${partIndex}`,cx,upperLocalYV15(14.38),cz,width,.08,depth,'ceiling-panel');
      for(const support of structuralParts.filter(q=>q.type==='ceiling-joist'||q.type==='ceiling-crossbar'))if(intersectsXZ(p,support))connect(p,support);
      if(width>.60&&depth>.60)addReferenceCofferTilesV10({batch:cd,texture:caissonTexture,materials:m,x:cx,z:cz,width,depth,y:upperLocalYV15(14.34)});
    }
  }
  // Finish the existing coffered ceiling against the same upper wall frame.
  // The 45 mm extension of each old joist meets the outer crossbar exactly;
  // four seated perimeter ledgers and four flush skins close the small edge
  // strips without covering existing coffer panels or inventing another roof.
  const ceilingSkin=structuralParts.filter(p=>p.type==='ceiling-panel');
  const skinBounds={minX:Math.min(...ceilingSkin.map(p=>p.minX)),maxX:Math.max(...ceilingSkin.map(p=>p.maxX)),minZ:Math.min(...ceilingSkin.map(p=>p.minZ)),maxZ:Math.max(...ceilingSkin.map(p=>p.maxZ))};
  const edgeX=FRAME.upper.ceilingInnerX,edgeZ=FRAME.upper.ceilingInnerZ,joistHalf=35.65/2;
  const edgeLedgerRects=[
    {id:'unified-upper-ledger-west',minX:-edgeX,maxX:-joistHalf,minZ:-edgeZ,maxZ:edgeZ},
    {id:'unified-upper-ledger-east',minX:joistHalf,maxX:edgeX,minZ:-edgeZ,maxZ:edgeZ},
    {id:'unified-upper-ledger-north',minX:-joistHalf,maxX:joistHalf,minZ:-edgeZ,maxZ:cofferZ[0]-.095},
    {id:'unified-upper-ledger-south',minX:-joistHalf,maxX:joistHalf,minZ:cofferZ.at(-1)+.095,maxZ:edgeZ},
  ];
  const edgeLedgers=[];
  for(const r of edgeLedgerRects){
    const alongZ=r.maxZ-r.minZ>r.maxX-r.minX,lo=alongZ?r.minZ:r.minX,hi=alongZ?r.maxZ:r.maxX;
    const candidateCuts=alongZ?[-21,-14,-7,0,7,14,21]:[-12,-6,0,6,12],cuts=[lo,...candidateCuts.filter(v=>v>lo+.35&&v<hi-.35),hi];
    for(let i=0;i<cuts.length-1;i++){
      const minX=alongZ?r.minX:cuts[i],maxX=alongZ?r.maxX:cuts[i+1],minZ=alongZ?cuts[i]:r.minZ,maxZ=alongZ?cuts[i+1]:r.maxZ;
      const p=solidBox(cb,m.red,r.id+'-'+i,(minX+maxX)/2,upperLocalYV15(14.23),(minZ+maxZ)/2,maxX-minX,.22,maxZ-minZ,'ceiling-edge-ledger');
      const supports=structuralParts.filter(q=>['frame-beam','joint-node','shared-exterior-post'].includes(q.type)&&Math.abs(q.maxY-upperLocalYV15(14.12))<.00001&&intersectsXZ(p,q));
      if(!supports.length)throw new Error(`Upper edge ledger lacks a real bearing: ${p.id}`);
      for(const q of supports)connect(p,q);edgeLedgers.push(p);unifiedFrame.upperEdgeLedgers.push(p.id);
    }
  }
  const upperEdgeRects=[
    {id:'unified-upper-ceiling-west',minX:-edgeX,maxX:skinBounds.minX,minZ:-edgeZ,maxZ:edgeZ},
    {id:'unified-upper-ceiling-east',minX:skinBounds.maxX,maxX:edgeX,minZ:-edgeZ,maxZ:edgeZ},
    {id:'unified-upper-ceiling-north',minX:skinBounds.minX,maxX:skinBounds.maxX,minZ:-edgeZ,maxZ:skinBounds.minZ},
    {id:'unified-upper-ceiling-south',minX:skinBounds.minX,maxX:skinBounds.maxX,minZ:skinBounds.maxZ,maxZ:edgeZ},
  ];
  unifiedFrame.upperCeilingRegions=upperEdgeRects.map(r=>({...r}));
  for(const r of upperEdgeRects){
    const alongZ=r.maxZ-r.minZ>r.maxX-r.minX,lo=alongZ?r.minZ:r.minX,hi=alongZ?r.maxZ:r.maxX,count=Math.ceil((hi-lo)/.94);
    for(let i=0;i<count;i++){
      const a=lo+i*(hi-lo)/count,b=lo+(i+1)*(hi-lo)/count,minX=alongZ?r.minX:a,maxX=alongZ?r.maxX:b,minZ=alongZ?a:r.minZ,maxZ=alongZ?b:r.maxZ,id=r.id+'-'+i;
      const p=solidBox(cb,cofferMaterial,id,(minX+maxX)/2,upperLocalYV15(14.38),(minZ+maxZ)/2,maxX-minX,.08,maxZ-minZ,'upper-edge-ceiling-panel');
      for(const q of structuralParts.filter(q=>['ceiling-joist','ceiling-crossbar','ceiling-edge-ledger'].includes(q.type)&&intersectsXZ(p,q)))connect(p,q);
      unifiedFrame.upperCeilingRects.push({id,minX,maxX,minZ,maxZ,minY:p.minY,maxY:p.maxY});unifiedFrame.upperCeilingParts.push(p.id);
    }
  }
  const upperEdgeHeaders=exterior.supportConnections.filter(r=>r.kind==='continuous-upper-roof-header').map(r=>{
    const p={id:'shared-'+r.id,type:'shared-upper-roof-header',...r.bounds,meshName:r.meshName,instanceIndex:r.instanceIndex,externalSource:true,face:r.face};
    structuralParts.push(p);partMap.set(p.id,p);return p;
  });
  // The header does not float above a second inner wall. Its original top
  // crosspieces actually enter the full-height exterior posts; reuse those
  // same rendered pieces in the shared structural graph.
  for(const r of exterior.supportConnections.filter(r=>r.kind==='upper-post-to-facade-tie'&&r.bounds.minY>13)){
    const p={id:'shared-'+r.id,type:'shared-upper-header-crosspiece',...r.bounds,meshName:r.meshName,instanceIndex:r.instanceIndex,externalSource:true,face:r.face};
    structuralParts.push(p);partMap.set(p.id,p);
    const axis=(r.face==='east'||r.face==='west')?'x':'z';
    for(const header of upperEdgeHeaders.filter(q=>q.face===r.face&&intersectsXZ(q,p)))connect(header,p,'housed-upper-header-crosspiece',axis);
    for(const post of sharedWallPosts)if(intersectsXZ(post,p))connect(p,post,'housed-upper-post-crosspiece',axis);
  }
  for(const axis of['x','z'])for(const side of[-1,1]){
    const face=axis==='x'?(side>0?'east':'west'):(side>0?'south':'north'),headers=upperEdgeHeaders.filter(p=>p.face===face),normal=axis==='x'?edgeX:edgeZ,depth=.045;
    const min=side>0?normal:-normal-depth,max=side>0?normal+depth:-normal,half=axis==='x'?edgeZ+depth:edgeX;
    for(const [i,header]of headers.entries()){
      const a=Math.max(-half,axis==='x'?header.minZ:header.minX),b=Math.min(half,axis==='x'?header.maxZ:header.maxX);if(b<=a)continue;
      const p=solidBox(cb,m.red,`unified-upper-ceiling-riser-${face}-${i}`,axis==='x'?(min+max)/2:(a+b)/2,(header.maxY+upperLocalYV15(14.42))/2,axis==='x'?(a+b)/2:(min+max)/2,axis==='x'?depth:b-a,upperLocalYV15(14.42)-header.maxY,axis==='x'?b-a:depth,'upper-ceiling-edge-riser');
      connect(p,header);unifiedFrame.upperEdgeRisers.push(p.id);
    }
  }
  const caissonBridgeParts=[];
  for(const x of[CAISSON_V10.centerX-CAISSON_V10.bridgeOffset,CAISSON_V10.centerX+CAISSON_V10.bridgeOffset]){
    let pieces=[{minX:x-.10,maxX:x+.10,minZ:-6.93,maxZ:6.93}];
    for(const joist of ceilingJoists)pieces=pieces.flatMap(r=>subtractRect(r,joist));
    for(const [i,r]of pieces.entries()){
      const bridge=solidBox(cb,m.red,`caisson-bearing-bridge-${x}-${i}`,(r.minX+r.maxX)/2,upperLocalYV15(14.23),(r.minZ+r.maxZ)/2,r.maxX-r.minX,.22,r.maxZ-r.minZ,'caisson-support');
      for(const base of structuralParts.filter(p=>Math.abs(p.maxY-upperLocalYV15(14.12))<.00001&&intersectsXZ(p,bridge)))connect(bridge,base);
      for(const joist of ceilingJoists){
        if(bridge.minX>=joist.maxX||bridge.maxX<=joist.minX)continue;
        const low=Math.abs(bridge.minZ-joist.maxZ)<.00001,high=Math.abs(bridge.maxZ-joist.minZ)<.00001;if(!low&&!high)continue;
        const edge=low?bridge.minZ:bridge.maxZ,direction=low?-1:1;
        const tenon=solidBox(cb,m.wood,`${bridge.id}-housed-end-${direction}`,x,upperLocalYV15(14.23),edge+direction*.04,.10,.10,.08,'tenon');
        joinery.push(connect(bridge,joist,'housed-tenon','z',{tenonId:tenon.id,tenonDepth:.08,visibleGap:0,caissonCeilingFrame:true}));
      }
      caissonBridgeParts.push(bridge);
    }
  }
  const referenceCaisson=addReferenceCaissonV10({parent:ceiling,texture:caissonTexture,materials:m,centerX:CAISSON_V10.centerX,centerZ:CAISSON_V10.centerZ,baseY:CAISSON_V10.baseY});
  referenceCaisson.mainFrame=caissonMainFrame;referenceCaisson.bridgeIds=caissonBridgeParts.map(p=>p.id);referenceCaisson.opening={...caissonOpening};referenceCaisson.outerFrame={...caissonOuter};
  for(const mesh of referenceCaisson.curbs){
    mesh.updateWorldMatrix(true,false);mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    const p={id:mesh.name,type:'caisson-carried-square-curb',minX:b.min.x,maxX:b.max.x,minY:b.min.y,maxY:b.max.y,minZ:b.min.z,maxZ:b.max.z,meshName:mesh.name};structuralParts.push(p);partMap.set(p.id,p);
    for(const support of [...caissonBridgeParts,...ceilingJoists,...structuralParts.filter(q=>q.type==='ceiling-crossbar')])if(intersectsXZ(p,support))connect(p,support);
  }
  // Upper roof loads continue through short king posts to the visible frame.
  // The member heights are sampled from the triangulated hip roof, so end-bay
  // braces cannot project through the lower hip slopes.
  const roofBearingNodes=[...nodes[1].values()];
  for(const n of roofBearingNodes){
    const roofBottom=roofSurfaceHeight(n.x,n.z)-.68;
    const purlinBottom=roofBottom-.25,postHeight=purlinBottom-upperLocalYV15(14.12);
    const post=solidBox(cb,m.red,`roof-post-${n.x}-${n.z}`,n.x,upperLocalYV15(14.12)+postHeight/2,n.z,.24,postHeight,.24,'roof-post');connect(post,n.part);
    const seat=solidBox(cb,m.wood,`roof-purlin-seat-${n.x}-${n.z}`,n.x,roofBottom-.125,n.z,.52,.25,.52,'roof-seat');connect(seat,post);
  }
  // Rafters contact the underside of the roof and sit on longitudinal purlins.
  // Rods use short spans to follow the concave profile rather than cutting it.
  const roofRafterStations=palaceBayStations(palaceBayStations(COLUMN_Z),FRAME.timber.bracketMaxPitch/2);
  for(const z of roofRafterStations)for(const s of[-1,1])for(let i=0;i<18;i++){
    const x0=s*i,x1=s*(i+1),y0=roofSurfaceHeight(x0,z)-.40,y1=roofSurfaceHeight(x1,z)-.40;
    cb.rod(m.wood,[x0,y0,z],[x1,y1,z],.07);
  }
  const purlinStations=palaceBayStations(COLUMN_Z,1);
  for(const x of COLUMN_X)for(let j=0;j<purlinStations.length-1;j++){
    const z0=purlinStations[j],z1=purlinStations[j+1],y0=roofSurfaceHeight(x,z0)-.57,y1=roofSurfaceHeight(x,z1)-.57;
    cb.rod(m.red,[x,y0,z0],[x,y1,z1],.14);
  }
  // The hall has no suspended palace lanterns; illumination is provided by daylight and off-scene fill.
  const doubleRoof=buildDoubleRoofV6({roof,timberMaterial:m.wood,ridgeBeastAtlasTexture,ridgeCeramicTexture});
  // Continuous 110 mm timber boarding is fitted to the same triangulation as
  // the upper roof. Its top meets the roof underside exactly and its underside
  // seats on the rafters, so there is no visible air gap beneath the shell.
  const deckGeometry=doubleRoof.upperShell.geometry.clone(),deckPositions=deckGeometry.attributes.position,deckTopCount=deckGeometry.userData.topVertexCount;
  for(let i=0;i<deckPositions.count;i++)deckPositions.setY(i,deckPositions.getY(i)-(i<deckTopCount?.22:.11));
  deckPositions.needsUpdate=true;deckGeometry.computeVertexNormals();deckGeometry.computeBoundingBox();
  deckGeometry.userData={type:'fitted-timber-roof-deck',thickness:.11};deckGeometry.clearGroups();
  const roofDeck=addMesh(roof,'Upper_Fitted_Timber_Roof_Deck',deckGeometry,m.wood);roofDeck.userData.keepSolidInFallback=true;
  for(const [batch,name]of[[sb,'Structure_Solid'],[sd,'Structure_Painted_Detail'],[fb,'Gallery_Slab'],[fd,'Gallery_Railing'],[cb,'Ceiling_Solid'],[cd,'Ceiling_Detail'],[tb,'Stair_Solid'],[td,'Stair_Rail'],[db,'Architectural_Details']])batch.finish(name);
  const groundMesh=group.getObjectByName(floor.meshName);if(groundMesh){groundMesh.name='00_Ground_Stone_Floor';groundMesh.userData.floorY=0;floor.meshName=groundMesh.name;}
  for(const root of[upperFloor,staircase])root.traverse(mesh=>{
    if(mesh.isMesh&&(/Gallery_Railing|Stair_Rail/.test(mesh.name))&&mesh.material!==m.gold)mesh.userData.keepSolidInFallback=true;
  });
  group.updateMatrixWorld(true);let detailInstances=0;group.traverse(o=>{if(o.isInstancedMesh)detailInstances+=o.count;});
  const walkPassages=[];
  const mirroredPassage=(id,y,side,a,b,axis,lo,hi)=>walkPassages.push({id,y,minX:axis==='x'?Math.min(side*a,side*b):lo,maxX:axis==='x'?Math.max(side*a,side*b):hi,minZ:axis==='z'?Math.min(side*a,side*b):lo,maxZ:axis==='z'?Math.max(side*a,side*b):hi,clearWidth:b-a});
  for(const y of[0,UPPER_Y])for(const side of[-1,1]){
    mirroredPassage(`cross-gallery-${y}-${side}`,y,side,FRAME.walkways.crossMinX,FRAME.walkways.crossMaxX,'x',-25.1,25.1);
    mirroredPassage(`rack-end-cross-passage-${y}-${side}`,y,side,FRAME.walkways.transverseMinZ,FRAME.walkways.transverseMaxZ,'z',-14.4,14.4);
    mirroredPassage(`atrium-ring-passage-${y}-${side}`,y,side,FRAME.walkways.atriumMinZ,FRAME.walkways.atriumMaxZ,'z',-14.1,14.1);
  }
  for(const side of[-1,1])mirroredPassage(`short-wall-window-passage-${side}`,UPPER_Y,side,FRAME.walkways.shortWallMinZ,FRAME.walkways.shortWallMaxZ,'z',-14.4,16.9);
  const columnLayout={version:15,currentColumns:columns,continuousMainColumns:continuousColumns.length,sharedUpperWallPosts:sharedWallPosts.length,groundMainColumns:26,upperMainColumns:26,interiorContinuousColumns:12,atriumCornerColumns:4,ceremonialColumns:4,goldColumns:4,removedCrossGalleryColumns:4,removedEntranceColumns:exterior.metadata.removedEntranceColumns,removedRearColumns:exterior.metadata.removedRearColumns,stairwellCornerPosts:0,landingPosts:0,landingPlinths:2,removedStandalonePosts:29,currentTotalIncludingLandings:columns,columnFinish:'#942f29',columnBaseFamily:'closed-profiled-low-drum'};
  group.userData={version:'15.0',style:'Unified continuous-column timber frame centered on the throne',entrance:'+X',ceremonialAxis:'x',units:'metres',upperFloorY:6.3,width:44,depth:62,upperWidth:36,upperDepth:52,roofCount:2,stairStepCount:42,stairWidth:4.4,atrium:{...ATRIUM},bearingConnectionCount:supportConnections.length,columnLayout};
  structure.userData={structuralPartCount:structuralParts.length,bearingConnectionCount:supportConnections.length,visibleMortiseTenonCount:joinery.length};
  return {group,roof,roofShell:doubleRoof.upperShell,roofShells:doubleRoof.shells,lowerRoofShell:doubleRoof.lowerShell,doubleRoof,exterior,
    roofMetadata:{...doubleRoof.upperShell.geometry.userData},ceiling,envelope,upperFloor,staircase,obstacles,stairs,stairZones,landingRects,lanterns,galleryRects,groundRects,
    railSegments,railPosts:[...railPosts.values()],columnFootprints,galleryBeamSegments,supportConnections,joinery,structuralParts,goldColumnPositions,ceremonialColumnPositions,continuousColumns,roofRafterStations,cofferStations:{x:cofferX,z:cofferZ},materials:m,columnLayout,sharedPerimeterSupports,sharedTransferLinks,kneeBraces,paintedBeamRuns,unifiedFrame,referenceCaisson,stairOpeningFrames,clearGalleryTransferNodes,walkPassages,
    stats:{floors:2,width:44,depth:62,upperWidth:36,upperDepth:52,height:doubleRoof.stats?.height??22.5,roofCount:2,roofThickness:ROOF_THICKNESS,floorHeight:6.3,columns,
      exteriorColumns:exterior.metadata.columnCount,staircases:2,stairFlights:4,stairWidth:4.4,stepsPerStair:42,landingDepth:2.2,atriumWidth:29,atriumDepth:15.84,
      exteriorWindowLeaves:exterior.metadata.windowLeaves,exteriorInstances:exterior.metadata.exteriorInstances,entranceSide:'+X',detailInstances,groundArea:44*62,
      upperArea:galleryRects.reduce((sum,r)=>sum+(r.maxX-r.minX)*(r.maxZ-r.minZ),0),structuralParts:structuralParts.length,bearingConnections:supportConnections.length,visibleJoinery:joinery.length}};
}

export { UPPER_Y };
