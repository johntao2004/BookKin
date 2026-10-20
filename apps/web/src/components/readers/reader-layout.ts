import { tokens } from "../../theme/generated-tokens";

export const READER_PROGRESS_HEIGHT = 2;
export const READER_HEADER_BORDER_HEIGHT = 0;
export const READER_TOP_OFFSET = tokens.layout.navHeight + READER_PROGRESS_HEIGHT + READER_HEADER_BORDER_HEIGHT;
export const READER_SHELL_HEIGHT = `calc(100dvh - ${tokens.layout.navHeight}px)`;
export const READER_CONTENT_HEIGHT = "100%";
export const READER_PAGE_HEIGHT = "100%";
export const READER_SPREAD_MIN_WIDTH = tokens.layout.breakpointTablet;
export const READER_PAGE_GAP = tokens.layout.readerPageGap;
export const READER_MAX_PAGE_MEASURE = tokens.layout.readingMax;

export interface ReaderPageLayout {
  surfaceWidth: number;
  contentWidth: number;
  spread: boolean;
  visibleColumns: number;
  pagePadding: number;
  columnWidth: number;
  columnGap: number;
  pageStride: number;
  articleWidth: number;
}

export function readerShellHeight(visibleHeight?: number | null) {
  if (!visibleHeight || !Number.isFinite(visibleHeight)) return READER_SHELL_HEIGHT;
  return `${Math.max(0, visibleHeight - tokens.layout.navHeight)}px`;
}

export function readerSpreadEnabled(surfaceWidth: number) {
  return surfaceWidth >= READER_SPREAD_MIN_WIDTH;
}

export function readerPagePaddingForWidth(surfaceWidth: number) {
  if (surfaceWidth < tokens.layout.breakpointMobile) return tokens.spacing[5];
  if (surfaceWidth < tokens.layout.breakpointTablet) return tokens.spacing[10];
  return tokens.spacing[12];
}

export function readerPageLayout({ surfaceWidth, contentWidth }: { surfaceWidth: number; contentWidth: number }): ReaderPageLayout {
  const safeSurfaceWidth = Math.max(1, surfaceWidth);
  const safeContentWidth = Math.max(1, contentWidth);
  const spread = readerSpreadEnabled(safeSurfaceWidth);
  const visibleColumns = spread ? 2 : 1;
  const pagePadding = readerPagePaddingForWidth(safeSurfaceWidth);
  const columnGap = Math.max(READER_PAGE_GAP, pagePadding + tokens.spacing[2]);
  const availableForColumns = Math.max(1, safeContentWidth - pagePadding * 2 - columnGap * (visibleColumns - 1));
  const columnWidth = Math.max(1, Math.min(
    READER_MAX_PAGE_MEASURE,
    Math.floor(availableForColumns / visibleColumns),
  ));
  const groupWidth = columnWidth * visibleColumns + columnGap * (visibleColumns - 1);

  return {
    surfaceWidth: safeSurfaceWidth,
    contentWidth: safeContentWidth,
    spread,
    visibleColumns,
    pagePadding,
    columnWidth,
    columnGap,
    pageStride: visibleColumns * (columnWidth + columnGap),
    articleWidth: Math.min(safeContentWidth, groupWidth + pagePadding * 2),
  };
}
