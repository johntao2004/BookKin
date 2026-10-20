import { useLayoutEffect } from "react";
import { tokens } from "./generated-tokens";

// 放大普通页面完整 UI，也包括挂载到 body 的覆盖层。
/** Enlarge the complete ordinary UI, including overlays portalled to body. */
export function useOrdinaryPageScale(enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const update = () => {
      // CSS zoom 不改变 innerWidth，浏览器或系统缩放已经影响该值。
      // CSS zoom does not change innerWidth; browser/OS zoom already does.
      const scale = 1 + Math.max(0, window.innerWidth - tokens.layout.wideScreenReferenceWidth) / tokens.layout.wideScreenScaleRange;
      root.style.zoom = String(scale);
      root.style.setProperty("--app-ui-scale", String(scale));
      root.style.setProperty("--app-viewport-width", `${window.innerWidth / scale}px`);
      root.style.setProperty("--app-viewport-height", `${window.innerHeight / scale}px`);
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      root.style.removeProperty("zoom");
      root.style.removeProperty("--app-ui-scale");
      root.style.removeProperty("--app-viewport-width");
      root.style.removeProperty("--app-viewport-height");
    };
  }, [enabled]);
}
