/**
 * Live narrow-hall contract. Units are metres, Y-up, matching the
 * generator in scripts/hogwarts-library/build_narrow_hall.mjs.
 * The retired 30 m hall is not the runtime target.
 */
export const REFERENCE_LIBRARY = {
  length: 40,
  width: 16,
  height: 11.2,
  galleryY: 4,
  galleryInnerX: 2.2,
  lowerCaseHeight: 3.85,
  upperCaseHeight: 3.5,
  lowerCaseInnerX: 1.9,
  upperCaseInnerX: 3.35,
  upperCaseOuterX: 7.7,
  caseOuterX: 7.75,
  caseDepth: 0.72,
  shelfFrontOffset: 0.42,
  categoryPlaqueFrontOffset: 0.5,
  shelfRows: 6,
  booksPerRow: 20,
  shelfBoardThickness: 0.05,
  shelfBackThickness: 0.08,
  lowerShelfBase: 0.38,
  upperShelfBase: 4.28,
  lowerShelfPitch: 0.58,
  upperShelfPitch: 0.55,
  vaultSpring: 8.4,
  camera: {targetY: 1.55, targetZ: -13, radius: 3.4, pitch: -0.02, yaw: Math.PI},
  shadowMapSize: 1024,
  shadowHalfWidth: 4.5,
  shadowHalfDepth: 4.5,
  shadowFar: 14,
  book: {spineWidth: 0.16, height: 0.48, coverWidth: 0.30},
  manifestUrl: '/assets/hogwarts-library/library-manifest.json?v=20261017-narrow-hall',
  configUrl: '/assets/hogwarts-library/scene-config.json?v=20261017-narrow-hall',
} as const;

/** Eight alcove centres, south to north. Pitch is 4 m so a shelf camera fits between cases. */
export const REFERENCE_BAY_BOUNDARIES = [-15, -11, -7, -3, 1, 5, 9, 13] as const;

export const NARROW_HALL = {
  revision: '20261017-narrow-hall',
  aisleHalfWidth: 1.7,
  galleryWalkX: 2.8,
  gateZ: 15.2,
  gateOpening: 0.7,
  tableZ: [-9, 0, 7] as const,
  stairs: {
    left: {x: -5.15, z: -13, radius: 0.95},
    right: {x: 5.15, z: 11, radius: 0.95},
  },
} as const;

export const REFERENCE_SECTION_CAPACITY = REFERENCE_LIBRARY.shelfRows * REFERENCE_LIBRARY.booksPerRow;
export const REFERENCE_BOOK_CENTER_OFFSET = REFERENCE_LIBRARY.shelfFrontOffset
  - REFERENCE_LIBRARY.book.coverWidth * 0.96 / 2 - 0.018;

/** One barrel vault over the whole width. z is kept so callers can sample a 3D point. */
export function referenceLibraryRoofY(x: number, z = 0) {
  const half = REFERENCE_LIBRARY.width / 2;
  const normalized = Math.min(1, Math.abs(x) / half);
  void z;
  return REFERENCE_LIBRARY.vaultSpring + (REFERENCE_LIBRARY.height - REFERENCE_LIBRARY.vaultSpring)
    * Math.sqrt(Math.max(0, 1 - normalized * normalized));
}

export interface ReferencePoint { x: number; y: number; z: number }

export function referenceRouteLength(points: readonly ReferencePoint[]) {
  return points.slice(1).reduce((sum, point, i) => sum + Math.hypot(
    point.x - points[i].x, point.y - points[i].y, point.z - points[i].z,
  ), 0);
}

export function referenceRoutePoint(points: readonly ReferencePoint[], distance: number): ReferencePoint {
  if (!points.length) throw new Error('The stair route is empty');
  let remaining = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (length <= Number.EPSILON) continue;
    if (remaining <= length) {
      const t = remaining / length;
      return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t};
    }
    remaining -= length;
  }
  return {...points[points.length - 1]};
}
