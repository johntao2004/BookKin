// 按实际阅读区域宽高验证布局，覆盖手机到高分屏而非只依赖窗口宽度。
// Checks layout from the actual reading surface across phones and high-resolution screens, not window width alone.
import { describe, expect, it } from "vitest";
import { tokens } from "../../theme/generated-tokens";
import { readerPageLayout, readerShellHeight } from "./reader-layout";

describe("reader layout", () => {
  it("switches to a spread only when the actual reading surface reaches tablet width", () => {
    const tablet = readerPageLayout({
      surfaceWidth: tokens.layout.breakpointTablet,
      contentWidth: tokens.layout.breakpointTablet - tokens.spacing[6] * 2,
    });
    const narrowTablet = readerPageLayout({
      surfaceWidth: tokens.layout.breakpointTablet - tokens.spacing[1],
      contentWidth: tokens.layout.breakpointTablet - tokens.spacing[1] - tokens.spacing[6] * 2,
    });

    expect(tablet.spread).toBe(true);
    expect(tablet.visibleColumns).toBe(2);
    expect(narrowTablet.spread).toBe(false);
    expect(narrowTablet.visibleColumns).toBe(1);
  });

  it("keeps prose measure bounded on phone, desktop, 4K and 5K reading surfaces", () => {
    const layouts = [320, 390, 768, 1024, 1440, 1920, 3840, 5120].map((surfaceWidth) => {
      const outerGutter = surfaceWidth < tokens.layout.breakpointMobile ? tokens.spacing[3] * 2 : tokens.spacing[6] * 2;
      return { surfaceWidth, layout: readerPageLayout({ surfaceWidth, contentWidth: surfaceWidth - outerGutter }) };
    });

    for (const { surfaceWidth, layout } of layouts) {
      expect(layout.articleWidth).toBeLessThanOrEqual(layout.contentWidth);
      expect(layout.pageStride).toBe(layout.visibleColumns * (layout.columnWidth + layout.columnGap));
      if (surfaceWidth >= tokens.layout.breakpointWide) {
        expect(layout.columnWidth).toBeLessThanOrEqual(tokens.layout.readingMax);
      }
    }
    expect(layouts[0]?.layout.pagePadding).toBe(tokens.spacing[5]);
    expect(layouts.at(-1)?.layout.columnWidth).toBe(tokens.layout.readingMax);
  });

  it("uses the current visible viewport height for the reader shell", () => {
    expect(readerShellHeight(844)).toBe(`${844 - tokens.layout.navHeight}px`);
    expect(readerShellHeight(390)).toBe(`${390 - tokens.layout.navHeight}px`);
    expect(readerShellHeight(undefined)).toBe(`calc(100dvh - ${tokens.layout.navHeight}px)`);
  });
});
