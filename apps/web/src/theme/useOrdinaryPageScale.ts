import { useLayoutEffect } from "react";
import { tokens } from "./generated-tokens";

/** Enlarge the complete ordinary UI, including overlays portalled to body. */
export function useOrdinaryPageScale(enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const update = () => {
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
