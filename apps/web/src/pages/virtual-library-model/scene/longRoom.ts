import {addLongRoomFloorOcclusion} from './longRoomFloorOcclusion';
import {addEastGalleryConnection} from './longRoomEastGallery';
import { createLongRoomSashes } from './longRoomSash';
import { createLongRoomWindowReveal } from "./longRoomWindowReveal";
import * as THREE from 'three';
import { LONG_ROOM as L, LONG_ROOM_BAY_PITCH as P, longRoomBayZ, HISTORIC_SPIRAL as S, EAST_GALLERY_CONNECTION as E,
  isLongRoomLiveCaseOmitted, isLongRoomLiveShelfFaceOmitted, longRoomLiveCatalogSectionIndex,
  longRoomLiveCatalogFace, longRoomShelfSectionId } from '../longRoomLayout';
import { PALETTE } from '../config';
import { createLibraryMaterials, type LibraryMaterials } from './materials';
import { makeBox, type BookShelfSlot } from './parts';
import { markCameraCollider } from '../../virtual-library-collision';
import type { ExpandableShelfSection } from './buildLibrary';
import { addLongRoomEastEnd } from './longRoomEastEnd';
import { createWestConnectionSteps } from './longRoomWestConnection';
import { createWindowShade, createWindowShadeMaterial } from './longRoomWindowShade';
import { createLongRoomCeilingMaterial, alignLongRoomBoardGrain } from './longRoomTimber';
import { createLongRoomBaluster, galleryBalusterPlacement } from './longRoomBaluster';
import { addLongRoomGalleryPosts } from './longRoomGalleryPosts';
import { addLongRoomGalleryCornice } from './longRoomCornice';
import { addLongRoomShelfLaddersSteps } from './longRoomLadders';
import { addLongRoomLamps } from './longRoomLamps';
import { addLongRoomCrystalChandeliers } from './longRoomChandeliers';
import { addLongRoomShelfMarks } from './longRoomShelfMarks';
import { createHistoricalBindingGeometry, createHistoricalBindingMaterialSteps, createHistoricalPageEdges, createDistantHistoricalBindingGeometry } from './longRoomBindings';
import { createLongRoomPilasterShaft } from './longRoomPilaster';
import { createLongRoomVaultRib } from './longRoomVaultRib';
import { createLongRoomCapital, LONG_ROOM_CAPITAL_MAX_WIDTH } from './longRoomCapital';
import { createLongRoomSpiralStair } from './longRoomStair';
import { optimizeStaticMeshesProgressively } from './optimizeScene';
import { instanceBounds } from './instanceBounds';

export interface LongRoomSlot extends BookShelfSlot {
  sectionId: number;
  catalogSectionIndex: number;
  rowIndex: number;
}
export interface LongRoomBuilt {
  root: THREE.Group;
  materials: LibraryMaterials;
  shelfSections: ExpandableShelfSection[];
  /** Empty placement anchors only; real catalog books are attached elsewhere. */
  catalogSlots: LongRoomSlot[];
  interactiveObjects: THREE.Object3D[];
  catalogTerminal: THREE.Group;
  animateEnvironment: (elapsed: number) => void;
}
export interface LongRoomBuildOptions {
  includeRetiredRooms?: boolean;
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const WEST_GALLERY_CROSSWALK = { outer: -44.2, inner: -41.8, center: -43 } as const;
export const LIVE_GALLERY_CORNER_RADIUS = 0.62;
export const LONG_ROOM_CATALOG_SECTION_CAPACITY = 120;
export const LONG_ROOM_CATALOG_BOOKS_PER_ROW = LONG_ROOM_CATALOG_SECTION_CAPACITY / L.shelfRows;
export const LONG_ROOM_SHELF_BASE_Y = 0.36;
export const LONG_ROOM_SHELF_BOARD_THICKNESS = 0.075;
export const LONG_ROOM_CATALOG_BOOK_SIZE = {
  spineWidth: 0.16,
  height: 0.68,
  coverWidth: 0.42,
} as const;
export const LONG_ROOM_SHELF_FRONT_OFFSET = (L.caseThickness + 0.06) / 2;
export const LONG_ROOM_CATALOG_SPINE_RECESS = 0.035;
export const LONG_ROOM_CATALOG_BOOK_RENDERED_DEPTH = LONG_ROOM_CATALOG_BOOK_SIZE.coverWidth * 0.96;
export const LONG_ROOM_BOOK_CENTER_OFFSET = LONG_ROOM_SHELF_FRONT_OFFSET
  - LONG_ROOM_CATALOG_BOOK_RENDERED_DEPTH / 2
  - LONG_ROOM_CATALOG_SPINE_RECESS;
export const LONG_ROOM_HISTORICAL_BOOK_CENTER_OFFSET = LONG_ROOM_SHELF_FRONT_OFFSET - 0.11 - 0.03;
export const LONG_ROOM_BOOKCASE_PILASTER_WIDTH = L.caseThickness - 0.12;
export const LONG_ROOM_BOOKCASE_CAPITAL_WIDTH = L.caseThickness + 0.08;
type LongRoomShelfFace = -1 | 1;
const LONG_ROOM_SHELF_FACES: readonly LongRoomShelfFace[] = [-1, 1];

export function longRoomShelfPitch(height: number) {
  return (height - LONG_ROOM_SHELF_BASE_Y) / L.shelfRows;
}

export function longRoomShelfBoardY(row: number, height: number) {
  return LONG_ROOM_SHELF_BASE_Y + row * longRoomShelfPitch(height);
}

export const longRoomRoofY = (x: number) => L.vaultSpring
  + Math.sqrt(Math.max(0, L.vaultRadius ** 2 - x ** 2));

function beam(points: THREE.Vector3[], material: THREE.Material, radius = 0.055, segments = 40) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 16, false), material);
}
function namedBox(root: THREE.Group, name: string, size: number[], position: number[], material: THREE.Material) {
  const mesh = makeBox(size[0], size[1], size[2], material, position[0], position[1], position[2]);
  mesh.name = name;
  if (material instanceof THREE.MeshStandardMaterial && material.map && /oak|pilaster|backboard|stile|shelf|wood|lining|panel|beam|baluster/i.test(name)) alignLongRoomBoardGrain(mesh);
  root.add(mesh);
  return mesh;
}

function extrudePlanShape(points: THREE.Vector2[], height: number) {
  const shape = new THREE.Shape(points);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    bevelEnabled: false,
  });
  // ExtrudeGeometry grows along local +Z. Rotate that depth onto world Y and
  // centre it so every curved member uses the same position convention as a box.
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, height / 2, 0);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createGalleryArcPrismGeometry(
  radius: number,
  radialDepth: number,
  height: number,
  startAngle: number,
  endAngle: number,
  segments = 18,
) {
  const innerRadius = radius - radialDepth / 2;
  const outerRadius = radius + radialDepth / 2;
  const points: THREE.Vector2[] = [];
  for (let index = 0; index <= segments; index++) {
    const angle = startAngle + (endAngle - startAngle) * index / segments;
    points.push(new THREE.Vector2(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius));
  }
  for (let index = segments; index >= 0; index--) {
    const angle = startAngle + (endAngle - startAngle) * index / segments;
    points.push(new THREE.Vector2(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius));
  }
  return extrudePlanShape(points, height);
}

/** Adds floor into the previously square void corner up to the curved rail.
 * This is a positive solid infill, not a subtractive aperture in the gallery. */
function createGalleryCornerFloorInfillGeometry(
  side: number,
  inwardZ: number,
  radius: number,
  height: number,
  segments = 18,
) {
  const sideAngle = side === 1 ? 0 : Math.PI;
  const crossAngle = sideAngle - side * inwardZ * Math.PI / 2;
  const points = [
    new THREE.Vector2(side * radius, 0),
    new THREE.Vector2(side * radius, -inwardZ * radius),
    new THREE.Vector2(0, -inwardZ * radius),
  ];
  for (let index = 1; index <= segments; index++) {
    const angle = crossAngle + (sideAngle - crossAngle) * index / segments;
    points.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  return extrudePlanShape(points, height);
}

function alignFloorGrain(mesh: THREE.Mesh) {
  const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
  const uv = mesh.geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) if (normal.getY(i) > 0.5) {
    uv.setXY(i, (position.getX(i) + mesh.position.x) / 2.88, (position.getZ(i) + mesh.position.z) / 4.8);
  }
  uv.needsUpdate = true;
}

/** A genuine constant-section barrel, not a radial dome or a tapering rotunda. */
function* createLongRoomVaultSteps(materials: LibraryMaterials): Generator<void, THREE.Group> {
  const root = new THREE.Group(); root.name = 'Long Room continuous barrel vault';
  // Keep the main barrel and the side-gallery ceilings as complete surfaces.
  // The previous per-bay intersecting lunettes read as holes and produced
  // dangling seam pieces where they met the transverse ribs.
  const ribZ = Array.from({length: L.alcovesPerSide + 1}, (_, bay) =>
    L.length / 2 - L.endMargin - bay * P);
  const sections = [-L.length / 2, ...ribZ.reverse(), L.length / 2]
    .map(z => ({z, rise: 0}));
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for(const section of sections) {
    const edge=Math.asin(section.rise/L.vaultRadius);
    for(let i=0;i<=96;i++) {
      const angle=edge+(Math.PI-2*edge)*i/96;
      positions.push(Math.cos(angle)*L.vaultRadius,L.vaultSpring+Math.sin(angle)*L.vaultRadius,section.z);
      uvs.push(angle*L.vaultRadius/1.44,(section.z+L.length/2)/3.2);
    }
  }
  for(let row=0;row<sections.length-1;row++)for(let i=0;i<96;i++) {
    const a=row*97+i,b=a+97;indices.push(a,a+1,b,a+1,b+1,b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const lining = createLongRoomCeilingMaterial(materials.wood);
  const shell = new THREE.Mesh(geometry, lining); shell.name = 'Continuous oak barrel lining'; shell.receiveShadow = true; root.add(shell);
  const ribGeometry = createLongRoomVaultRib(L.vaultRadius, L.vaultSpring);
  for (let bay = 0; bay <= L.alcovesPerSide; bay++) {
    const rib = new THREE.Mesh(ribGeometry, materials.woodDark);
    rib.position.z = L.length / 2 - L.endMargin - bay * P;
    rib.castShadow = true; rib.receiveShadow = true;
    rib.name = `Transverse barrel rib ${bay}`; root.add(rib);
    yield;
  }
  const sideCeilingWidth = L.width / 2 - L.vaultRadius;
  for (const side of [-1, 1]) {
    const ceiling = namedBox(root, 'Continuous side gallery ceiling',
      [sideCeilingWidth, 0.12, L.length],
      [side * (L.width / 2 + L.vaultRadius) / 2, L.vaultSpring + 0.06, 0], lining);
    ceiling.castShadow = ceiling.receiveShadow = true;
    yield;
  }
  return root;
}

export function createLongRoomVault(materials: LibraryMaterials) {
  const steps = createLongRoomVaultSteps(materials);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

interface SceneryVolumeStyle {
  density: number;
  clusterName: string;
  volumeName: string;
  pageName: string;
  marker: 'isHistoricalScenery';
}

const HISTORICAL_VOLUME_STYLE: SceneryVolumeStyle = {
  density: 1,
  clusterName: 'Historical binding detail cluster',
  volumeName: 'Historical collection scenery volumes',
  pageName: 'Historical volume inset paper heads',
  marker: 'isHistoricalScenery',
};

function sceneryVolumeHash(seed: number) {
  let hash = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/** Reference-only anonymous scenery volumes; the live hall never constructs them. */
class HistoricalVolumes {
  private clusters = new Map<string, {center: THREE.Vector3; batches: {
    count: number; matrices: Float32Array; colors: Float32Array;
  }[]}>();
  private color = new THREE.Color();
  private paleLeather = new THREE.Color(PALETTE.parchment);
  private tanLeather = new THREE.Color(PALETTE.brass);
  constructor(private readonly style: SceneryVolumeStyle = HISTORICAL_VOLUME_STYLE) {}
  add(x: number, y: number, z: number, width: number, height: number, depth: number, rotation: number, seed: number) {
    const hash = sceneryVolumeHash(seed);
    if (hash / 0x1_0000_0000 >= this.style.density) return;
    const segmentLength = P * 2;
    const segment = Math.floor((z + L.length / 2) / segmentLength), side = Math.sign(x);
    const key = `${side}:${segment}`;
    let cluster = this.clusters.get(key);
    if (!cluster) {
      cluster = {center: new THREE.Vector3(side * (L.aisleHalfWidth + L.width / 2) / 2,
        L.galleryY, (segment + 0.5) * segmentLength - L.length / 2),
        batches: Array.from({length: 4}, () => ({count: 0,
          matrices: new Float32Array(1024 * 16), colors: new Float32Array(1024 * 3)}))};
      this.clusters.set(key, cluster);
    }
    const batch = cluster.batches[Math.floor(seed / 7) % cluster.batches.length];
    if ((batch.count + 1) * 16 > batch.matrices.length) {
      const matrices = new Float32Array(batch.matrices.length * 2); matrices.set(batch.matrices); batch.matrices = matrices;
      const colors = new Float32Array(batch.colors.length * 2); colors.set(batch.colors); batch.colors = colors;
    }
    const offset = batch.count * 16, c = Math.cos(rotation), sine = Math.sin(rotation);
    // Write TRS directly, avoiding temporary objects per volume.
    batch.matrices[offset] = c * width; batch.matrices[offset + 2] = -sine * width;
    batch.matrices[offset + 5] = height;
    batch.matrices[offset + 8] = sine * depth; batch.matrices[offset + 10] = c * depth;
    batch.matrices[offset + 12] = x; batch.matrices[offset + 13] = y; batch.matrices[offset + 14] = z;
    batch.matrices[offset + 15] = 1;
    // Matching sets retain a shared seed. Hash adjacent seeds to avoid a
    // repeating light/dark stripe; this palette is a photographic estimate.
    const family = hash % 20, variation = (hash >>> 8) / 0xffffff;
    if (family < 2) this.color.setHex(PALETTE.oakEdge);
    else if (family === 2) this.color.setHex(PALETTE.oxblood);
    else if (family < 5) this.color.setHex(PALETTE.oakWarm).lerp(this.paleLeather, 0.32 + variation * 0.18);
    else if (family < 12) this.color.setHex(PALETTE.oakWarm).lerp(this.tanLeather, 0.25 + variation * 0.35);
    else this.color.setHex(PALETTE.oakWarm).lerp(this.tanLeather, variation * 0.12);
    this.color.multiplyScalar(0.78 + variation * 0.32).toArray(batch.colors, batch.count * 3);
    batch.count++;
  }
  *finish(root: THREE.Group): Generator<string, void> {
    const geometry = createHistoricalBindingGeometry(), distantGeometry = createDistantHistoricalBindingGeometry();
    yield 'construction-binding-geometry';
    const materials:THREE.MeshStandardMaterial[]=[];
    for(let variant=0;variant<4;variant++) {
      const steps=createHistoricalBindingMaterialSteps(variant);
      let step=steps.next();
      while(!step.done) {
        yield `construction-binding-texture-${variant}`;
        step=steps.next();
      }
      materials.push(step.value);
    }
    const pages = createHistoricalPageEdges();
    const sourceBounds = new THREE.Box3();
    for (const model of [geometry, distantGeometry, pages.geometry]) {
      model.computeBoundingBox(); sourceBounds.union(model.boundingBox!);
    }
    yield 'construction-binding-page-edges';
    for (const [key, cluster] of this.clusters) {
      const lod = new THREE.LOD(); lod.name = `${this.style.clusterName} ${key}`;
      lod.position.copy(cluster.center);
      const near = new THREE.Group(), far = new THREE.Group();
      near.position.copy(cluster.center).negate(); far.position.copy(near.position);
      // Attach before yielding so cancellation can dispose partial clusters.
      // Hysteresis keeps a slow walk around the threshold from flickering.
      lod.addLevel(near, 0); lod.addLevel(far, 18, 0.12); root.add(lod);
      const pageMatrices = new Float32Array(cluster.batches.reduce((sum, batch) => sum + batch.count, 0) * 16);
      let pageOffset = 0;
      const pageBounds = new THREE.Box3();
      for (const [variant, batch] of cluster.batches.entries()) {
        const matrices = new THREE.InstancedBufferAttribute(batch.matrices.slice(0, batch.count * 16), 16);
        const colors = new THREE.InstancedBufferAttribute(batch.colors.slice(0, batch.count * 3), 3);
        pageMatrices.set(matrices.array, pageOffset); pageOffset += batch.count * 16;
        const bounds = instanceBounds(sourceBounds, matrices.array, batch.count);
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        pageBounds.union(bounds);
        for (const [parent, model] of [[near, geometry], [far, distantGeometry]] as const) {
          const mesh = new THREE.InstancedMesh(model, materials[variant], 0);
          mesh.count = batch.count;
          mesh.name = this.style.volumeName;
          mesh.userData[this.style.marker] = true;
          mesh.userData.isAnonymousShelfScenery = true;
          mesh.instanceMatrix = matrices; mesh.instanceColor = colors; mesh.receiveShadow = true;
          mesh.boundingBox = bounds.clone(); mesh.boundingSphere = sphere.clone(); parent.add(mesh);
        }
        yield `construction-binding-batch-${key}-${variant}`;
      }
      const pageMesh = new THREE.InstancedMesh(pages.geometry, pages.material, 0);
      pageMesh.count = pageMatrices.length / 16;
      pageMesh.name = this.style.pageName;
      pageMesh.userData[this.style.marker] = true;
      pageMesh.userData.isAnonymousShelfScenery = true;
      pageMesh.instanceMatrix = new THREE.InstancedBufferAttribute(pageMatrices, 16);
      pageMesh.receiveShadow = true;
      pageMesh.boundingBox = pageBounds;
      pageMesh.boundingSphere = pageBounds.getBoundingSphere(new THREE.Sphere()); near.add(pageMesh);
      yield `construction-binding-cluster-${key}`;
    }
  }
}

interface PilasterTemplates {
  capital: THREE.Group;
  shafts: Map<number, THREE.Mesh>;
}

function addPilaster(root: THREE.Group, materials: LibraryMaterials, side: number, z: number, base: number, height: number, templates: PilasterTemplates) {
  const x = side * L.aisleHalfWidth;
  let shaftTemplate = templates.shafts.get(height);
  if (!shaftTemplate) {
    shaftTemplate = createLongRoomPilasterShaft(height - 0.55, materials.woodWarm, {
      width: LONG_ROOM_BOOKCASE_PILASTER_WIDTH,
      fluteCount: 9,
    });
    templates.shafts.set(height, shaftTemplate);
  }
  const shaft = shaftTemplate.clone();
  shaft.position.set(x, base + height / 2, z);
  shaft.rotation.y = -side * Math.PI / 2; root.add(shaft);
  for (const [y, width, depth, h] of [[0.12, 0.48, L.caseThickness + 0.12, 0.24], [0.35, 0.37, L.caseThickness, 0.12]]) {
    namedBox(root, 'Pilaster moulded base and capital', [width, h, depth], [x, base + y, z], materials.woodWarm);
  }
  const capital = templates.capital.clone();
  capital.scale.x = LONG_ROOM_BOOKCASE_CAPITAL_WIDTH / LONG_ROOM_CAPITAL_MAX_WIDTH;
  capital.position.set(x, base + height - 0.52, z);
  capital.rotation.y = -side * Math.PI / 2; root.add(capital);
  if (base > 0) {
    const connectorHeight = Math.max(0, L.vaultSpring - (base + height));
    if (connectorHeight > 0.01) {
      namedBox(root, 'Vault rib springing connector',
        [0.5, connectorHeight, L.caseThickness + 0.08],
        [x, base + height + connectorHeight / 2, z], materials.woodWarm);
    }
  }
  // The projecting aisle pilaster is outside the fitted case's backboard box.
  markCameraCollider(root, { id: `long-room-pilaster-${side}-${z}-${base}`, shape: 'box',
    center: { x, y: base + height / 2, z }, size: { x: 0.48, y: height, z: L.caseThickness + 0.12 } });
}

const LONG_ROOM_WINDOW_WIDTH = 1.5;
const longRoomWindowLevels = () => [
  { base: 1.25, height: L.galleryY - 2.1 },
  { base: L.galleryY + 0.7, height: L.vaultSpring - L.galleryY - 1 },
];

/** Solid piers/spandrels surround actual apertures; there is no hidden full wall behind glazing. */
function addExteriorWall(root: THREE.Group, materials: LibraryMaterials, side: number) {
  const wall = new THREE.Group(); wall.name = 'Long exterior wall';
  wall.position.x = side * (L.width / 2 + 0.1);
  wall.userData.windowDimensions = 'working-estimate';
  const levels = longRoomWindowLevels();
  let previousEdge = -L.length / 2;
  for (let bay = L.alcovesPerSide - 1; bay >= 0; bay--) {
    const z = longRoomBayZ(bay), edge = z - LONG_ROOM_WINDOW_WIDTH / 2;
    namedBox(wall, 'Solid window pier', [0.2, L.vaultSpring, edge - previousEdge],
      [0, L.vaultSpring / 2, (edge + previousEdge) / 2], materials.wood);
    let previousTop = 0;
    for (const {base, height} of levels) {
      namedBox(wall, 'Solid window spandrel', [0.2, base - previousTop, LONG_ROOM_WINDOW_WIDTH],
        [0, (base + previousTop) / 2, z], materials.wood);
      previousTop = base + height;
    }
    namedBox(wall, 'Window head below vault spring', [0.2, L.vaultSpring - previousTop, LONG_ROOM_WINDOW_WIDTH],
      [0, (L.vaultSpring + previousTop) / 2, z], materials.wood);
    previousEdge = z + LONG_ROOM_WINDOW_WIDTH / 2;
  }
  namedBox(wall, 'Solid end window pier', [0.2, L.vaultSpring, L.length / 2 - previousEdge],
    [0, L.vaultSpring / 2, (L.length / 2 + previousEdge) / 2], materials.wood);
  markCameraCollider(wall, { id: `long-room-wall-${side}`, shape: 'box',
    center: { x: 0, y: L.height / 2, z: 0 }, size: { x: 0.2, y: L.height, z: L.length } });
  root.add(wall);
}

function addWindow(root: THREE.Group, materials: LibraryMaterials, sashTemplates: THREE.Group[], shadeMaterial: THREE.Material, revealTemplate: THREE.Group, side: number, z: number) {
  const frameX = side * (L.width / 2 - 0.06);
  for (const [level, {base, height}] of longRoomWindowLevels().entries()) {
    const sashes = sashTemplates[level].clone();
    sashes.rotation.y = -side * Math.PI / 2;
    sashes.position.set(frameX - side * 0.04, base, z); root.add(sashes);
    for (const dz of [-0.77, 0.77]) namedBox(root, 'Oak window reveal', [0.34, height, 0.04],
      [side * (L.width / 2 - 0.01), base + height / 2, z + dz], materials.woodDark);
    namedBox(root, 'Projecting oak window sill', [0.48, 0.12, 1.8],
      [frameX - side * 0.12, base - 0.04, z], materials.woodWarm);
    namedBox(root, 'Recessed window head lining', [0.34, 0.08, 1.6],
      [side * (L.width / 2 - 0.01), base + height, z], materials.woodDark);
    for (const dz of [-0.8, 0.8]) namedBox(root, 'Sash window jamb', [0.16, height + 0.18, 0.1], [frameX - side * 0.08, base + height / 2, z + dz], materials.woodWarm);
    for (const inset of [0, 0.07]) {
      for (const dz of [-0.9 - inset, 0.9 + inset]) {
        const profile = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, height + 0.3 + inset * 2, 20), materials.woodWarm);
        profile.name = 'Rounded window architrave bead'; profile.position.set(frameX - side * (0.2 + inset), base + height / 2, z + dz);
        profile.castShadow = profile.receiveShadow = true; root.add(profile);
      }
      for (const y of [base - 0.15 - inset, base + height + 0.15 + inset]) {
        const profile = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8 + inset * 2, 20), materials.woodWarm);
        profile.rotation.x = Math.PI / 2; profile.name = 'Rounded window head and sill bead';
        profile.position.set(frameX - side * (0.2 + inset), y, z); profile.castShadow = profile.receiveShadow = true; root.add(profile);
      }
    }
    if (base < L.galleryY) {
      for (const edge of [-1, 1]) {
        const reveal = revealTemplate.clone();
        reveal.position.set(side * (L.width / 2 - 0.4), base, z + edge * 0.85);
        reveal.rotation.y = side * edge * 0.35;
        root.add(reveal);
      }
      const liningMaterial = (revealTemplate.children[0] as THREE.Mesh).material;
      namedBox(root, 'Pale window reveal soffit', [0.7, 0.065, 1.98],
        [side * (L.width / 2 - 0.3), base + height + 0.035, z], liningMaterial as THREE.Material);
      for (const edge of [-1, 1]) namedBox(root, 'Window return rear closing stile', [0.14, height, 0.075],
        [side * (L.width / 2 - 0.21), base + height / 2, z + edge * 0.765], liningMaterial as THREE.Material);
      const shade = createWindowShade(1.44, height - 0.12, shadeMaterial);
      shade.rotation.y = -side * Math.PI / 2; shade.position.set(side * (L.width / 2 - 0.34), base + 0.03, z); root.add(shade);
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.52, 32), materials.woodWarm);
      roller.name = 'Window blind top roller'; roller.rotation.x = Math.PI / 2;
      roller.position.set(side * (L.width / 2 - 0.34), base + height - 0.04, z); roller.castShadow = true; root.add(roller);
    }
    const catchPlate = namedBox(root, 'Brass sash catch plate', [0.045, 0.04, 0.13], [frameX - side * 0.17, base + height / 2, z], materials.brass);
    catchPlate.castShadow = true;
    const catchHandle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 32, Math.PI), materials.brass);
    catchHandle.name = 'Curved sash catch handle'; catchHandle.rotation.y = Math.PI / 2;
    catchHandle.position.set(frameX - side * 0.2, base + height / 2, z); root.add(catchHandle);

  }
}

function addGallery(root: THREE.Group, materials: LibraryMaterials, side: number, includeRetiredRooms: boolean) {
  const width = L.width / 2 - L.galleryInnerX;
  const gallery = new THREE.Group(); gallery.name = 'Continuous straight upper gallery'; root.add(gallery);
  const slab = (x0: number, x1: number, z0: number, z1: number, index: number, name = 'Continuous upper gallery floor') => {
    const size: [number, number, number] = [x1 - x0, 0.24, z1 - z0];
    const floor = namedBox(gallery, name, size,
      [(x0 + x1) / 2, L.galleryY - 0.12, (z0 + z1) / 2], materials.floor);
    alignFloorGrain(floor);
    markCameraCollider(floor, { id: `long-room-gallery-${side}-${index}`, shape: 'box', center: {x: 0, y: 0, z: 0}, size: {x: size[0], y: size[1], z: size[2]} });
  };
  if (side === 1) slab(L.galleryInnerX, L.galleryInnerX + width, -L.length / 2, L.length / 2, 0);
  else {
    const half = S.opening / 2, outer = -L.width / 2, inner = -L.galleryInnerX;
    const apertureFloor = 'Gallery floor around historic stair aperture';
    slab(outer, inner, -L.length / 2, S.z - half, 0, apertureFloor);
    slab(outer, inner, S.z + half, L.length / 2, 1, apertureFloor);
    slab(outer, S.x - half, S.z - half, S.z + half, 2, apertureFloor);
    slab(S.x + half, inner, S.z - half, S.z + half, 3, apertureFloor);
  }
  const guardSpans = includeRetiredRooms
    ? [[-45, WEST_GALLERY_CROSSWALK.outer], [WEST_GALLERY_CROSSWALK.inner, E.front], [E.back, 45]]
    : [[WEST_GALLERY_CROSSWALK.inner + LIVE_GALLERY_CORNER_RADIUS,
      E.front - LIVE_GALLERY_CORNER_RADIUS]];
  for (const [height, thickness, depth] of [[-0.36, 0.12, 0.31], [-0.16, 0.12, 0.44], [0.1, 0.14, 0.2], [1.05, 0.13, 0.24]]) {
    const spans = includeRetiredRooms && height <= 0 ? [[-45, 45]] : guardSpans;
    for (const [start, end] of spans) namedBox(root, 'Gallery continuous entablature and rail', [depth, thickness, end - start],
      [side * L.galleryInnerX, L.galleryY + height, (start + end) / 2], materials.woodWarm);
  }
  for (const [start, end] of guardSpans) markCameraCollider(root, {
    id: `gallery-guard-${side}-${start}`, shape: 'box',
    center: {x: side * L.galleryInnerX, y: L.galleryY + 1.1, z: (start + end) / 2},
    size: {x: 0.26, y: 2.2, z: end - start},
  });
  const newelPositions = addLongRoomGalleryPosts(root, materials, side);
  const geometry = createLongRoomBaluster();
  const count = Math.floor(L.length / 0.18);
  const balusters = new THREE.InstancedMesh(geometry, materials.woodWarm, count);
  balusters.name = `Turned gallery balusters ${side}`;
  let written = 0;
  for (let i = 0; i < count; i++) {
    const z = -L.length / 2 + (i + 0.5) * L.length / count;
    if (includeRetiredRooms) {
      if ((z > WEST_GALLERY_CROSSWALK.outer && z < WEST_GALLERY_CROSSWALK.inner)
        || (z > E.front && z < E.back)) continue;
    } else if (z < WEST_GALLERY_CROSSWALK.inner + LIVE_GALLERY_CORNER_RADIUS
      || z > E.front - LIVE_GALLERY_CORNER_RADIUS) continue;
    if (newelPositions.some(position => Math.abs(position - z) < 0.32)) continue;
    balusters.setMatrixAt(written++, galleryBalusterPlacement(side * L.galleryInnerX,L.galleryY,z));
  }
  balusters.count = written; balusters.castShadow = true; balusters.receiveShadow = true;
  root.add(balusters);
}

function addHistoricAlcoveStair(root: THREE.Group, materials: LibraryMaterials) {
  const count = Math.ceil(L.galleryY / 0.185);
  const stair = createLongRoomSpiralStair(materials.iron, {
    height: L.galleryY, diameter: S.diameter, entryAngle: -(count - 0.5) * Math.PI * 2 / 14,
  });
  stair.position.set(S.x, 0, S.z);
  stair.userData.placement = 'south-entry-alcove-public-tour-estimated-anchor';
  root.add(stair);
  // The final fan tread faces the aisle; a short landing spans the opening clearance.
  const landingCenterX = S.x + 1;
  const landingLength = 0.5;
  const landingGuardStartX = S.x + 0.9;
  namedBox(root, 'Iron stair upper landing', [landingLength, 0.08, S.landingWidth],
    [landingCenterX, L.galleryY - 0.04, S.z], materials.iron);
  const half = S.opening / 2;
  const uprightGeometry=new THREE.CylinderGeometry(0.012,0.012,1.02,12);
  let guardIndex=0;
  const fence = (a: THREE.Vector3, b: THREE.Vector3) => {
    const rail = beam([a.clone().add(V(0, 1.02, 0)), b.clone().add(V(0, 1.02, 0))], materials.iron, 0.025, 1);
    rail.name = 'Iron stair opening guard'; rail.castShadow = true; root.add(rail);
    const length=a.distanceTo(b),mid=a.clone().lerp(b,0.5);
    markCameraCollider(root,{id:`spiral-opening-guard-${guardIndex++}`,shape:'box',
      center:{x:mid.x,y:L.galleryY+1.1,z:mid.z},size:{x:0.05,y:2.2,z:length},rotationY:Math.atan2(b.x-a.x,b.z-a.z)});
    const lower=beam([a.clone().add(V(0,0.08,0)),b.clone().add(V(0,0.08,0))],materials.iron,0.012,1);
    lower.name='Iron stair opening lower rail';lower.castShadow=lower.receiveShadow=true;root.add(lower);
    const count = Math.ceil(length / 0.15);
    for (let i = 0; i <= count; i++) {
      const p = a.clone().lerp(b, i / count);
      const upright=new THREE.Mesh(uprightGeometry,materials.iron);upright.name='Iron stair opening round upright';
      upright.position.set(p.x,p.y+0.51,p.z);upright.castShadow=upright.receiveShadow=true;root.add(upright);
    }
  };
  fence(V(S.x - half, L.galleryY, S.z - half), V(S.x - half, L.galleryY, S.z + half));
  for (const sign of [-1, 1]) {
    fence(V(S.x - half, L.galleryY, S.z + sign * half), V(S.x + half, L.galleryY, S.z + sign * half));
    fence(V(S.x + half, L.galleryY, S.z + sign * half), V(S.x + half, L.galleryY, S.z + sign * S.landingWidth/2));
    // Leave only the short fan-tread-to-landing transition open; guard the
    // remainder of both landing edges without pinching the guided route.
    fence(V(landingGuardStartX, L.galleryY, S.z + sign * S.landingWidth / 2),
      V(landingCenterX + landingLength / 2, L.galleryY, S.z + sign * S.landingWidth / 2));
  }
}

/** Retained west upper crosswalk; the freestanding access stair has been removed. */
function addGalleryAccess(root: THREE.Group, materials: LibraryMaterials, includeRetiredRooms: boolean) {
  const stair=new THREE.Group();stair.name='Gallery end crossing';
  stair.userData.fidelity='XS-6B turned end balustrade; adapted bridge dimensions';
  const length=L.galleryInnerX*2;
  const outerZ = includeRetiredRooms ? WEST_GALLERY_CROSSWALK.outer : -L.length / 2;
  const floorDepth = WEST_GALLERY_CROSSWALK.inner - outerZ;
  const floor=namedBox(stair, 'Gallery end crosswalk', [length, 0.24, floorDepth],
    [0, L.galleryY - 0.12, (outerZ + WEST_GALLERY_CROSSWALK.inner) / 2], materials.floor);
  markCameraCollider(floor,{id:'west-gallery-crosswalk-floor',shape:'box',center:{x:0,y:0,z:0},size:{x:length,y:.24,z:floorDepth}});
  const count=Math.ceil(length/.18),balusters=new THREE.InstancedMesh(createLongRoomBaluster(),materials.woodWarm,count*2);
  balusters.name='West crosswalk turned balusters';balusters.castShadow=balusters.receiveShadow=true;
  let instanceIndex=0;
  const guardRows = includeRetiredRooms
    ? [WEST_GALLERY_CROSSWALK.outer, WEST_GALLERY_CROSSWALK.inner]
    : [WEST_GALLERY_CROSSWALK.inner];
  for (const z of guardRows) {
    // The front run has a centered 1.8 m opening aligned with the west upper
    // doorway in the historical study. The sealed live hall has a solid wall,
    // so it does not need a redundant railing pressed against that wall.
    const segments: readonly [number,number][] = z === WEST_GALLERY_CROSSWALK.outer
      ? [[-L.galleryInnerX,-.9],[.9,L.galleryInnerX]]
      : [[-L.galleryInnerX + (includeRetiredRooms ? 0 : LIVE_GALLERY_CORNER_RADIUS),
        L.galleryInnerX - (includeRetiredRooms ? 0 : LIVE_GALLERY_CORNER_RADIUS)]];
    for (const [x0,x1] of segments) {
      const segmentWidth=x1-x0;
      markCameraCollider(stair, {id: `crosswalk-guard-${z}-${x0}`, shape: 'box', center: {x: (x0+x1)/2, y: L.galleryY + 1.1, z}, size: {x: segmentWidth, y: 2.2, z: 0.24}});
      namedBox(stair, 'Crosswalk handrail', [segmentWidth, 0.13, 0.24], [(x0+x1)/2, L.galleryY + 1.05, z], materials.woodWarm);
      namedBox(stair, 'Crosswalk supporting lower rail', [segmentWidth,.14,.2], [(x0+x1)/2,L.galleryY+.1,z],materials.woodWarm);
      for(const [offset,height,depth] of [[-.36,.12,.31],[-.16,.12,.44]])
        namedBox(stair,'Crosswalk layered entablature',[segmentWidth,height,depth],[(x0+x1)/2,L.galleryY+offset,z],materials.woodWarm);
      const segmentCount=Math.ceil(segmentWidth/.18);
      for(let i=0;i<segmentCount;i++)balusters.setMatrixAt(instanceIndex++,galleryBalusterPlacement(x0+(i+.5)*segmentWidth/segmentCount,L.galleryY,z));
    }
  }
  // Retain one instanced mesh for the static-batching path and collapse the
  // unused front-opening slots instead of placing members at the origin.
  const hidden=new THREE.Matrix4().makeScale(0,0,0);
  while(instanceIndex<balusters.count)balusters.setMatrixAt(instanceIndex++,hidden);
  balusters.instanceMatrix.needsUpdate=true;
  stair.add(balusters);

  stair.traverse(object => { if (object instanceof THREE.Mesh && object.material === materials.floor) alignFloorGrain(object); });
  root.add(stair);
}

/** The live hall is sealed at the east wall, but its upper circulation still
 * needs the fourth side of the gallery ring. This bridge does not reuse the
 * retired doorway transition or its off-level treads. */
function addLiveEastGalleryCrosswalk(root: THREE.Group, materials: LibraryMaterials) {
  const crossing = new THREE.Group();
  crossing.name = 'Live east gallery ring crossing';
  crossing.userData.fidelity = 'user-directed full gallery loop; adapted bridge dimensions';
  const length = L.galleryInnerX * 2;
  const depth = L.length / 2 - E.front;
  const floor = namedBox(crossing, 'Live east gallery crosswalk floor', [length, 0.24, depth],
    [0, L.galleryY - 0.12, (E.front + L.length / 2) / 2], materials.floor);
  alignFloorGrain(floor);
  markCameraCollider(floor, { id: 'live-east-gallery-crosswalk-floor', shape: 'box', center: {x: 0, y: 0, z: 0},
    size: {x: length, y: 0.24, z: depth} });

  const balusterGeometry = createLongRoomBaluster();
  const maxCount = Math.ceil(length / 0.18);
  const balusters = new THREE.InstancedMesh(balusterGeometry, materials.woodWarm, maxCount);
  balusters.name = 'Live east crosswalk turned balusters';
  balusters.castShadow = balusters.receiveShadow = true;
  let instanceIndex = 0;
  // Only the central-void edge needs fall protection. The opposite edge meets
  // the solid east wall, where a second balustrade created a false slot.
  for (const z of [E.front]) {
    const x0 = -L.galleryInnerX + LIVE_GALLERY_CORNER_RADIUS;
    const x1 = L.galleryInnerX - LIVE_GALLERY_CORNER_RADIUS;
    const segmentWidth = x1 - x0;
    markCameraCollider(crossing, { id: `live-east-crosswalk-guard-${z}`, shape: 'box',
      center: {x: 0, y: L.galleryY + 1.1, z}, size: {x: segmentWidth, y: 2.2, z: 0.24} });
    namedBox(crossing, 'Live east crosswalk handrail', [segmentWidth, 0.13, 0.24],
      [0, L.galleryY + 1.05, z], materials.woodWarm);
    namedBox(crossing, 'Live east crosswalk supporting lower rail', [segmentWidth, 0.14, 0.2],
      [0, L.galleryY + 0.1, z], materials.woodWarm);
    for (const [offset, height, railDepth] of [[-0.36, 0.12, 0.31], [-0.16, 0.12, 0.44]]) {
      namedBox(crossing, 'Live east crosswalk layered entablature', [segmentWidth, height, railDepth],
        [0, L.galleryY + offset, z], materials.woodWarm);
    }
    const count = Math.ceil(segmentWidth / 0.18);
    for (let index = 0; index < count; index++) {
      balusters.setMatrixAt(instanceIndex++, galleryBalusterPlacement(
        x0 + (index + 0.5) * segmentWidth / count, L.galleryY, z,
      ));
    }
  }
  balusters.count = instanceIndex;
  crossing.add(balusters);
  root.add(crossing);
}

/** Four supported quarter-circle turns join the live crosswalk rails to the
 * longitudinal rails. Each turn adds floor into the former square void corner;
 * it never subtracts an aperture from either walkable slab. */
function addLiveGalleryRoundedCorners(root: THREE.Group, materials: LibraryMaterials) {
  const corners = new THREE.Group();
  corners.name = 'Supported curved live gallery corners';
  corners.userData.fidelity = 'user-directed rounded gallery circulation; joinery dimensions estimated';
  const radius = LIVE_GALLERY_CORNER_RADIUS;
  const balustersPerCorner = Math.ceil(Math.PI * radius / 2 / 0.18);
  const balusters = new THREE.InstancedMesh(
    createLongRoomBaluster(),
    materials.woodWarm,
    balustersPerCorner * 4,
  );
  balusters.name = 'Curved gallery corner turned balusters';
  balusters.castShadow = balusters.receiveShadow = true;
  let balusterIndex = 0;

  for (const [end, edgeZ, inwardZ] of [
    ['west', WEST_GALLERY_CROSSWALK.inner, 1],
    ['east', E.front, -1],
  ] as const) {
    for (const side of [-1, 1]) {
      const centerX = side * (L.galleryInnerX - radius);
      const centerZ = edgeZ + inwardZ * radius;
      const startAngle = side === 1 ? 0 : Math.PI;
      const endAngle = startAngle - side * inwardZ * Math.PI / 2;
      const floor = new THREE.Mesh(
        createGalleryCornerFloorInfillGeometry(side, inwardZ, radius, 0.24),
        materials.floor,
      );
      floor.name = 'Solid curved gallery corner floor infill';
      floor.position.set(centerX, L.galleryY - 0.12, centerZ);
      floor.castShadow = floor.receiveShadow = true;
      floor.userData.isPositiveFloorInfill = true;
      alignFloorGrain(floor);
      const floorBandDepth = radius * (Math.SQRT2 - 1);
      markCameraCollider(floor, {
        id: `live-gallery-corner-floor-${end}-${side}`,
        shape: 'arc',
        center: {x: 0, y: 0, z: 0},
        radius: radius + floorBandDepth / 2,
        radialDepth: floorBandDepth,
        height: 0.24,
        startAngle,
        endAngle,
        segments: 8,
      });
      corners.add(floor);

      for (const [name, y, height, radialDepth] of [
        ['Curved gallery corner handrail', L.galleryY + 1.05, 0.13, 0.24],
        ['Curved gallery corner supporting lower rail', L.galleryY + 0.1, 0.14, 0.2],
        ['Curved gallery corner upper entablature', L.galleryY - 0.16, 0.12, 0.44],
        ['Curved gallery corner lower entablature', L.galleryY - 0.36, 0.12, 0.31],
      ] as const) {
        const member = new THREE.Mesh(
          createGalleryArcPrismGeometry(radius, radialDepth, height, startAngle, endAngle),
          materials.woodWarm,
        );
        member.name = name;
        member.position.set(centerX, y, centerZ);
        member.castShadow = member.receiveShadow = true;
        corners.add(member);
      }

      markCameraCollider(corners, {
        id: `live-gallery-corner-rail-${end}-${side}`,
        shape: 'arc',
        center: {x: centerX, y: L.galleryY + 1.1, z: centerZ},
        radius,
        radialDepth: 0.26,
        height: 2.2,
        startAngle,
        endAngle,
        segments: 8,
      });
      for (let index = 0; index < balustersPerCorner; index++) {
        const angle = startAngle + (endAngle - startAngle) * (index + 0.5) / balustersPerCorner;
        balusters.setMatrixAt(balusterIndex++, galleryBalusterPlacement(
          centerX + Math.cos(angle) * radius,
          L.galleryY,
          centerZ + Math.sin(angle) * radius,
        ));
      }
    }
  }
  balusters.count = balusterIndex;
  corners.add(balusters);
  root.add(corners);
}

/** Photo-derived upper-shelf supports; dimensions remain joinery estimates. */
class UpperShelfBrackets {
  private shelfEdges: THREE.Matrix4[] = [];
  addShelfEdges(x: number, y: number, z: number, width: number, faces = LONG_ROOM_SHELF_FACES) {
    for (const face of faces) {
      const matrix = new THREE.Matrix4().makeScale(width, 1, 1);
      matrix.setPosition(x, y + 0.012, z + face * (L.caseThickness / 2 + 0.023));
      this.shelfEdges.push(matrix);
    }
  }
  private transforms: THREE.Matrix4[] = [];
  add(x: number, y: number, z: number, face: number) {
    const matrix = new THREE.Matrix4().makeRotationY(-face * Math.PI / 2);
    matrix.setPosition(x, y, z); this.transforms.push(matrix);
  }
  finish(root: THREE.Group, material: THREE.Material) {
    const shape = new THREE.Shape();
    shape.moveTo(0.042, -0.038); shape.lineTo(0.254, -0.038); shape.lineTo(0.042, -0.178); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.026, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 3, steps: 1 });
    geometry.translate(0, 0, -0.013);
    const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) / 0.6, positions.getY(i) / 2.8);
    const mesh = new THREE.InstancedMesh(geometry, material, this.transforms.length);
    mesh.name = 'Upper shelf timber support brackets';
    mesh.userData.fidelity = 'photo-derived-form-estimated-dimensions';
    this.transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    const beadGeometry = new THREE.CylinderGeometry(0.014, 0.014, 1, 16);
    beadGeometry.rotateZ(Math.PI / 2);
    const beads = new THREE.InstancedMesh(beadGeometry, material, this.shelfEdges.length);
    beads.name = 'Continuous rounded timber shelf nosings';
    beads.userData.fidelity = 'photographic-edge-profile-estimated-radius';
    this.shelfEdges.forEach((matrix, index) => beads.setMatrixAt(index, matrix));
    beads.castShadow = beads.receiveShadow = true; root.add(beads);
  }
}
const upperShelfSupportOffsets = (width: number) => width > 0.65 ? [width * 0.16, width * 0.5, width * 0.84] : [];

function addTransverseCase(root: THREE.Group, materials: LibraryMaterials, volumes: HistoricalVolumes | null, brackets: UpperShelfBrackets,
  side: number, z: number, bay: number, level: number,
  pilasters: PilasterTemplates, caseTemplates: Map<string, THREE.Group>, shelfFaces = LONG_ROOM_SHELF_FACES) {
  const base = level === 0 ? 0 : L.galleryY + 0.08;
  const inner = L.aisleHalfWidth + 0.15, outer = L.width / 2 - 0.14;
  const span = outer - inner;
  const heightAt = (x: number) => level === 0 ? L.lowerCaseHeight : longRoomRoofY(x) - base - 0.22;
  const shelfHeight = heightAt(inner);
  const shelfPitch = longRoomShelfPitch(shelfHeight);
  const templateKey = `${side}:${level}`;
  let template = caseTemplates.get(templateKey);
  if (!template) {
    template = new THREE.Group();
    for (let panel = 0; panel < 10; panel++) {
      const x = inner + span * (panel + 0.5) / 10;
      namedBox(template, 'Bookcase fitted backboard', [span / 10 + 0.005, heightAt(x), 0.08], [side * x, base + heightAt(x) / 2, 0], materials.woodDark);
    }
    for (const x of [inner, outer]) namedBox(template, 'Bookcase outer stile', [0.12, heightAt(x), L.caseThickness], [side * x, base + heightAt(x) / 2, 0], materials.woodWarm);
    for (let row = 0; row < L.shelfRows; row++) {
      const y = longRoomShelfBoardY(row, shelfHeight);
      namedBox(template, 'Continuous shelf board', [span, LONG_ROOM_SHELF_BOARD_THICKNESS, L.caseThickness + 0.06],
        [side * (inner + span / 2), base + y, 0], materials.woodWarm);
    }
    if (level === 1) {
      const arch = beam(Array.from({length: 33}, (_, i) => {
        const x = side * (inner + span * i / 32); return V(x, longRoomRoofY(x) - 0.16, 0);
      }), materials.woodWarm, 0.08, 32);
      arch.name = 'Upper case arch following barrel vault'; template.add(arch);
    }
    caseTemplates.set(templateKey, template);
  }
  const group = template.clone();
  group.name = `Transverse oak case ${side}:${bay}:${level}`;
  group.userData.shelfFaces = [...shelfFaces];
  if (shelfFaces.length === 1) {
    for (const child of [...group.children]) {
      if (child.name === 'Continuous shelf board') group.remove(child);
    }
    const face = shelfFaces[0];
    const halfDepth = (L.caseThickness + 0.06) / 2;
    for (let row = 0; row < L.shelfRows; row++) {
      const y = longRoomShelfBoardY(row, shelfHeight);
      namedBox(group, 'Continuous single-face shelf board',
        [span, LONG_ROOM_SHELF_BOARD_THICKNESS, halfDepth],
        [side * (inner + span / 2), base + y, face * halfDepth / 2], materials.woodWarm);
    }
  }
  group.position.z = z; root.add(group);
  for (let row = 0; row < L.shelfRows; row++) {
    const y = longRoomShelfBoardY(row, shelfHeight);
    const availableOuter = outer;
    if (availableOuter <= inner) continue;
    const width = availableOuter - inner;
    brackets.addShelfEdges(side * (inner + width / 2), base + y, z, width, shelfFaces);
    const nextOuter = outer;
    const nextSupports = level === 1 && row < L.shelfRows - 1 ? upperShelfSupportOffsets(nextOuter - inner) : [];
    for (const face of shelfFaces) {
      if (level === 1) for (const offset of upperShelfSupportOffsets(width)) brackets.add(side * (inner + offset), base + y, z, face);
      if (!volumes) continue;
      // Size-sorted rows contain short matching sets and individual bindings.
      // These dimensions are photographic estimates, not item-level catalog data.
      // Official collection guidance: largest formats on lower shelves.
      const rowFormatHeight = Math.min(0.68 - row * 0.012, shelfPitch - 0.13);
      let cursor = 0.08;
      for (let book = 0; cursor < width - 0.08; book++) {
        const seed = (bay * 173 + row * 59 + book * 19 + level * 31 + (side + face + 2) * 7) >>> 0;
        const setSeed = bay * 41 + row * 29 + Math.floor(book / 5) * 17 + level * 13;
        const matchingSet = setSeed % 3 === 0;
        const bindingSeed = matchingSet ? setSeed : seed;
        const thickness = 0.024 + (bindingSeed % 9) * 0.006;
        if (cursor + thickness > width - 0.08) break;
        const offset = cursor + thickness / 2;
        cursor += thickness + 0.003;
        const h = Math.min(rowFormatHeight + Math.sin(bindingSeed * 12.9898) * 0.035,
          heightAt(inner + offset) - y - 0.09);
        if (h < 0.15) continue;
        if (level === 1 && h > shelfPitch - 0.178 - 0.04) {
          if (nextSupports.some(x => Math.abs(x - offset) < thickness / 2 + 0.021)) continue;
        }
        // Slightly recessed spines remain on the shelf, behind its rounded edge.
        const setback = (bindingSeed % 5) * 0.003;
        volumes.add(side * (inner + offset), base + y + 0.04 + h / 2,
          z + face * (LONG_ROOM_HISTORICAL_BOOK_CENTER_OFFSET - setback), thickness, h, 0.22, 0, bindingSeed);
      }
    }
  }
  addPilaster(root, materials, side, z, base, heightAt(inner), pilasters);
  markCameraCollider(group, { id: `long-room-case-${side}-${bay}-${level}`, shape: 'box',
    center: { x: side * (inner + span / 2), y: base + heightAt(inner) / 2, z: 0 },
    size: { x: span, y: heightAt(inner), z: L.caseThickness + 0.08 } });
}

/** User requested removal of the basement and its central descending entrance. */
function addHallFloor(root: THREE.Group, materials: LibraryMaterials) {
  const floor=namedBox(root,'Continuous Long Room timber floor',[L.width,0.18,L.length],[0,-0.09,0],materials.floor);
  const position=floor.geometry.getAttribute('position'),normal=floor.geometry.getAttribute('normal'),uv=floor.geometry.getAttribute('uv');
  for(let vertex=0;vertex<position.count;vertex++)if(normal.getY(vertex)>0.5)
    uv.setXY(vertex,position.getX(vertex)/2.88,position.getZ(vertex)/4.8);
  uv.needsUpdate=true;
  markCameraCollider(floor,{id:'long-room-floor',shape:'box',center:{x:0,y:0,z:0},size:{x:L.width,y:0.18,z:L.length}});
}

function* buildLongRoomSteps(options: LongRoomBuildOptions = {}): Generator<string | void, LongRoomBuilt> {
  const includeRetiredRooms = options.includeRetiredRooms ?? false;
  const root = new THREE.Group(); root.name = 'Trinity College Dublin Long Room';
  root.userData.metresPerUnit = 1; root.userData.dimensions = { length: L.length, width: L.width, height: L.height };
  // Shared fine-oak PBR finish also used by the component review views.
  const materials = createLibraryMaterials(undefined, false, 'historic-oak');
  yield;
  addHallFloor(root, materials);
  const sections: ExpandableShelfSection[] = [], slots: LongRoomSlot[] = [];
  // Historical volumes are isolated reference scenery only. The live hall
  // deliberately leaves every unoccupied shelf empty.
  const volumes = includeRetiredRooms ? new HistoricalVolumes() : null;
  const brackets = new UpperShelfBrackets();
  const shadeMaterial = createWindowShadeMaterial();
  const revealMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.parchment).lerp(new THREE.Color(PALETTE.stone), 0.45), roughness: 0.7,
  });
  revealMaterial.name = 'Photo-estimated pale window lining';
  const revealTemplate = createLongRoomWindowReveal(longRoomWindowLevels()[0].height, revealMaterial);
  const windowMaterial = new THREE.MeshStandardMaterial({color: PALETTE.parchment, emissive: PALETTE.parchment,
    emissiveIntensity: 0.55, roughness: 0.4, side: THREE.DoubleSide});
  // Scope shared geometry to this build, so disposed resources are never reused
  // by a later scene or a different material set.
  const pilasters: PilasterTemplates = {capital: createLongRoomCapital(materials.woodWarm), shafts: new Map()};
  const caseTemplates = new Map<string, THREE.Group>();
  yield 'construction-pilaster-template';
  const sashTemplates = longRoomWindowLevels().map(({height}) => createLongRoomSashes(height, materials.woodWarm, windowMaterial));
  for (const side of [-1, 1]) {
    const windowTemplate=new THREE.Group();
    windowTemplate.name=`Paired Long Room window detail ${side}`;
    addWindow(windowTemplate,materials,sashTemplates,shadeMaterial,revealTemplate,side,0);
    yield `construction-window-template-${side}`;
    addExteriorWall(root, materials, side);
    addGallery(root, materials, side, includeRetiredRooms);
    yield;
    for (let bay = 0; bay < L.alcovesPerSide; bay++) {
      const z = L.length / 2 - L.endMargin - bay * P;
      const window=windowTemplate.clone();window.position.z=longRoomBayZ(bay);root.add(window);
      const id = longRoomShelfSectionId(side, bay);
      const isOmittedLiveCase = !includeRetiredRooms && isLongRoomLiveCaseOmitted(side, bay);
      if (isOmittedLiveCase) {
        yield `construction-clear-live-case-${side}-${bay}`;
        continue;
      }
      const catalogSectionIndex = includeRetiredRooms ? id : longRoomLiveCatalogSectionIndex(id);
      const shelfFaces: readonly LongRoomShelfFace[] = !includeRetiredRooms
        && isLongRoomLiveShelfFaceOmitted(side, bay, 1) ? [-1] : LONG_ROOM_SHELF_FACES;
      const catalogFace: LongRoomShelfFace = includeRetiredRooms ? 1 : longRoomLiveCatalogFace(side, bay);
      const centerX = side * (L.aisleHalfWidth + 0.15 + (L.width / 2 - 0.14 - L.aisleHalfWidth - 0.15) / 2);
      const section: ExpandableShelfSection = { id, angle: -catalogFace * Math.PI / 2, radius: Math.hypot(centerX, z),
        centerX, centerZ: z, width: L.width / 2 - L.aisleHalfWidth - 0.29, height: L.lowerCaseHeight, baseY: 0, depth: L.caseThickness, shelfCount: L.shelfRows };
      sections.push(section);
      for (let book = 0; book < LONG_ROOM_CATALOG_SECTION_CAPACITY; book++) {
        const row = Math.floor(book / LONG_ROOM_CATALOG_BOOKS_PER_ROW);
        const shelfY = longRoomShelfBoardY(row, L.lowerCaseHeight);
        slots.push({ sectionId: id, catalogSectionIndex, rowIndex: row, position: V(centerX,
          shelfY + LONG_ROOM_SHELF_BOARD_THICKNESS / 2 + LONG_ROOM_CATALOG_BOOK_SIZE.height / 2,
          z + catalogFace * LONG_ROOM_BOOK_CENTER_OFFSET), scale: V(
          LONG_ROOM_CATALOG_BOOK_SIZE.spineWidth,
          LONG_ROOM_CATALOG_BOOK_SIZE.height,
          LONG_ROOM_CATALOG_BOOK_SIZE.coverWidth,
        ), rotationY: 0, lean: 0, spineFace: catalogFace });
      }
      addTransverseCase(root, materials, volumes, brackets, side, z, bay, 0,
        pilasters, caseTemplates, shelfFaces);
      addTransverseCase(root, materials, volumes, brackets, side, z, bay, 1,
        pilasters, caseTemplates, shelfFaces);
      yield `construction-case-${side}-${bay}`;
    }
  }
  yield;
  root.add(yield* createLongRoomVaultSteps(materials));
  yield;
  root.add(yield* createWestConnectionSteps(materials,false,false,includeRetiredRooms));
  yield 'construction-west-pavilion';
  addLongRoomEastEnd(root, materials, includeRetiredRooms);
  yield;
  addLongRoomShelfMarks(root, includeRetiredRooms);
  yield;
  addLongRoomLamps(root, materials, includeRetiredRooms);
  yield;
  addLongRoomCrystalChandeliers(root, materials);
  yield;
  if (includeRetiredRooms) yield* addLongRoomShelfLaddersSteps(root, materials, true);
  addLongRoomGalleryCornice(root, materials);
  yield;
  addGalleryAccess(root, materials, includeRetiredRooms);
  if (includeRetiredRooms) addEastGalleryConnection(root, materials);
  else {
    addLiveEastGalleryCrosswalk(root, materials);
    addLiveGalleryRoundedCorners(root, materials);
  }
  yield;
  addHistoricAlcoveStair(root, materials);
  yield;
  brackets.finish(root, materials.woodWarm);
  yield 'construction-upper-brackets';
  if (volumes) yield* volumes.finish(root);
  yield;
  addLongRoomFloorOcclusion(root);
  yield 'construction-floor-contact-occlusion';
  // Interior bounce approximation: a downward-facing oak vault receives little
  // sky hemisphere light. Account for reflected daylight separately from sun.
  const daylight = new THREE.Color(PALETTE.parchment).lerp(new THREE.Color(PALETTE.glassBlue), 0.8).multiplyScalar(5);
  const ambient = new THREE.HemisphereLight(daylight, PALETTE.parchment, 1.45);
  ambient.name = 'Diffuse daylight reflected throughout the hall'; root.add(ambient);
  root.add(new THREE.AmbientLight(PALETTE.parchment, 0.6));
  const vaultBounce = new THREE.DirectionalLight(PALETTE.parchment, 2.0);
  vaultBounce.name = 'Floor reflected daylight on the oak vault';
  vaultBounce.position.set(0, 1, 0); vaultBounce.target.position.set(0, L.height, 0);
  root.add(vaultBounce, vaultBounce.target);
  for (const side of [-1, 1]) {
    const sunlight = new THREE.DirectionalLight(daylight, side === -1 ? 3.5 : 0.7);
    sunlight.position.set(side * 24, 18, -4); sunlight.target.position.set(0, 2, 0);
    if (side === -1) {
      sunlight.name = 'Window daylight with architectural shadows'; sunlight.castShadow = true;
      sunlight.shadow.mapSize.set(4096, 4096);
      Object.assign(sunlight.shadow.camera, { left: -52, right: 52, top: 34, bottom: -34, near: 0.5, far: 120 });
      sunlight.shadow.bias = -0.00015; sunlight.shadow.normalBias = 0.035;
      sunlight.shadow.autoUpdate = false; sunlight.shadow.needsUpdate = true;
    }
    root.add(sunlight, sunlight.target);
  }
  const catalogTerminal = new THREE.Group(); // Catalog search is product UI, no fictional furniture in the reconstruction.
  return { root, materials, shelfSections: sections, catalogSlots: slots.sort((a, b) => a.catalogSectionIndex - b.catalogSectionIndex || a.rowIndex - b.rowIndex),
    interactiveObjects: [], catalogTerminal, animateEnvironment: () => undefined };
}

/** Synchronous entry retained for tests and isolated model review. */
export function buildLongRoom(options: LongRoomBuildOptions = {}, _loader = new THREE.TextureLoader()): LongRoomBuilt {
  const steps=buildLongRoomSteps(options);
  let step=steps.next();
  while(!step.done) step=steps.next();
  return step.value;
}

/** Group cheap stages within an 8 ms task budget; expensive stages still yield immediately. */
export async function buildLongRoomProgressively(_loader: THREE.TextureLoader,
  signal: AbortSignal, onSlice: (milliseconds: number, stage: string) => void = () => undefined,
  options: LongRoomBuildOptions = {}): Promise<LongRoomBuilt> {
  const steps=buildLongRoomSteps(options);
  let stage = 0;
  let taskStart=performance.now();
  try {
    while(true) {
      signal.throwIfAborted();
      const start=performance.now();
      const step=steps.next();
      onSlice(performance.now()-start, (!step.done && step.value) || `construction-${stage}`);
      stage++;
      if(step.done) {
        step.value.root.userData.staticOptimization = await optimizeStaticMeshesProgressively(
          step.value.root, step.value.interactiveObjects, signal, (ms, phase) => onSlice(ms, phase));
        return step.value;
      }
      if(performance.now()-taskStart>=8) {
        await new Promise<void>(resolve => setTimeout(resolve,0));
        taskStart=performance.now();
      }
    }
  } finally {
    // Cancelling before rendering releases partially built CPU geometry and arrays.
    // No GPU resources have been allocated by the construction generator.
    steps.return(undefined as never);
  }
}
