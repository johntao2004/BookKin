// 验证扩宽后的书架、外侧通道与端廊连通，同时阻止越过连续外墙。
// Checks expanded shelves, outer-aisle/end-crosswalk connectivity and continuous outer-wall containment.
/**
 * Regression guard for contract "20261019-wide-shelves-r20": bookcase faces get
 * wider (lower 6.55 m, upper 5.08 m), the hall reaches x = ±20.0 and every
 * wall-side aisle moves out to the 18.0 m lane. Real book dimensions and the
 * 6 × 20 capacity must not change, and all four lanes (two floors × two sides)
 * must stay walkable for a full standing body in both directions.
 *
 * Values below are literal r20 contract targets, bound to the generated
 * public/assets/hogwarts-library/scene-config.json. CPU
 * geometry/collision regression only; not browser or GPU acceptance.
 */
import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { collectCameraColliders, markCameraCollider, resolveCameraCollision } from '../../virtual-library-collision';
import { WALKING_CAMERA_CLEARANCE, WALKING_EYE_HEIGHT } from '../../virtual-library-navigation';
import {
  REFERENCE_LIBRARY as R, REFERENCE_BOOK_CENTER_OFFSET, REFERENCE_SECTION_CAPACITY,
} from '../hogwartsLibraryLayout';
import { createReferenceCatalogAnchors, referenceCameraColliderDescriptors, validateReferenceConfig } from './referenceLibrary';

const LOWER_FACE_WIDTH = 6.55;
const UPPER_FACE_WIDTH = 5.08;
const AISLE_CENTER_X = 18.0;
const AISLE_LANE_OFFSET = 1.1; // Published lane tolerance around the aisle centre.
const REQUIRED_PHYSICAL_WIDTH = 3.0;
const OUTER_WALL_X = 20.0;
const CASE_STILE_WIDTH = 0.24;
const BOOK_ROW_TARGET_WIDTH = 3.276; // Twenty real spines, unchanged by r20.

const config: unknown = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));
validateReferenceConfig(config);
const root = new THREE.Group();
for (const collider of referenceCameraColliderDescriptors(config)) markCameraCollider(root, collider);
const colliders = collectCameraColliders(root, 'hall');

const metrics: Record<string, number> = {
  revision: 20261019, runtimeColliderCount: colliders.length,
  laneRuns: 0, crosswalkRuns: 0, maximumLaneDrift: 0, supportedFloorBounds: 0,
};

interface Point { x: number; y: number; z: number }

/** March a straight body path and record the first solid that deflects it. */
function traceRun(hits: string[], label: string, from: Point, to: Point, steps: number): Point {
  let previous = from;
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const desired: Point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t,
    };
    const safe = resolveCameraCollision(previous, desired, colliders, WALKING_CAMERA_CLEARANCE);
    const drift = Math.hypot(safe.x - desired.x, safe.y - desired.y, safe.z - desired.z);
    metrics.maximumLaneDrift = Math.max(metrics.maximumLaneDrift, drift);
    if (drift > 0.005) {
      hits.push(`${label} @ x ${desired.x.toFixed(2)} z ${desired.z.toFixed(2)}: ${safe.blockedBy ?? 'drift'}`);
      return safe;
    }
    previous = safe;
  }
  return previous;
}

afterAll(() => {
  if (process.env.BOOKKIN_SHELF_EXPANSION_REPORT) writeFileSync(process.env.BOOKKIN_SHELF_EXPANSION_REPORT,
    `${JSON.stringify({revision: '20261020-lower-gallery-r27', evidence: 'CPU geometry/collision regression; not browser or GPU acceptance',
      body: WALKING_CAMERA_CLEARANCE, eyeHeight: WALKING_EYE_HEIGHT, aisleCenterAbsX: AISLE_CENTER_X,
      laneOffset: AISLE_LANE_OFFSET, ...metrics}, null, 2)}\n`);
});

describe('reference-library wide bookcase and wall-side aisle expansion', () => {
  it('publishes the widened hall with 6.55 lower and 5.08 upper shelf faces', () => {
    expect(R).toMatchObject({
      width: 40.0, length: 40, galleryY: 7.44,
      lowerCaseInnerX: 9.45, caseOuterX: 16.0,
      upperCaseInnerX: 11.1, upperCaseOuterX: 16.18,
      caseDepth: 0.82, shelfFrontOffset: 0.41,
      shelfBoardThickness: 0.168, shelfBackThickness: 0.16,
      bookRearGap: 0.024, bookFrontInset: 0.018,
      book: {spineWidth: 0.16, height: 0.48, coverWidth: 0.30},
    });
    expect(R.caseOuterX - R.lowerCaseInnerX).toBeCloseTo(LOWER_FACE_WIDTH, 6);
    expect(R.upperCaseOuterX - R.upperCaseInnerX).toBeCloseTo(UPPER_FACE_WIDTH, 6);
    expect(R.width / 2).toBeCloseTo(OUTER_WALL_X, 6);
    expect(R.caseDepth / 2).toBeCloseTo(R.shelfFrontOffset, 6);

    // The wider cavity keeps the real book, its centre offset and both gaps.
    const renderedDepth = R.book.coverWidth * 0.96;
    expect(renderedDepth).toBeCloseTo(0.288, 6);
    expect(REFERENCE_BOOK_CENTER_OFFSET).toBeCloseTo(R.shelfBackThickness / 2
      + R.bookRearGap + renderedDepth / 2, 6);
    expect(REFERENCE_BOOK_CENTER_OFFSET).toBeCloseTo(0.248, 6);
    expect(R.shelfFrontOffset - (REFERENCE_BOOK_CENTER_OFFSET + renderedDepth / 2))
      .toBeCloseTo(R.bookFrontInset, 6);

    // Capacity is untouched by the wider face.
    expect(R.shelfRows).toBe(6);
    expect(R.booksPerRow).toBe(20);
    expect(REFERENCE_SECTION_CAPACITY).toBe(120);

    // Both new faces still hold a full twenty-book row inside the solid stiles.
    for (const face of [LOWER_FACE_WIDTH, UPPER_FACE_WIDTH]) {
      expect(face - CASE_STILE_WIDTH).toBeGreaterThan(BOOK_ROW_TARGET_WIDTH + 0.02);
    }

    // Every wall-side lane keeps the required physical aisle width.
    expect(R.width / 2 - R.caseOuterX).toBeGreaterThanOrEqual(REQUIRED_PHYSICAL_WIDTH);
    expect(R.width / 2 - R.upperCaseOuterX).toBeGreaterThanOrEqual(REQUIRED_PHYSICAL_WIDTH);
    expect(AISLE_CENTER_X - AISLE_LANE_OFFSET).toBeGreaterThan(R.upperCaseOuterX);
    expect(AISLE_CENTER_X + AISLE_LANE_OFFSET).toBeLessThan(R.width / 2);
  });

  it('rebuilds all fifty-six cases on the new faces with six complete rows', () => {
    const {shelfSections, catalogSlots} = createReferenceCatalogAnchors();
    expect(shelfSections).toHaveLength(56);
    expect(catalogSlots).toHaveLength(56 * REFERENCE_SECTION_CAPACITY);

    for (const [level, inner, outer, width] of [
      [0, R.lowerCaseInnerX, R.caseOuterX, LOWER_FACE_WIDTH],
      [R.galleryY, R.upperCaseInnerX, R.upperCaseOuterX, UPPER_FACE_WIDTH],
    ] as const) {
      const band = shelfSections.filter(section => section.baseY === level);
      expect(band).toHaveLength(28);
      for (const section of band) {
        expect(section.width).toBeCloseTo(width, 6);
        expect(Math.abs(section.centerX!)).toBeCloseTo(inner + width / 2, 6);
        expect(Math.abs(section.centerX!) - section.width / 2).toBeCloseTo(inner, 6);
        expect(Math.abs(section.centerX!) + section.width / 2).toBeCloseTo(outer, 6);
        expect(section.depth).toBeCloseTo(R.caseDepth, 6);
        expect(section.frontOffset).toBeCloseTo(R.shelfFrontOffset, 6);
        expect(section.bookCenterOffset).toBeCloseTo(REFERENCE_BOOK_CENTER_OFFSET, 6);
        expect(section.shelfCount).toBe(R.shelfRows);
        const rows = new Map<number, number>();
        for (const slot of catalogSlots.filter(candidate => candidate.sectionId === section.id)) {
          expect(slot.position.x).toBeCloseTo(section.centerX!, 6);
          rows.set(slot.rowIndex, (rows.get(slot.rowIndex) ?? 0) + 1);
        }
        expect([...rows.keys()].sort((left, right) => left - right)).toEqual([0, 1, 2, 3, 4, 5]);
        expect([...rows.values()]).toEqual(Array.from({length: R.shelfRows}, () => R.booksPerRow));
      }
      // No widened case may reach into the new lane.
      expect(Math.max(...band.map(section => Math.abs(section.centerX!) + section.width / 2)))
        .toBeLessThan(AISLE_CENTER_X - AISLE_LANE_OFFSET);
    }
  });

  it('walks all four wall-side aisles at 18.0 with ±1.1 lane offsets in both directions', () => {
    const hits: string[] = [];
    for (const floorY of [0, R.galleryY]) for (const side of [-1, 1]) for (const offset of [-AISLE_LANE_OFFSET, 0, AISLE_LANE_OFFSET]) {
      const x = side * (AISLE_CENTER_X + offset);
      expect(Math.abs(x)).toBeGreaterThan(R.upperCaseOuterX);
      expect(Math.abs(x)).toBeLessThan(R.width / 2);
      for (const direction of [-1, 1]) {
        const eyeY = floorY + WALKING_EYE_HEIGHT;
        metrics.laneRuns += 1;
        const label = `lane/${floorY}/${side}/${offset}/${direction}`;
        const end = traceRun(hits, label, {x, y: eyeY, z: -18 * direction}, {x, y: eyeY, z: 18 * direction}, 300);
        if (!hits.some(hit => hit.startsWith(`${label} `))) {
          expect(Math.abs(end.z), label).toBeCloseTo(18, 2);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('joins every lane to the gallery edge through both end crosswalks in both directions', () => {
    const hits: string[] = [];
    for (const floorY of [0, R.galleryY]) for (const side of [-1, 1]) for (const centerZ of [-17.35, 17.25]) for (const direction of [-1, 1]) {
      const eyeY = floorY + WALKING_EYE_HEIGHT;
      const innerX = side * 10.1;
      const laneX = side * AISLE_CENTER_X;
      metrics.crosswalkRuns += 1;
      const label = `crosswalk/${floorY}/${side}/${centerZ}/${direction}`;
      const end = direction > 0
        ? traceRun(hits, label, {x: innerX, y: eyeY, z: centerZ}, {x: laneX, y: eyeY, z: centerZ}, 80)
        : traceRun(hits, label, {x: laneX, y: eyeY, z: centerZ}, {x: innerX, y: eyeY, z: centerZ}, 80);
      expect(Math.abs(end.x), label).toBeCloseTo(direction > 0 ? AISLE_CENTER_X : 10.1, 2);
    }
    expect(hits).toEqual([]);
  });

  it('keeps the extended outer wall solid so no lane sample escapes past 20.5', () => {
    const blocked: string[] = [];
    for (const floorY of [0, R.galleryY]) for (const side of [-1, 1]) for (const offset of [-AISLE_LANE_OFFSET, 0, AISLE_LANE_OFFSET]) for (const z of [-12, 0, 12]) {
      const start: Point = {x: side * (AISLE_CENTER_X + offset), y: floorY + WALKING_EYE_HEIGHT, z};
      const safe = resolveCameraCollision(start, {x: side * 20.5, y: start.y, z}, colliders, WALKING_CAMERA_CLEARANCE);
      const label = `wall/${floorY}/${side}/${offset}/${z}`;
      if (!safe.blocked || safe.blockedBy == null) blocked.push(`${label}: escaped`);
      else if (Math.abs(safe.x) <= R.upperCaseOuterX || Math.abs(safe.x) >= R.width / 2) {
        blocked.push(`${label}: stopped at ${safe.x.toFixed(2)} by ${safe.blockedBy}`);
      }
    }
    expect(blocked).toEqual([]);
  });

  it('keeps every new lane over exported supported floor bounds', () => {
    const supports = config.colliders.filter(collider => collider.shape === 'box'
      && (collider.id === 'hall-floor' || collider.id.startsWith('gallery-') || collider.id.startsWith('crosswalk-')));
    expect(supports.length).toBeGreaterThan(0);
    metrics.supportedFloorBounds = supports.length;
    const uncovered: string[] = [];
    for (const floorY of [0, R.galleryY]) for (const side of [-1, 1]) for (const offset of [-AISLE_LANE_OFFSET, 0, AISLE_LANE_OFFSET]) for (const z of [-18, -9, 0, 9, 18]) {
      const x = side * (AISLE_CENTER_X + offset);
      const covered = supports.some(collider => {
        if (collider.shape !== 'box') return false;
        const {center, size} = collider;
        return Math.abs(x - center.x) <= size.x / 2 + 0.05
          && Math.abs(z - center.z) <= size.z / 2 + 0.05
          && Math.abs((center.y + size.y / 2) - floorY) <= 0.12;
      });
      if (!covered) uncovered.push(`${floorY}/${x}/${z}`);
    }
    expect(uncovered).toEqual([]);
  });
});
