// 把正文选区坐标映射到工具栏锚点，并携带可恢复的阅读定位。
// Maps document selection rectangles to toolbar anchors while carrying restorable reading locators.
import { tokens } from "../../theme/generated-tokens";

export interface ReaderSelection {
  quote: string;
  locator: string;
  x: number;
  y: number;
  placement: "ABOVE" | "BELOW";
}

export function readerSelectionFromRect({ quote, locator, rect, frameRect }: {
  quote: string;
  locator: string;
  rect: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">;
  frameRect?: Pick<DOMRect, "left" | "top"> | null;
}): ReaderSelection {
  const offsetLeft = frameRect?.left ?? 0;
  const offsetTop = frameRect?.top ?? 0;
  const left = offsetLeft + rect.left;
  const top = offsetTop + rect.top;
  const bottom = offsetTop + rect.bottom;
  const toolbarWidth = window.innerWidth < tokens.layout.breakpointMobile ? 280 : 312;
  const halfToolbar = toolbarWidth / 2;
  const edgeGap = 12;
  const x = Math.min(
    window.innerWidth - halfToolbar - edgeGap,
    Math.max(halfToolbar + edgeGap, left + rect.width / 2),
  );
  const placement = top >= (window.innerWidth < tokens.layout.breakpointMobile ? 154 : 164) ? "ABOVE" : "BELOW";

  return {
    quote,
    locator,
    x,
    y: placement === "ABOVE" ? top - 8 : bottom + 8,
    placement,
  };
}

export interface TocItem {
  href: string;
  label: string;
  depth: number;
  /** Resolved position in the source document, used to place private bookmark markers. */
  locator?: string;
}
