const MAX_PAGE_TURN_PIXEL_RATIO = 2;

export function pageTurnPixelRatio(devicePixelRatio: number) {
  if (!Number.isFinite(devicePixelRatio)) return 1;
  return Math.min(MAX_PAGE_TURN_PIXEL_RATIO, Math.max(1, devicePixelRatio));
}
