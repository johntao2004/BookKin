// 限定翻页画布像素比，避免高 DPI 让短暂动画分配过大纹理。
// Bounds page-turn canvas pixel ratios to avoid oversized transient textures on high-DPI displays.
const MAX_PAGE_TURN_PIXEL_RATIO = 2;

export function pageTurnPixelRatio(devicePixelRatio: number) {
  if (!Number.isFinite(devicePixelRatio)) return 1;
  return Math.min(MAX_PAGE_TURN_PIXEL_RATIO, Math.max(1, devicePixelRatio));
}
