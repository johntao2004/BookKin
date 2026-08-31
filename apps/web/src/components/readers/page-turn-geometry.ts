export type PageTurnDirection = "NEXT" | "PREVIOUS";

export const PAGE_CURL_HORIZONTAL_SEGMENTS = 48;
export const PAGE_CURL_VERTICAL_SEGMENTS = 16;

const PAGE_CURL_DEPTH = 1;
const PAGE_CURL_FOLD_HALF_WIDTH = 0.18;
const PAGE_CURL_CORNER_LEAD = 0.16;
const PAGE_CURL_CORNER_PROFILE = 1.6;

export type PageCurlPoint = {
  x: number;
  z: number;
};

export function pageCurlPointForColumn(
  path: PageCurlPoint[],
  column: number,
  direction: PageTurnDirection,
) {
  return path[direction === "PREVIOUS" ? path.length - 1 - column : column];
}

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));
const smoothStep = (value: number) => {
  const unit = clampUnit(value);
  return unit * unit * (3 - 2 * unit);
};

/**
 * Builds one horizontal row of a paper sheet. The row is integrated from the
 * spine instead of rotating every point around one hinge, so the sheet keeps a
 * continuous curved body while the free edge catches up with the turn.
 */
export function pageCurlPath({
  progress,
  direction,
  width,
  segments = PAGE_CURL_HORIZONTAL_SEGMENTS,
  rowPosition = 0.5,
}: {
  progress: number;
  direction: PageTurnDirection;
  width: number;
  segments?: number;
  rowPosition?: number;
}): PageCurlPoint[] {
  const turnProgress = clampUnit(progress);
  const row = clampUnit(rowPosition);
  const orientation = direction === "NEXT" ? 1 : -1;
  const anchorX = direction === "NEXT" ? -width / 2 : width / 2;
  const segmentLength = width / Math.max(1, segments);
  const turnEnvelope = Math.sin(Math.PI * turnProgress);
  const points: PageCurlPoint[] = [{ x: anchorX, z: 0 }];
  let x = anchorX;
  let z = 0;

  // Move one localized fold from the free edge toward the spine. Keeping the
  // already-turned and not-yet-turned areas flat prevents an entire line of
  // text from being squeezed into an edge-on strip at the middle of the turn.
  const cornerProfile = Math.pow(1 - row, PAGE_CURL_CORNER_PROFILE)
    - Math.pow(0.5, PAGE_CURL_CORNER_PROFILE);
  const rowProgress = clampUnit(
    turnProgress + cornerProfile * PAGE_CURL_CORNER_LEAD * turnEnvelope,
  );
  const foldCenter = 1 + PAGE_CURL_FOLD_HALF_WIDTH
    - rowProgress * (1 + 2 * PAGE_CURL_FOLD_HALF_WIDTH);
  const foldStart = foldCenter - PAGE_CURL_FOLD_HALF_WIDTH;
  const foldWidth = PAGE_CURL_FOLD_HALF_WIDTH * 2;

  for (let index = 1; index <= segments; index += 1) {
    const sheetPosition = (index - 0.5) / segments;
    const foldProgress = smoothStep((sheetPosition - foldStart) / foldWidth);
    const tangentAngle = Math.PI * foldProgress;

    x += orientation * segmentLength * Math.cos(tangentAngle);
    z += segmentLength * Math.sin(tangentAngle) * PAGE_CURL_DEPTH;
    points.push({ x, z });
  }

  return points;
}
