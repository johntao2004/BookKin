/**
 * Project-scale estimates reconstructed from the nine supplied views, not
 * surveyed game dimensions. Blender uses the same contract and exports Y-up.
 */
export const REFERENCE_LIBRARY = {
  length: 36,
  // User clarified width-only expansion: length, height and case count stay fixed.
  width: 30,
  height: 18.7,
  galleryY: 6.2,
  galleryInnerX: 8.8,
  lowerCaseHeight: 5,
  upperCaseHeight: 5.7,
  lowerCaseInnerX: 9.45,
  upperCaseInnerX: 11.1,
  upperCaseOuterX: 14.58,
  caseOuterX: 14.4,
  caseDepth: 0.65,
  shelfFrontOffset: 0.37,
  categoryPlaqueFrontOffset: 0.46,
  shelfRows: 6,
  booksPerRow: 20,
  shelfBoardThickness: 0.105,
  shelfBackThickness: 0.12,
  lowerShelfBase: 0.25,
  upperShelfBase: 6.45,
  lowerShelfPitch: 0.77,
  upperShelfPitch: 0.88,
  vaultSpring: 13.8,
  sideVaultSpring: 12.15,
  sideVaultRadius: 2.45,
  camera: { targetY: 4.2, targetZ: -3.5, radius: 19, pitch: -0.1277 },
  book: { spineWidth: 0.16, height: 0.48, coverWidth: 0.30 },
  manifestUrl: '/assets/hogwarts-library/library-manifest.json?v=20261009-walk-clearance-r4',
  configUrl: '/assets/hogwarts-library/scene-config.json?v=20261009-walk-clearance-r4',
} as const;

export const REFERENCE_BAY_BOUNDARIES = [-15, -10, -5, 0, 5, 10, 15] as const;
export const REFERENCE_SECTION_CAPACITY = REFERENCE_LIBRARY.shelfRows * REFERENCE_LIBRARY.booksPerRow;
export const REFERENCE_BOOK_CENTER_OFFSET = REFERENCE_LIBRARY.shelfFrontOffset
  - REFERENCE_LIBRARY.book.coverWidth * 0.96 / 2 - 0.018;

export function referenceLibraryRoofY(x: number, z = 0) {
  if (Math.abs(x) <= REFERENCE_LIBRARY.galleryInnerX) {
    const normalized = Math.min(1, Math.abs(x) / REFERENCE_LIBRARY.galleryInnerX);
    return REFERENCE_LIBRARY.vaultSpring + (REFERENCE_LIBRARY.height - REFERENCE_LIBRARY.vaultSpring)
      * Math.sqrt(Math.max(0, 1 - normalized * normalized));
  }
  // Side barrels run across the hall, so their ceiling depends on the bay's
  // longitudinal position. A constant spring height lets flight cross the
  // curved surface near either end of every bay.
  const bayDistance = Math.min(...REFERENCE_BAY_BOUNDARIES.slice(1).map((end, i) =>
    Math.abs(z - (REFERENCE_BAY_BOUNDARIES[i] + end) / 2)));
  const normalized = Math.min(1, bayDistance / REFERENCE_LIBRARY.sideVaultRadius);
  return REFERENCE_LIBRARY.sideVaultSpring + REFERENCE_LIBRARY.sideVaultRadius
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
