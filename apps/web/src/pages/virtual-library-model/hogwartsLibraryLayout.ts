// 按九张参考视图重建的项目尺度估计，并非游戏实测尺寸；Blender 使用相同约定，导出 Y 轴向上。
/**
 * Project-scale estimates reconstructed from the nine supplied views, not
 * surveyed game dimensions. Blender uses the same contract and exports Y-up.
 */
export const REFERENCE_LIBRARY_ASSET_REVISION = '20261020-terminal-arches-r42';
export const REFERENCE_LIBRARY_DELIVERY_REVISION = `${REFERENCE_LIBRARY_ASSET_REVISION}-loading-v1`;

export const REFERENCE_LIBRARY = {
  length: 40,
  // 延长两端大厅和窗边通道，中央六跨保持不变。
  // Extend both end halls and window-side aisles; the six central bays stay fixed.
  width: 40.0,
  height: 22.44,
  galleryY: 7.44,
  galleryInnerX: 8.8,
  lowerCaseHeight: 6,
  upperCaseHeight: 6.84,
  lowerCaseInnerX: 9.45,
  upperCaseInnerX: 11.1,
  upperCaseOuterX: 16.18,
  caseOuterX: 16.0,
  caseDepth: 0.82,
  shelfFrontOffset: 0.41,
  // 突出檐口深于书板，完整标牌应装在最外侧木构截面之外。
  // The projecting cornice is deeper than the boards: (caseDepth + .08) * 1.25 / 2.
  // Mount the entire solid plaque beyond that outermost timber profile.
  categoryPlaqueFrontOffset: (0.82 + 0.08) * 1.25 / 2,
  caseStileWidth: 0.24,
  outerAisleCenterX: 18.0,
  outerAisleMinWidth: 3.0,
  shelfRows: 6,
  booksPerRow: 20,
  shelfBoardThickness: 0.168,
  shelfBackThickness: 0.16, /* 这是柜体深度，不是竖直尺寸。 */ // Cabinet depth, not a vertical dimension.
  bookRearGap: 0.024,
  bookFrontInset: 0.018,
  lowerShelfBase: 0.30,
  upperShelfBase: 7.74,
  lowerShelfPitch: 0.924,
  upperShelfPitch: 1.056,
  vaultSpring: 16.56,
  sideVaultSpring: 14.58,
  sideVaultRadius: 2.45, /* 横向跨间半宽。 */ // Horizontal bay half-width.
  sideVaultRise: 2.94, /* 竖向拱高，不能复用横向半径。 */ // Vertical rise; never reuse the horizontal radius.
  camera: { targetY: 4.2, targetZ: -3.5, radius: 19, pitch: -0.1277 },
  book: { spineWidth: 0.16, height: 0.48, coverWidth: 0.30 },
  manifestUrl: `/assets/hogwarts-library/library-manifest.json?v=${REFERENCE_LIBRARY_DELIVERY_REVISION}`,
  configUrl: `/assets/hogwarts-library/scene-config.json?v=${REFERENCE_LIBRARY_ASSET_REVISION}`,
} as const;

export const REFERENCE_BAY_BOUNDARIES = [-15, -10, -5, 0, 5, 10, 15] as const;
export const REFERENCE_SECTION_CAPACITY = REFERENCE_LIBRARY.shelfRows * REFERENCE_LIBRARY.booksPerRow;
export const REFERENCE_BOOK_CENTER_OFFSET = REFERENCE_LIBRARY.shelfBackThickness / 2
  + REFERENCE_LIBRARY.bookRearGap + REFERENCE_LIBRARY.book.coverWidth * 0.96 / 2;

export function referenceLibraryRoofY(x: number, z = 0) {
  if (Math.abs(x) <= REFERENCE_LIBRARY.galleryInnerX) {
    const normalized = Math.min(1, Math.abs(x) / REFERENCE_LIBRARY.galleryInnerX);
    return REFERENCE_LIBRARY.vaultSpring + (REFERENCE_LIBRARY.height - REFERENCE_LIBRARY.vaultSpring)
      * Math.sqrt(Math.max(0, 1 - normalized * normalized));
  }
  // 侧桶拱横跨大厅，顶面高度随纵向位置变化；固定起拱高度会让飞行在每跨两端穿过曲面。
  // Side barrels run across the hall, so their ceiling depends on the bay's
  // longitudinal position. A constant spring height lets flight cross the
  // curved surface near either end of every bay.
  const endBay = Math.abs(z) >= 15;
  const bayDistance = endBay ? Math.abs(Math.abs(z) - 17.5) : Math.min(...REFERENCE_BAY_BOUNDARIES.slice(1).map((end, i) =>
    Math.abs(z - (REFERENCE_BAY_BOUNDARIES[i] + end) / 2)));
  const normalized = Math.min(1, bayDistance / (endBay ? 2.5 : REFERENCE_LIBRARY.sideVaultRadius));
  const sideRoof = REFERENCE_LIBRARY.sideVaultSpring + REFERENCE_LIBRARY.sideVaultRise
    * Math.sqrt(Math.max(0, 1 - normalized * normalized));
  // 窄木封边从主拱起点过渡至侧桶拱；飞行高度需低于真实过渡，包括较低两端。
  // The narrow timber flashing rises/falls from the main spring to each side
  // barrel. Keep flight below that actual transition, including its low ends.
  if (Math.abs(x) < 8.97) {
    return REFERENCE_LIBRARY.vaultSpring + (sideRoof - REFERENCE_LIBRARY.vaultSpring)
      * ((Math.abs(x) - 8.79) / (8.97 - 8.79));
  }
  return sideRoof;
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
