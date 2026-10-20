// 测量真实内容宽度而非仅窗口宽度，布局未变时复用状态并清理观察器。
// Measures actual content width rather than only window width, reusing unchanged state and cleaning up observers.
import { useEffect, useState, type RefObject } from "react";
import { readerPageLayout, type ReaderPageLayout } from "./reader-layout";

function sameLayout(left: ReaderPageLayout | null, right: ReaderPageLayout) {
  return left?.surfaceWidth === right.surfaceWidth
    && left.contentWidth === right.contentWidth
    && left.spread === right.spread
    && left.pagePadding === right.pagePadding
    && left.columnWidth === right.columnWidth
    && left.columnGap === right.columnGap
    && left.articleWidth === right.articleWidth;
}

export function useReaderPageLayout(ref: RefObject<HTMLElement | null>) {
  const [layout, setLayout] = useState<ReaderPageLayout | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === "undefined") return;

    const measure = () => {
      const style = window.getComputedStyle(element);
      const surfaceWidth = Math.max(1, element.clientWidth || element.getBoundingClientRect().width);
      const horizontalPadding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
      const nextLayout = readerPageLayout({
        surfaceWidth,
        contentWidth: Math.max(1, surfaceWidth - horizontalPadding),
      });
      setLayout((current) => sameLayout(current, nextLayout) ? current : nextLayout);
    };

    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [ref]);

  return layout;
}
