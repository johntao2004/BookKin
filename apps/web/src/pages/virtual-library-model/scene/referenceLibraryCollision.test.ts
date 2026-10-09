import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { collectCameraColliders, markCameraCollider, resolveCameraCollision } from '../../virtual-library-collision';
import { WALKING_CAMERA_CLEARANCE, WALKING_EYE_HEIGHT, resolveGuidedStairCollision, isGuidedStairSupport } from '../../virtual-library-navigation';
import { REFERENCE_LIBRARY as R, referenceRouteLength, referenceRoutePoint } from '../hogwartsLibraryLayout';
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
    `${JSON.stringify({revision: '20261009-walk-clearance-r4', evidence: 'CPU geometry/collision regression; not browser or GPU acceptance',
      body: WALKING_CAMERA_CLEARANCE, eyeHeight: WALKING_EYE_HEIGHT, ...metrics}, null, 2)}\n`);
});

describe('live reference-library body clearance', () => {
  it('stops a standing visitor at both gallery rails, both aperture guards and both landing sides', () => {
    for (const side of [-1, 1]) for (const z of [-13.5, -8, 2, 12]) {
      const safe = resolveCameraCollision({x: side * 9.95, y: eyeY, z}, {x: side * 6, y: eyeY, z}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(Math.abs(safe.x), `${side}/${z}/${safe.blockedBy}`).toBeGreaterThan(8.8);
    }
    for (const side of [-1, 1]) for (const direction of [-1, 1]) {
      const x = side * 6.8;
      const safe = resolveCameraCollision({x, y: eyeY, z: -15.3}, {x: x + direction * 2, y: eyeY, z: -15.3}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(Math.abs(safe.x - x)).toBeLessThan(0.5);
    }
  });

  it('blocks outward motion at the tread height of every helical guard, including segment joins', () => {
    const guards = config.colliders.filter(c => c.shape === 'arc' && c.id.startsWith('stair-outer-guard-'));
    expect(guards).toHaveLength(60);
    metrics.helicalGuardRadialSamples = guards.length * 5;
    for (const guard of guards) {
      if (guard.shape !== 'arc') throw new Error('Expected arc');
      const segments = colliders.filter(c => c.id.startsWith(`${guard.id}-`));
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const angle = guard.startAngle + (guard.endAngle - guard.startAngle) * fraction;
        const point = (radius: number) => ({x: guard.center.x + Math.cos(angle) * radius,
          y: guard.center.y - guard.height / 2 + WALKING_EYE_HEIGHT,
          z: guard.center.z + Math.sin(angle) * radius});
        const safe = resolveCameraCollision(point(1.05), point(3.5), segments, WALKING_CAMERA_CLEARANCE);
        expect(safe.blocked, `${guard.id}/${fraction}`).toBe(true);
        expect(Math.hypot(safe.x - guard.center.x, safe.z - guard.center.z)).toBeLessThan(1.7);
      }
    }
  });

  it('does not walk through the twelve upper desks at standing eye height', () => {
    for (const desk of config.colliders.filter(c => c.id.startsWith('upper-desk-'))) {
      if (desk.shape !== 'box') throw new Error('Expected box');
      const direction = Math.sign(desk.center.x);
      const start = {x: desk.center.x - direction * 1.7, y: eyeY, z: desk.center.z};
      const end = {...start, x: desk.center.x + direction * 1.7};
      const safe = resolveCameraCollision(start, end, colliders, WALKING_CAMERA_CLEARANCE);
      expect(direction * (safe.x - desk.center.x), desk.id).toBeLessThan(-desk.size.x / 2 - 0.29);
    }
  });

  it('keeps both galleries usable with 45 cm of left/right offset, in both directions', () => {
    const failures: string[] = [];
    for (const side of [-1, 1]) for (const offset of [-0.45, 0, 0.45]) for (const direction of [-1, 1]) {
      const x = side * (10.1 + offset);
      let previous = {x, y: eyeY, z: -16.4 * direction};
      for (let step = 1; step <= 410; step++) {
        const desired = {x, y: eyeY, z: (-16.4 + step * 0.08) * direction};
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
    expect(cases).toHaveLength(28);
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
    const source = anchors.shelfSections[28];
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
    const stiles = colliders.filter(c => c.id.startsWith('case-stile--1-1--15-'));
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
      expect(Math.hypot(standing.x - previous.x, standing.y - previous.y, standing.z - previous.z)).toBeLessThan(0.001);
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
