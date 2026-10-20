import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { collectCameraColliders, markCameraCollider, resolveCameraCollision } from '../../virtual-library-collision';
import { WALKING_CAMERA_CLEARANCE, WALKING_EYE_HEIGHT, resolveGuidedStairCollision, isGuidedStairSupport } from '../../virtual-library-navigation';
import { REFERENCE_LIBRARY as R, REFERENCE_LIBRARY_ASSET_REVISION, referenceRouteLength, referenceRoutePoint } from '../hogwartsLibraryLayout';
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
    `${JSON.stringify({revision: REFERENCE_LIBRARY_ASSET_REVISION, evidence: 'CPU geometry/collision regression; not browser or GPU acceptance',
      body: WALKING_CAMERA_CLEARANCE, eyeHeight: WALKING_EYE_HEIGHT, ...metrics}, null, 2)}\n`);
});

describe('live reference-library body clearance', () => {
  it('blocks the closed B-end double door at its visible front face', () => {
    const door = config.colliders.find(c => c.id === 'end-b-central-door');
    expect(door?.shape).toBe('box');
    const safe = resolveCameraCollision({x: 0, y: WALKING_EYE_HEIGHT, z: 18},
      {x: 0, y: WALKING_EYE_HEIGHT, z: 20.5}, colliders, WALKING_CAMERA_CLEARANCE);
    expect(safe.blockedBy).toBe('end-b-central-door');
    expect(safe.z).toBeLessThan(19.2);
    expect(config.colliders.filter(c => c.id.startsWith('end-b-lower-panel-'))).toHaveLength(2);
  });

  it('keeps former end-arcade columns and heads clear while protecting rear pictures', () => {
    for (const x of [-8, -6.4, -4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8, 6.4, 8]) {
      const ground = resolveCameraCollision({x, y: WALKING_EYE_HEIGHT, z: -16},
        {x, y: WALKING_EYE_HEIGHT, z: -18.5}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(ground.blockedBy, `ground bay ${x}`).toBeNull();
      expect(ground.z).toBeCloseTo(-18.5);
      const head = resolveCameraCollision({x, y: 6.5, z: -16},
        {x, y: 6.5, z: -18.5}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(head.blockedBy, `former head ${x}`).toBeNull();
      expect(head.z).toBeCloseTo(-18.5);
    }
    for (const x of [-6.4, -3.2, 0, 3.2, 6.4]) {
      const picture = resolveCameraCollision({x, y: 2.76, z: -18.4},
        {x, y: 2.76, z: -19.8}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(picture.blockedBy).toBe(`end-a-lower-picture-${x}`);
      expect(picture.z).toBeGreaterThan(-19.2);
    }
  });

  it('clears retired balcony supports at body and head height while protecting wall panels', () => {
    for (const x of [-2.3, -1.15, 0, 1.15, 2.3]) {
      const opening = resolveCameraCollision({x, y: WALKING_EYE_HEIGHT, z: 14.6},
        {x, y: WALKING_EYE_HEIGHT, z: 16.5}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(opening.blockedBy).toBeNull();
      expect(opening.z).toBeCloseTo(16.5);
      // The unified balcony profile now has a 6.66 underside. Keep a full
      // camera-body clearance below it rather than flying inside the deck.
      const head = resolveCameraCollision({x, y: 6.3, z: 14.9},
        {x, y: 6.3, z: 16.5}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(head.blockedBy).toBeNull();
      expect(head.z).toBeCloseTo(16.5);
    }
    const ceiling = resolveCameraCollision({x: 0, y: 6.5, z: 14.9},
      {x: 0, y: 6.5, z: 16.5}, colliders, WALKING_CAMERA_CLEARANCE);
    expect(ceiling.blockedBy).toBe('balcony-floor');
    for (const x of [-5.5, 5.5]) {
      const panel = resolveCameraCollision({x, y: 3, z: 18.5},
        {x, y: 3, z: 20}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(panel.blockedBy).toBe(`end-b-lower-panel-${x}`);
      expect(panel.z).toBeLessThan(19.3);
    }
  });

  it('walks the window-side aisles on both floors and joins the end crosswalks', () => {
    const failures: string[] = [];
    for (const floorY of [0, R.galleryY]) for (const side of [-1, 1]) {
      for (const offset of [-0.5, 0, 0.5]) for (const direction of [-1, 1]) {
        const x = side * (18.0 + offset);
        let previous = {x, y: floorY + WALKING_EYE_HEIGHT, z: -18 * direction};
        for (let step = 1; step <= 450; step++) {
          const desired = {...previous, x, z: (-18 + 36 * step / 450) * direction};
          const safe = resolveCameraCollision(previous, desired, colliders, WALKING_CAMERA_CLEARANCE);
          if (Math.hypot(safe.x - desired.x, safe.y - desired.y, safe.z - desired.z) > 0.005) {
            failures.push(`${floorY}/${side}/${offset}/${direction}: ${safe.blockedBy}`);
            break;
          }
          previous = safe;
        }
      }
      for (const z of [-17.6, 17.25]) for (const direction of [-1, 1]) {
        const startX = direction > 0 ? 10.1 : 18.0;
        const endX = direction > 0 ? 18.0 : 10.1;
        let previous = {x: side * startX, y: floorY + WALKING_EYE_HEIGHT, z};
        for (let step = 1; step <= 80; step++) {
          const desired = {...previous, x: side * (startX + (endX - startX) * step / 80), z};
          const safe = resolveCameraCollision(previous, desired, colliders, WALKING_CAMERA_CLEARANCE);
          if (Math.hypot(safe.x - desired.x, safe.y - desired.y, safe.z - desired.z) > 0.005) {
            failures.push(`end-join/${floorY}/${side}/${z}/${direction}: ${safe.blockedBy}`);
            break;
          }
          previous = safe;
        }
      }
      const wall = resolveCameraCollision({x: side * 18.0, y: floorY + WALKING_EYE_HEIGHT, z: 2.5},
        {x: side * 20.5, y: floorY + WALKING_EYE_HEIGHT, z: 2.5}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(wall.blocked).toBe(true);
      expect(Math.abs(wall.x)).toBeLessThan(R.width / 2);
    }
    expect(failures).toEqual([]);
  });

  it('crosses both end corridors in both directions with a full standing body and 95 cm lane offsets', () => {
    const failures: string[] = [];
    for (const centerZ of [-17.6, 17.25]) for (const offset of [-0.95, 0, 0.95]) {
      for (const direction of [-1, 1]) {
        const z = centerZ + offset;
        let previous = {x: -10.1 * direction, y: eyeY, z};
        for (let step = 1; step <= 253; step++) {
          const desired = {x: (-10.1 + 20.2 * step / 253) * direction, y: eyeY, z};
          const safe = resolveCameraCollision(previous, desired, colliders, WALKING_CAMERA_CLEARANCE);
          if (Math.hypot(safe.x - desired.x, safe.y - desired.y, safe.z - desired.z) > 0.005) {
            failures.push(`${centerZ}/${offset}/${direction}/${desired.x.toFixed(2)}: ${safe.blockedBy}`);
            break;
          }
          previous = safe;
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('stops visitors before the visible portrait and blind-panel faces at both ends', () => {
    for (const [id, direction, y, limit] of [
      ['end-a-portrait-wall', -1, eyeY, 19.1],
      ['end-b-picture-wall', 1, R.sideVaultSpring + R.sideVaultRise, 19.475],
    ] as const) {
      expect(config.colliders.some(c => c.id === id)).toBe(true);
      for (const x of [-1.5, 0, 1.5]) {
        const safe = resolveCameraCollision(
          {x, y, z: direction * 18.6}, {x, y, z: direction * 20.5},
          colliders, WALKING_CAMERA_CLEARANCE,
        );
        expect(safe.blocked).toBe(true);
        expect(direction * safe.z, `${id}/${x}`).toBeLessThan(limit - 0.29);
      }
    }
  });

  it('guards exposed gallery edges and joins both landings to the extended center deck', () => {
    for (const side of [-1, 1]) for (const z of [-12.5, -8, 2, 12]) {
      const safe = resolveCameraCollision({x: side * 9.95, y: eyeY, z}, {x: side * 6, y: eyeY, z}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(Math.abs(safe.x), `${side}/${z}/${safe.blockedBy}`).toBeGreaterThan(8.8);
    }
    for (const side of [-1, 1]) {
      const x = side * 4.6;
      const safe = resolveCameraCollision({x, y: eyeY, z: -15.3}, {x: x - side * 2, y: eyeY, z: -15.3}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(safe.blockedBy).toBeNull();
      expect(safe.x).toBeCloseTo(x - side * 2);
      const edge = resolveCameraCollision({x: side * 8, y: eyeY, z: -14.65}, {x: side * 8, y: eyeY, z: -12.5}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(edge.blocked).toBe(true);
      expect(edge.z).toBeLessThan(-13.9);
    }
  });

  it('protects the new front edge while keeping its supported crosswalk open', () => {
    for (const x of [-3, 0, 3]) {
      const safe = resolveCameraCollision({x, y: eyeY, z: -14.5}, {x, y: eyeY, z: -12.5}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(safe.blocked).toBe(true);
      expect(safe.z).toBeLessThan(-13.9);
    }
    for (const z of [-15.2, -14.4]) {
      const safe = resolveCameraCollision({x: -4.6, y: eyeY, z}, {x: 4.6, y: eyeY, z}, colliders, WALKING_CAMERA_CLEARANCE);
      expect(safe.blockedBy).toBe('globe');
    }
    // The portrait-side passage behind the globe remains wide enough to cross.
    const rear = resolveCameraCollision({x: -4.6, y: eyeY, z: -16.7}, {x: 4.6, y: eyeY, z: -16.7}, colliders, WALKING_CAMERA_CLEARANCE);
    expect(rear.blockedBy).toBeNull();
    expect(rear.x).toBeCloseTo(4.6);
  });

  it('blocks inward and outward motion through both helical guards, including segment joins', () => {
    const guards = config.colliders.filter(c => c.shape === 'arc' && /^stair-(outer|inner)-guard-/.test(c.id));
    const treads = config.colliders.filter(c => c.id.startsWith('stair-tread-'));
    expect(treads).toHaveLength(80);
    expect(guards).toHaveLength(160);
    for (const side of [-1, 1]) {
      for (const edge of ['outer', 'inner']) {
        expect(guards.filter(c => c.id.startsWith(`stair-${edge}-guard-${side}-`))).toHaveLength(40);
      }
    }
    metrics.helicalGuardRadialSamples = guards.length * 5;
    for (const guard of guards) {
      if (guard.shape !== 'arc') throw new Error('Expected arc');
      const segments = colliders.filter(c => c.id.startsWith(`${guard.id}-`));
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const angle = guard.startAngle + (guard.endAngle - guard.startAngle) * fraction;
        const point = (radius: number) => ({x: guard.center.x + Math.cos(angle) * radius,
          y: guard.center.y - guard.height / 2 + WALKING_EYE_HEIGHT,
          z: guard.center.z + Math.sin(angle) * radius});
        const outer = guard.id.startsWith('stair-outer-');
        const safe = resolveCameraCollision(point(1.3), point(outer ? 3.5 : 0.05), segments, WALKING_CAMERA_CLEARANCE);
        expect(safe.blocked, `${guard.id}/${fraction}`).toBe(true);
        const radius = Math.hypot(safe.x - guard.center.x, safe.z - guard.center.z);
        if (outer) expect(radius).toBeLessThan(1.7);
        else expect(radius).toBeGreaterThan(0.6);
      }
    }
  });

  it('leaves the former shelf-front furniture footprints free of invisible obstacles', () => {
    expect(config.colliders.filter(c => /^(upper-desk-|upper-chair-|lectern-)/.test(c.id))).toEqual([]);
    for (const side of [-1, 1]) for (const z of [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]) {
      const start = {x: side * 12.85, y: eyeY, z: z - 0.4};
      const end = {...start, z: z + 0.4};
      const safe = resolveCameraCollision(start, end, colliders, WALKING_CAMERA_CLEARANCE);
      expect(safe.blockedBy, `${side}/${z}`).toBeNull();
      expect(safe.z).toBeCloseTo(end.z, 5);
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
    const targetBoxes: THREE.Box3[] = [];
    for (const book of world.sceneBooks) {
      book.group.updateWorldMatrix(true, true);
      const targetBox = new THREE.Box3().setFromObject(book.hitTarget);
      targetBoxes.push(targetBox); targets.union(targetBox);
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
    // Binding thickness now varies, so assert physical disjoint hit lanes and
    // the original reserved envelope rather than twenty identical .16 targets.
    targetBoxes.sort((a, b) => a.min.x - b.min.x);
    for (let i = 1; i < targetBoxes.length; i++)
      expect(targetBoxes[i].min.x - targetBoxes[i - 1].max.x).toBeCloseTo(0.004, 5);
    expect(targets.max.x - targets.min.x).toBeLessThan(3.276);
    expect(targets.max.x - targets.min.x).toBeCloseTo(
      targetBoxes.reduce((total, box) => total + box.max.x - box.min.x, 0) + 19 * 0.004, 5);
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
