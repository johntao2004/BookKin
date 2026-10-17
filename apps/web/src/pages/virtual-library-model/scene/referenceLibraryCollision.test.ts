import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { collectCameraColliders, markCameraCollider, resolveCameraCollision } from '../../virtual-library-collision';
import { WALKING_CAMERA_CLEARANCE, WALKING_EYE_HEIGHT, resolveGuidedStairCollision, isGuidedStairSupport } from '../../virtual-library-navigation';
import { NARROW_HALL, REFERENCE_LIBRARY as R, referenceRouteLength, referenceRoutePoint } from '../hogwartsLibraryLayout';
import { referenceCameraColliderDescriptors, validateReferenceConfig, createReferenceCatalogAnchors } from './referenceLibrary';

import { demoBooks } from '../../../data/demo';
import { createVirtualLibraryWorld, disposeScene } from '../../virtual-library-scene';
import type { LibraryMaterials } from './materials';

const config: unknown = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));
validateReferenceConfig(config);
const root = new THREE.Group();
for (const collider of referenceCameraColliderDescriptors(config)) markCameraCollider(root, collider);
const colliders = collectCameraColliders(root, 'hall');
const eyeY = R.galleryY + WALKING_EYE_HEIGHT;
const stairObstacles = colliders.filter(c => !isGuidedStairSupport(c));
const metrics: Record<string, number> = {descriptorCount: config.colliders.length, runtimeColliderCount: colliders.length,
  maximumStairDrift: 0, maximumOffsetStairDrift: 0, maximumClearGalleryDrift: 0};
afterAll(() => {
  if (process.env.BOOKKIN_COLLISION_REPORT) writeFileSync(process.env.BOOKKIN_COLLISION_REPORT,
    `${JSON.stringify({revision: NARROW_HALL.revision, evidence: 'CPU geometry/collision regression; not browser or GPU acceptance',
      body: WALKING_CAMERA_CLEARANCE, eyeHeight: WALKING_EYE_HEIGHT, ...metrics}, null, 2)}\n`);
});

describe('live reference-library body clearance', () => {
  it('stops a standing visitor at both gallery rails and both outer walls', () => {
    for (const side of [-1, 1]) for (const z of [-12, -2, 4, 12]) {
      const safe = resolveCameraCollision(
        {x: side * NARROW_HALL.galleryWalkX, y: eyeY, z},
        {x: side * 0.4, y: eyeY, z},
        colliders, WALKING_CAMERA_CLEARANCE);
      expect(Math.abs(safe.x), `${side}/${z}/${safe.blockedBy}`).toBeGreaterThan(2.05);
      const wall = resolveCameraCollision(
        {x: side * 6.2, y: WALKING_EYE_HEIGHT, z},
        {x: side * 9, y: WALKING_EYE_HEIGHT, z},
        colliders, WALKING_CAMERA_CLEARANCE);
      expect(Math.abs(wall.x), wall.blockedBy ?? '').toBeLessThan(7.7);
    }
  });

  it('keeps both stair poles and wall rails off the walking helix', () => {
    for (const name of ['left', 'right'] as const) {
      const pole = config.colliders.find(c => c.id === `stair-pole-${name}`);
      const rail = config.colliders.find(c => c.id === `stair-outer-rail-${name}`);
      expect(pole?.shape).toBe('box');
      expect(rail?.shape).toBe('box');
      if (pole?.shape !== 'box' || rail?.shape !== 'box') continue;
      for (const point of config.stairRoutes[name]) {
        expect(Math.hypot(point.x - pole.center.x, point.z - pole.center.z)).toBeGreaterThan(0.45);
      }
      const outward = {x: rail.center.x + Math.sign(rail.center.x) * 1.2, y: WALKING_EYE_HEIGHT, z: rail.center.z};
      const inward = {x: rail.center.x - Math.sign(rail.center.x) * 1.2, y: WALKING_EYE_HEIGHT, z: rail.center.z};
      const safe = resolveCameraCollision(outward, inward, colliders, WALKING_CAMERA_CLEARANCE);
      expect(Math.abs(safe.x), rail.id).toBeGreaterThan(Math.abs(rail.center.x) - rail.size.x / 2 - 0.05);
    }
  });

  it('does not walk through the three reading tables at standing eye height', () => {
    const tables = config.colliders.filter(c => c.id.startsWith('reading-table-'));
    expect(tables).toHaveLength(3);
    for (const table of tables) {
      if (table.shape !== 'box') throw new Error('Expected box');
      const start = {x: table.center.x, y: WALKING_EYE_HEIGHT, z: table.center.z - 1.8};
      const end = {...start, z: table.center.z + 1.8};
      const safe = resolveCameraCollision(start, end, colliders, WALKING_CAMERA_CLEARANCE);
      expect(safe.z, table.id).toBeLessThan(table.center.z - table.size.z / 2 - 0.29);
    }
  });

  it('keeps both galleries usable with a small lateral offset, in both directions', () => {
    const failures: string[] = [];
    const zStart = -17;
    const steps = 390;
    for (const side of [-1, 1]) for (const offset of [-0.08, 0, 0.08]) for (const direction of [-1, 1]) {
      const x = side * (NARROW_HALL.galleryWalkX + offset);
      let previous = {x, y: eyeY, z: direction < 0 ? zStart + steps * 0.08 : zStart};
      for (let step = 1; step <= steps; step++) {
        const desired = {x, y: eyeY, z: direction < 0 ? previous.z - 0.08 : zStart + step * 0.08};
        const safe = resolveCameraCollision(previous, desired, colliders, WALKING_CAMERA_CLEARANCE);
        metrics.maximumClearGalleryDrift = Math.max(metrics.maximumClearGalleryDrift,
          Math.hypot(safe.x - desired.x, safe.y - desired.y, safe.z - desired.z));
        if (Math.hypot(safe.x - desired.x, safe.y - desired.y, safe.z - desired.z) > 0.02)
          failures.push(`${side}/${offset}/${direction}/${desired.z.toFixed(2)}: ${safe.blockedBy}`);
        previous = safe;
      }
    }
    expect(failures).toEqual([]);
  });

  it('walks both exported spiral routes up and down with full body height', () => {
    const failures = new Map<string, number>();
    for (const [side, original] of Object.entries(config.stairRoutes)) for (const reverse of [false, true]) {
      const route = reverse ? [...original].reverse() : original;
      const length = referenceRouteLength(route);
      let previous = {...route[0], y: route[0].y + WALKING_EYE_HEIGHT};
      for (let distance = 0; distance <= length + 0.08; distance += 0.08) {
        const point = referenceRoutePoint(route, distance);
        const desired = {...point, y: point.y + WALKING_EYE_HEIGHT};
        const safe = resolveGuidedStairCollision(previous, desired, colliders, stairObstacles, desired);
        const drift = Math.hypot(safe.x - desired.x, safe.y - desired.y, safe.z - desired.z);
        metrics.maximumStairDrift = Math.max(metrics.maximumStairDrift, drift);
        if (drift > 0.09) {
          const key = `${side}/${reverse}/${safe.blockedBy}`;
          failures.set(key, Math.max(failures.get(key) ?? 0, drift));
        }
        previous = safe;
      }
    }
    expect(Object.fromEntries(failures)).toEqual({});
  });

  it('stops at each cabinet face before the eye reaches shelf boards, in both levels and directions', () => {
    const cases = colliders.filter(c => c.id.startsWith('case-back-'));
    expect(cases).toHaveLength(32);
    for (const cabinet of cases) {
      if (cabinet.shape !== 'box') throw new Error('Expected box');
      for (const direction of [-1, 1]) {
        const y = cabinet.y;
        const start = {x: cabinet.x, y, z: cabinet.z + direction * 1.5};
        const desired = {...start, z: cabinet.z - direction * 1.5};
        const safe = resolveCameraCollision(start, desired, [cabinet]);
        expect(direction * (safe.z - cabinet.z), cabinet.id).toBeGreaterThanOrEqual(R.shelfFrontOffset + 0.3);
      }
    }
  });
});


it('keeps a full twenty-book upper row, including binding details, inside both solid stiles', () => {
  const context = new Proxy({}, {get: (_, property) => property === 'createLinearGradient' || property === 'createRadialGradient'
    ? () => ({addColorStop: () => undefined}) : () => undefined, set: () => true}) as CanvasRenderingContext2D;
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
  const textureSpy = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => new THREE.Texture());
  const scene = new THREE.Scene();
  try {
    const anchors = createReferenceCatalogAnchors();
    const source = anchors.shelfSections.find(section => section.baseY === R.galleryY);
    if (!source) throw new Error('Expected an upper shelf');
    const section = {...source, id: 0};
    const slots = anchors.catalogSlots.filter(slot => slot.sectionId === source.id)
      .map(slot => ({...slot, sectionId: 0, catalogSectionIndex: 0}));
    const root = new THREE.Group(); root.userData.streamingArchitecture = true;
    const material = new THREE.MeshStandardMaterial();
    const names = ['stone', 'stoneDark', 'wood', 'woodDark', 'woodWarm', 'floor', 'rug', 'brass', 'iron', 'leather', 'parchment', 'glass', 'lampGlass'];
    const materials = Object.fromEntries(names.map(name => [name, material])) as unknown as LibraryMaterials;
    const world = createVirtualLibraryWorld(scene, new THREE.TextureLoader(), 1, {root, materials,
      shelfSections: [section], catalogSlots: slots, interactiveObjects: [], catalogTerminal: new THREE.Group(), animateEnvironment: () => undefined});
    const books = Array.from({length: 20}, (_, index) => ({...demoBooks[0], id: `full-upper-row-${index}`}));
    world.syncCatalogBooks(books);
    expect(world.sceneBooks).toHaveLength(20);
    expect(new Set(world.sceneBooks.map(book => book.shelfRowIndex))).toEqual(new Set([0]));
    const visible = new THREE.Box3();
    const targets = new THREE.Box3();
    for (const book of world.sceneBooks) {
      book.group.updateWorldMatrix(true, true);
      targets.union(new THREE.Box3().setFromObject(book.hitTarget));
      book.group.traverse(object => {
        if (object instanceof THREE.Mesh && !object.userData.isVirtualBookHitTarget)
          visible.union(new THREE.Box3().setFromObject(object));
      });
    }
    // Compare to the conservative exported stile collision, not only nominal
    // case width; full rows previously clipped their inner faces.
    const stiles = colliders.filter(c => c.id.startsWith(`case-stile-${source.slotPrefix}-`));
    expect(stiles).toHaveLength(2);
    if (stiles[0].shape !== 'box' || stiles[1].shape !== 'box') throw new Error('Expected stiles');
    stiles.sort((a, b) => a.x - b.x);
    if (stiles[0].shape !== 'box' || stiles[1].shape !== 'box') throw new Error('Expected stiles');
    const insideMin = stiles[0].x + stiles[0].halfX;
    const insideMax = stiles[1].x - stiles[1].halfX;
    metrics.renderedTwentyBookWidth = visible.max.x - visible.min.x;
    metrics.twentyBookTargetWidth = targets.max.x - targets.min.x;
    metrics.minimumRenderedBookStileClearance = Math.min(visible.min.x - insideMin, insideMax - visible.max.x);
    metrics.minimumBookTargetStileClearance = Math.min(targets.min.x - insideMin, insideMax - targets.max.x);
    expect(visible.max.x - visible.min.x).toBeLessThan(3.28);
    expect(targets.max.x - targets.min.x).toBeCloseTo(3.276, 5);
    expect(targets.min.x - insideMin).toBeGreaterThan(0.01);
    expect(insideMax - targets.max.x).toBeGreaterThan(0.01);
    expect(visible.min.x - insideMin).toBeGreaterThan(0.01);
    expect(insideMax - visible.max.x).toBeGreaterThan(0.01);
  } finally {disposeScene(scene); textureSpy.mockRestore(); spy.mockRestore();}
});


it('uses full body collision for stair departures, vertical flight and large jumps', () => {
  for (const route of Object.values(config.stairRoutes)) {
    for (const distance of [1, 4, 7, referenceRouteLength(route) - 1]) {
      const point = referenceRoutePoint(route, distance);
      const eye = {...point, y: point.y + WALKING_EYE_HEIGHT};
      for (const delta of [{x: 0.4, y: 0, z: 0}, {x: 0, y: -2, z: 0}, {x: 3, y: 0, z: 3}]) {
        const desired = {x: eye.x + delta.x, y: eye.y + delta.y, z: eye.z + delta.z};
        expect(resolveGuidedStairCollision(eye, desired, colliders, stairObstacles, eye))
          .toEqual(resolveCameraCollision(eye, desired, colliders, WALKING_CAMERA_CLEARANCE));
      }
    }
  }
});

it('retains supported stair travel with small lateral offsets and clean exits/re-entry in both directions', () => {
  for (const original of Object.values(config.stairRoutes)) for (const reverse of [false, true]) {
    const route = reverse ? [...original].reverse() : original;
    const length = referenceRouteLength(route);
    for (const offset of [-0.08, 0.08]) {
      let previous = {...route[0], x: route[0].x + offset, y: route[0].y + WALKING_EYE_HEIGHT};
      let maximumDrift = 0;
      let maximumDriftHit = '';
      for (let distance = 0; distance <= length + 0.08; distance += 0.08) {
        const point = referenceRoutePoint(route, distance);
        const supportedEye = {...point, y: point.y + WALKING_EYE_HEIGHT};
        const desired = {...supportedEye, x: supportedEye.x + offset};
        const safe = resolveGuidedStairCollision(previous, desired, colliders, stairObstacles, supportedEye);
        const drift = Math.hypot(safe.x - desired.x, safe.y - desired.y, safe.z - desired.z);
        if (drift > 0.02 && !maximumDriftHit) maximumDriftHit = `${reverse}/${offset}/${distance.toFixed(2)}/${safe.blockedBy}/${JSON.stringify(desired)}/${JSON.stringify(safe)}`;
        maximumDrift = Math.max(maximumDrift, drift);
        previous = safe;
      }
      metrics.maximumOffsetStairDrift = Math.max(metrics.maximumOffsetStairDrift, maximumDrift);
      expect(maximumDrift, maximumDriftHit).toBeLessThan(0.09);
      const standing = resolveCameraCollision(previous, previous, colliders, WALKING_CAMERA_CLEARANCE);
      expect(Math.hypot(standing.x - previous.x, standing.y - previous.y, standing.z - previous.z),
        `${reverse}/${offset}/${standing.blockedBy}/${JSON.stringify(previous)}`).toBeLessThan(0.001);
    }
  }
});

it('keeps repeated large diagonal flight steps outside solids without recovery drift', () => {
  let seed = 20261009;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  metrics.largeDiagonalFlightSteps = 160;
  let previous = {x: 3, y: WALKING_EYE_HEIGHT, z: 15};
  for (let step = 0; step < 160; step++) {
    const desired = {x: (random() - 0.5) * 28, y: WALKING_EYE_HEIGHT + random() * 9, z: (random() - 0.5) * 34};
    const safe = resolveCameraCollision(previous, desired, colliders, WALKING_CAMERA_CLEARANCE);
    const settled = resolveCameraCollision(safe, safe, colliders, WALKING_CAMERA_CLEARANCE);
    expect([safe.x, safe.y, safe.z].every(Number.isFinite)).toBe(true);
    expect(Math.hypot(settled.x - safe.x, settled.y - safe.y, settled.z - safe.z), `step ${step}/${safe.blockedBy}`).toBeLessThan(0.001);
    previous = safe;
  }
});
