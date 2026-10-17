import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { collectCameraColliders, markCameraCollider, resolveCameraCollision } from '../../virtual-library-collision';
import { demoBooks } from '../../../data/demo';
import { createVirtualLibraryWorld, disposeScene, getShelvedBookTransform, SHELF_PLAQUE_MOUNT } from '../../virtual-library-scene';
import { NARROW_HALL, REFERENCE_BAY_BOUNDARIES, REFERENCE_LIBRARY as R, REFERENCE_BOOK_CENTER_OFFSET, referenceLibraryRoofY, referenceRouteLength, referenceRoutePoint } from '../hogwartsLibraryLayout';
import { createReferenceCatalogAnchors, validateReferenceConfig, type ReferenceSceneConfig } from './referenceLibrary';
import type { LibraryMaterials } from './materials';

function config(): ReferenceSceneConfig {
  return {
    version: 1, scaleNote: 'Project estimates',
    dimensions: {width: R.width, length: R.length, galleryY: R.galleryY, vaultCrownY: R.height},
    colliders: [{id: 'wall', shape: 'box', center: {x: 12, y: 6, z: 0}, size: {x: 0.3, y: 12, z: 36}}],
    stairRoutes: {left: [{x: -4, y: 0, z: -12}, {x: -6, y: 6.2, z: -15}],
      right: [{x: 4, y: 0, z: -12}, {x: 6, y: 6.2, z: -15}]},
    cameras: [], omissions: [],
    lighting: {exposure: 1.1, hemisphere: {sky: 'white', ground: 'black', intensity: 1},
      ambient: {color: 'white', intensity: 0.4}, directional: [], points: []},
  };
}

describe('reference-library architecture integration', () => {
  it('loads the generated model config and walks both spiral routes without collision drift', () => {
    const actual: unknown = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));
    validateReferenceConfig(actual);
    const root = new THREE.Group();
    for (const collider of actual.colliders) markCameraCollider(root, collider);
    const colliders = collectCameraColliders(root, 'hall');
    const failures = new Map<string, {firstDistance: number; maxDrift: number}>();
    for (const [side, original] of Object.entries(actual.stairRoutes)) for (const reverse of [false, true]) {
      const route = reverse ? [...original].reverse() : original;
      const length = referenceRouteLength(route);
      let previous = {...route[0], y: route[0].y + 1.78};
      for (let distance = 0; distance <= length; distance += 0.08) {
        const point = referenceRoutePoint(route, distance);
        const eye = {...point, y: point.y + 1.78};
        const safe = resolveCameraCollision(previous, eye, colliders);
        const drift = Math.hypot(safe.x - eye.x, safe.y - eye.y, safe.z - eye.z);
        if (drift >= 0.09) {
          const key = `${side}/${reverse ? 'down' : 'up'}:${safe.blockedBy}`;
          const current = failures.get(key) ?? {firstDistance: Number(distance.toFixed(2)), maxDrift: 0};
          current.maxDrift = Number(Math.max(current.maxDrift, drift).toFixed(3)); failures.set(key, current);
        }
        previous = safe;
      }
    }
    expect(Object.fromEntries(failures)).toEqual({});
  });
  it('keeps both gallery walks clear and the aisle rail closed', () => {
    const actual: unknown = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));
    validateReferenceConfig(actual);
    const root = new THREE.Group();
    for (const collider of actual.colliders) markCameraCollider(root, collider);
    const colliders = collectCameraColliders(root, 'hall');
    const failures: string[] = [];
    const eyeY = R.galleryY + 1.78;
    for (const side of [-1, 1]) {
      let previous = {x: side * NARROW_HALL.galleryWalkX, y: eyeY, z: -17};
      for (let step = 1; step <= 390; step++) {
        const eye = {x: side * NARROW_HALL.galleryWalkX, y: eyeY, z: -17 + step * 0.08};
        const safe = resolveCameraCollision(previous, eye, colliders);
        const drift = Math.hypot(safe.x - eye.x, safe.y - eye.y, safe.z - eye.z);
        if (drift > 0.05) failures.push(`${side}/${eye.z.toFixed(2)}: ${safe.blockedBy}`);
        previous = safe;
      }
      const blocked = resolveCameraCollision(
        {x: side * NARROW_HALL.galleryWalkX, y: eyeY, z: 0},
        {x: side * 0.4, y: eyeY, z: 0},
        colliders,
      );
      expect(Math.abs(blocked.x)).toBeGreaterThan(2.05);
    }
    expect(failures).toEqual([]);
  });

  it('leaves a walk-through in the north iron gate and blocks the bars', () => {
    const actual: unknown = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));
    validateReferenceConfig(actual);
    const root = new THREE.Group();
    for (const collider of actual.colliders) markCameraCollider(root, collider);
    const colliders = collectCameraColliders(root, 'hall');
    const open = resolveCameraCollision(
      {x: 0, y: 1.78, z: NARROW_HALL.gateZ - 1.2},
      {x: 0, y: 1.78, z: NARROW_HALL.gateZ + 1.2},
      colliders,
    );
    expect(Math.abs(open.z - (NARROW_HALL.gateZ + 1.2))).toBeLessThan(0.05);
    const barred = resolveCameraCollision(
      {x: 1.2, y: 1.78, z: NARROW_HALL.gateZ - 1.2},
      {x: 1.2, y: 1.78, z: NARROW_HALL.gateZ + 1.2},
      colliders,
    );
    expect(barred.blocked).toBe(true);
    expect(barred.z).toBeLessThan(NARROW_HALL.gateZ);
  });

  it('keeps the three reading tables in the aisle and out of the gallery walk', () => {
    const actual: unknown = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));
    validateReferenceConfig(actual);
    const tables = actual.colliders.filter(c => c.id.startsWith('reading-table-'));
    expect(tables).toHaveLength(3);
    for (const table of tables) {
      expect(table.shape).toBe('box');
      if (table.shape !== 'box') continue;
      expect(Math.abs(table.center.x) + table.size.x / 2).toBeLessThan(NARROW_HALL.aisleHalfWidth);
      expect(Math.abs(table.center.x) + table.size.x / 2).toBeLessThan(NARROW_HALL.galleryWalkX - 0.4);
      expect(table.center.y + table.size.y / 2).toBeLessThan(R.galleryY);
    }
  });

  it('defines two levels with unique stable shelf addresses and no decorative books', () => {
    const {shelfSections, catalogSlots} = createReferenceCatalogAnchors();
    expect(shelfSections).toHaveLength(64);
    expect(catalogSlots).toHaveLength(64 * 120);
    expect(new Set(catalogSlots.map(slot => slot.slotId)).size).toBe(catalogSlots.length);
    expect(new Set(shelfSections.map(section => section.baseY))).toEqual(new Set([0, R.galleryY]));
    expect(R).toMatchObject({width: 16, length: 40, height: 11.2, galleryY: 4});
    expect(shelfSections[0].centerZ).toBe(REFERENCE_BAY_BOUNDARIES[0]);
    expect(shelfSections[0].centerX).toBeGreaterThan(0);
    expect(shelfSections[0].width).toBeCloseTo(R.caseOuterX - R.lowerCaseInnerX);
    expect(shelfSections.find(section => section.baseY === R.galleryY)?.width).toBeCloseTo(R.upperCaseOuterX - R.upperCaseInnerX);
    expect(catalogSlots.some(slot => slot.position.y > R.galleryY)).toBe(true);
    for (const section of shelfSections) {
      expect(section.plaquePlacement).toBe('shelf-front');
      expect(section.width).toBeGreaterThan(20 * 0.16 + 19 * 0.004);
    }
  });

  it('rests real books on the Blender shelf-board contract with headroom', () => {
    const actual = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));
    expect(actual.shelves.lower.xMin).toBe(R.lowerCaseInnerX);
    expect(actual.shelves.lower.xMax).toBe(R.caseOuterX);
    expect(actual.shelves.upper.xMin).toBe(R.upperCaseInnerX);
    expect(actual.shelves.upper.xMax).toBe(R.upperCaseOuterX);
    expect(actual.shelves.boardThickness).toBe(R.shelfBoardThickness);
    expect(actual.shelves.backThickness).toBe(R.shelfBackThickness);
    expect(actual.shelves.lower.baseY).toBe(R.lowerShelfBase);
    expect(actual.shelves.upper.baseY).toBe(R.upperShelfBase);
    expect(REFERENCE_BOOK_CENTER_OFFSET - R.book.coverWidth * 0.96 / 2).toBeGreaterThan(R.shelfBackThickness / 2);
    expect(REFERENCE_BOOK_CENTER_OFFSET + R.book.coverWidth * 0.96 / 2).toBeLessThan(R.shelfFrontOffset);
    const {catalogSlots} = createReferenceCatalogAnchors();
    for (const slot of catalogSlots) {
      const upper = slot.position.y > R.galleryY;
      const base = upper ? R.upperShelfBase : R.lowerShelfBase;
      const pitch = upper ? R.upperShelfPitch : R.lowerShelfPitch;
      const boardY = base + slot.rowIndex * pitch;
      expect(slot.position.y - slot.scale.y / 2).toBeCloseTo(boardY + R.shelfBoardThickness / 2);
      expect(slot.position.y + slot.scale.y / 2).toBeLessThan(boardY + pitch - R.shelfBoardThickness / 2);
      const transform = getShelvedBookTransform(slot, {width: 0.66, height: 1, depth: 0.1});
      expect(transform.scale.toArray().every(value => Number.isFinite(value) && value > 0)).toBe(true);
    }
  });

  it('uses one barrel vault above the gallery cases', () => {
    expect(referenceLibraryRoofY(0)).toBe(R.height);
    expect(referenceLibraryRoofY(R.width / 2)).toBe(R.vaultSpring);
    for (let x = -R.width / 2; x <= R.width / 2; x += 0.25) {
      expect(Number.isFinite(referenceLibraryRoofY(x, -12))).toBe(true);
      expect(referenceLibraryRoofY(x, 8)).toBeGreaterThan(R.galleryY + R.upperCaseHeight);
      expect(referenceLibraryRoofY(x, 8)).toBe(referenceLibraryRoofY(x, -8));
    }
  });

  it('starts warm, local, and under the triangle budget', () => {
    const config = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));
    const manifest = JSON.parse(readFileSync('public/assets/hogwarts-library/library-manifest.json', 'utf8'));
    expect(config.lighting.exposure).toBeGreaterThanOrEqual(0.7);
    expect(config.lighting.exposure).toBeLessThanOrEqual(0.9);
    expect(config.lighting.points).toHaveLength(3);
    expect(config.lighting.points.every((point: {distance: number; color: string}) =>
      point.distance >= 4 && point.distance <= 6 && point.color.toLowerCase() === '#ffb15a')).toBe(true);
    expect(config.lighting.directional[0].intensity).toBeLessThan(0.6);
    const triangles = manifest.chunks.reduce((sum: number, chunk: {triangles: number}) => sum + chunk.triangles, 0);
    expect(triangles).toBeLessThan(400_000);
    expect(manifest.chunks.filter((chunk: {core: boolean; startup: boolean}) => chunk.core || chunk.startup)
      .map((chunk: {id: string}) => chunk.id)).toEqual(['entrance']);
    expect(config.omissions.join(' ')).toMatch(/filler|decorative/i);
  });

  it('validates collider and route data before creating a scene', () => {
    expect(() => validateReferenceConfig(config())).not.toThrow();
    const duplicate = config(); duplicate.colliders.push(duplicate.colliders[0]);
    expect(() => validateReferenceConfig(duplicate)).toThrow('标识');
    const invalid = config(); invalid.stairRoutes.left[1].y = NaN;
    expect(() => validateReferenceConfig(invalid)).toThrow('楼梯路径');
  });

  it('interpolates a stair in either direction without an end discontinuity', () => {
    const route = [{x: 0, y: 0, z: 0}, {x: 0, y: 1, z: 1}, {x: 1, y: 2, z: 1}];
    const length = referenceRouteLength(route);
    expect(length).toBeCloseTo(Math.sqrt(2) * 2);
    expect(referenceRoutePoint(route, -1)).toEqual(route[0]);
    expect(referenceRoutePoint(route, length + 2)).toEqual(route[2]);
    expect(referenceRoutePoint([...route].reverse(), length / 4).y)
      .toBeCloseTo(referenceRoutePoint(route, length * 3 / 4).y);
  });

  it('preserves one-to-one catalog identity, category synchronization and exact restore transforms', () => {
    const context = new Proxy({}, {get: (_, property) => property === 'createLinearGradient' || property === 'createRadialGradient'
      ? () => ({addColorStop: () => undefined}) : () => undefined, set: () => true}) as CanvasRenderingContext2D;
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
    const scene = new THREE.Scene();
    try {
      const root = new THREE.Group(); root.userData.streamingArchitecture = true;
      const material = new THREE.MeshStandardMaterial();
      const chunk = new THREE.Group();
      const ownedMeshes = [0, 1].map(() => new THREE.Mesh(new THREE.BoxGeometry(), material));
      chunk.add(...ownedMeshes); root.add(chunk);
      const names = ['stone', 'stoneDark', 'wood', 'woodDark', 'woodWarm', 'floor', 'rug', 'brass', 'iron', 'leather', 'parchment', 'glass', 'lampGlass'];
      const materials = Object.fromEntries(names.map(name => [name, material])) as unknown as LibraryMaterials;
      const built = {root, materials, ...createReferenceCatalogAnchors(), interactiveObjects: [],
        catalogTerminal: new THREE.Group(), animateEnvironment: () => undefined};
      const world = createVirtualLibraryWorld(scene, new THREE.TextureLoader(), 1, built);
      // Legacy global batching must never steal controller-owned chunk meshes.
      expect(ownedMeshes.every(mesh => mesh.parent === chunk)).toBe(true);
      scene.updateMatrixWorld(true);
      scene.traverse(object => {
        if (object.userData.placement !== 'shelf-front') return;
        const section = built.shelfSections.find(item => item.id === object.userData.sectionId)!;
        const position = object.getWorldPosition(new THREE.Vector3());
        const face = -Math.sin(section.angle);
        const rearFaceDepth = face * (position.z - section.centerZ!) - SHELF_PLAQUE_MOUNT.backingDepth / 2;
        expect(rearFaceDepth).toBeGreaterThanOrEqual(R.categoryPlaqueFrontOffset + SHELF_PLAQUE_MOUNT.gap - 0.000001);
      });
      expect(world.sceneBooks).toHaveLength(0);
      world.syncCatalogBooks(demoBooks.slice(0, 4));
      expect(world.sceneBooks).toHaveLength(4);
      const southBay = REFERENCE_BAY_BOUNDARIES[0];
      for (const sceneBook of world.sceneBooks) {
        expect(Math.abs(sceneBook.shelfPosition.z - southBay)).toBeLessThan(1);
        expect(sceneBook.shelfPosition.y).toBeLessThan(R.galleryY);
      }
      expect(new Set(world.sceneBooks.map(book => book.group.userData.bookId)).size).toBe(4);
      expect(world.sceneBooks.every(book => typeof book.group.userData.slotId === 'string')).toBe(true);
      const book = world.sceneBooks[0];
      const before = book.shelfPosition.clone();
      world.toggleShelfSection(book.shelfSectionId);
      world.collapseShelfSections();
      expect(book.group.position.equals(before)).toBe(true);
      world.syncCatalogBooks(demoBooks.slice(1, 4));
      expect(world.sceneBooks.map(item => item.book.id)).not.toContain(demoBooks[0].id);
      world.syncCatalogBooks([]);
      expect(world.sceneBooks).toHaveLength(0);
      expect(world.interactiveMeshes).toHaveLength(0);
    } finally {disposeScene(scene); spy.mockRestore();}
  });
});
