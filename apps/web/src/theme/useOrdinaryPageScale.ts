import { useLayoutEffect } from "react";
import { tokens } from "./generated-tokens";

// 放大普通页面完整 UI，也包括挂载到 body 的覆盖层。
/** Enlarge the complete ordinary UI, including overlays portalled to body. */
export function useOrdinaryPageScale(enabled: boolean) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    let scrollbarWidth = 0;
    const update = () => {
      // CSS zoom 不改变 innerWidth，浏览器或系统缩放已经影响该值。
      // CSS zoom does not change innerWidth; browser/OS zoom already does.
      const scale = enabled ? 1 + Math.max(0, window.innerWidth - tokens.layout.wideScreenReferenceWidth) / tokens.layout.wideScreenScaleRange : 1;
      if (enabled) {
        root.style.zoom = String(scale);
        root.style.setProperty("--app-ui-scale", String(scale));
      }
      // A drawer temporarily releases the root gutter to reach the screen
      // edge. Retain the last measured lane so its background never reflows,
      // including when the viewport is resized with a drawer still open.
      if (!document.querySelector(".ant-drawer-open")) {
        const pageWidth = root.getBoundingClientRect().width;
        scrollbarWidth = pageWidth > 0 ? Math.max(0, window.innerWidth - pageWidth) : 0;
      }
      root.style.setProperty("--app-page-width", `${(window.innerWidth - scrollbarWidth) / scale}px`);
      // Readers retain viewport bounds for overlays without enabling zoom.
      root.style.setProperty("--app-viewport-width", `${window.innerWidth / scale}px`);
      root.style.setProperty("--app-viewport-height", `${window.innerHeight / scale}px`);
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      root.style.removeProperty("zoom");
      root.style.removeProperty("--app-ui-scale");
      root.style.removeProperty("--app-page-width");
      root.style.removeProperty("--app-viewport-width");
      root.style.removeProperty("--app-viewport-height");
    };
  }, [enabled]);
}
