import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { tokens } from "../../theme/generated-tokens";
import type { PageCurlRenderer } from "./page-turn-curl";
import type { PageTurnDirection } from "./page-turn-geometry";
import { pageTurnPixelRatio } from "./page-turn-rendering";

export type { PageTurnDirection } from "./page-turn-geometry";

const CURL_DURATION_MS = 760;
const FALLBACK_EXIT_DURATION_MS = 210;
const FALLBACK_ENTER_DURATION_MS = 250;
const FALLBACK_EXIT_EASING = "cubic-bezier(0.45, 0, 0.65, 0.55)";
const FALLBACK_ENTER_EASING = "cubic-bezier(0.18, 0.78, 0.2, 1)";
const PAGE_SNAPSHOT_IDLE_TIMEOUT_MS = 800;

type CachedPageSnapshot = {
  key: string;
  width: number;
  height: number;
  pixelRatio: number;
  snapshot: HTMLCanvasElement;
};

export type PageTurnTransitionOptions = {
  spread?: boolean;
  snapshotKey?: string;
};

const afterNextPaint = () => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
});

const finishAnimation = async (animation: Animation) => {
  try {
    await animation.finished;
  } catch {
    // A newer page turn or component cleanup may cancel the current animation.
  }
};

const easePaperTurn = (value: number) => value < 0.5
  ? 4 * value * value * value
  : 1 - Math.pow(-2 * value + 2, 3) / 2;

export function pageTurnKeyframes(direction: PageTurnDirection, phase: "EXIT" | "ENTER"): Keyframe[] {
  const perspective = Math.round(tokens.layout.contentMax * 1.35);
  const directionSign = direction === "NEXT" ? -1 : 1;
  const enterSign = -directionSign;
  const transform = (sign: number, translate: number, rotate: number, skew: number, scale: number) => `perspective(${perspective}px) translateX(${sign * translate}%) rotateY(${sign * rotate}deg) skewY(${sign * skew}deg) scaleX(${scale})`;
  const neutralTransform = transform(1, 0, 0, 0, 1);
  const exitOrigin = direction === "NEXT" ? "left center" : "right center";
  const enterOrigin = direction === "NEXT" ? "right center" : "left center";
  const neutralClip = "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
  const exitCurl = direction === "NEXT"
    ? "polygon(0 0, 98.5% 1.5%, 96.5% 98.5%, 0 100%)"
    : "polygon(1.5% 1.5%, 100% 0, 100% 100%, 3.5% 98.5%)";
  const enterCurl = direction === "NEXT"
    ? "polygon(1.5% 1.5%, 100% 0, 100% 100%, 3.5% 98.5%)"
    : "polygon(0 0, 98.5% 1.5%, 96.5% 98.5%, 0 100%)";

  return phase === "EXIT"
    ? [
        { transform: neutralTransform, transformOrigin: exitOrigin, clipPath: neutralClip, opacity: 1, filter: "brightness(1)" },
        { transform: transform(directionSign, 0.4, 18, 0.18, 0.998), transformOrigin: exitOrigin, clipPath: neutralClip, opacity: 1, filter: "brightness(0.98)", offset: 0.34 },
        { transform: transform(directionSign, 1.15, 58, 0.52, 0.988), transformOrigin: exitOrigin, clipPath: exitCurl, opacity: 0.9, filter: "brightness(0.86)", offset: 0.72 },
        { transform: transform(directionSign, 1.8, 88, 0.78, 0.975), transformOrigin: exitOrigin, clipPath: exitCurl, opacity: 0.32, filter: "brightness(0.72)" },
      ]
    : [
        { transform: transform(enterSign, 1.8, 88, 0.78, 0.975), transformOrigin: enterOrigin, clipPath: enterCurl, opacity: 0.32, filter: "brightness(0.72)" },
        { transform: transform(enterSign, 1.05, 54, 0.46, 0.989), transformOrigin: enterOrigin, clipPath: enterCurl, opacity: 0.9, filter: "brightness(0.87)", offset: 0.36 },
        { transform: transform(enterSign, 0.3, 15, 0.14, 0.999), transformOrigin: enterOrigin, clipPath: neutralClip, opacity: 1, filter: "brightness(0.99)", offset: 0.76 },
        { transform: neutralTransform, transformOrigin: enterOrigin, clipPath: neutralClip, opacity: 1, filter: "brightness(1)" },
      ];
}

export function pageTurnShadeKeyframes(direction: PageTurnDirection, phase: "EXIT" | "ENTER"): Keyframe[] {
  const mirrored = direction === "NEXT" ? "scaleX(1)" : "scaleX(-1)";
  const outerEdge = direction === "NEXT" ? "100% 0" : "0% 0";
  const spine = direction === "NEXT" ? "0% 0" : "100% 0";
  return phase === "EXIT"
    ? [
        { opacity: 0, transform: mirrored, backgroundPosition: outerEdge },
        { opacity: 0.26, transform: mirrored, backgroundPosition: "50% 0", offset: 0.38 },
        { opacity: 0.82, transform: mirrored, backgroundPosition: spine },
      ]
    : [
        { opacity: 0.76, transform: mirrored, backgroundPosition: spine },
        { opacity: 0.28, transform: mirrored, backgroundPosition: "50% 0", offset: 0.5 },
        { opacity: 0, transform: mirrored, backgroundPosition: outerEdge },
      ];
}

export function pageCurlShadeKeyframes(direction: PageTurnDirection): Keyframe[] {
  const mirrored = direction === "NEXT" ? "scaleX(1)" : "scaleX(-1)";
  const outerEdge = direction === "NEXT" ? "100% 0" : "0% 0";
  const spine = direction === "NEXT" ? "0% 0" : "100% 0";
  return [
    { opacity: 0, transform: mirrored, backgroundPosition: outerEdge },
    { opacity: 0.22, transform: mirrored, backgroundPosition: "72% 0", offset: 0.2 },
    { opacity: 0.46, transform: mirrored, backgroundPosition: "48% 0", offset: 0.5 },
    { opacity: 0.24, transform: mirrored, backgroundPosition: "24% 0", offset: 0.8 },
    { opacity: 0, transform: mirrored, backgroundPosition: spine },
  ];
}

const isTransparentBackground = (color: string) => {
  const normalized = color.replace(/\s/gu, "").toLowerCase();
  return normalized === "transparent" || /(?:,|\/)0(?:\.0+)?\)$/u.test(normalized);
};

export function resolvePageSurfaceBackground(target: HTMLElement) {
  let element: HTMLElement | null = target;
  while (element) {
    const background = window.getComputedStyle(element).backgroundColor;
    if (background && !isTransparentBackground(background)) return background;
    element = element.parentElement;
  }
  return tokens.color.semantic.canvas;
}

async function capturePageSurface(target: HTMLElement) {
  const { default: html2canvas } = await import("html2canvas");
  await target.ownerDocument.fonts?.ready;
  const bounds = target.getBoundingClientRect();
  const scale = pageTurnPixelRatio(window.devicePixelRatio || 1);
  const backgroundColor = resolvePageSurfaceBackground(target);
  const embeddedFrame = target.querySelector<HTMLIFrameElement>("iframe");
  const snapshot = await html2canvas(target, {
    backgroundColor,
    height: bounds.height,
    width: bounds.width,
    imageTimeout: 3_000,
    logging: false,
    scale,
    useCORS: true,
    ignoreElements: (element) => element === embeddedFrame
      || element.hasAttribute("data-page-turn-overlay")
      || element.hasAttribute("data-page-turn-shade"),
  });
  const frameDocument = embeddedFrame?.contentDocument;
  const snapshotContext = snapshot.getContext("2d");
  if (!embeddedFrame || !frameDocument?.documentElement || !snapshotContext) return snapshot;

  await frameDocument.fonts?.ready;
  const frameBounds = embeddedFrame.getBoundingClientRect();
  const frameSnapshot = await html2canvas(frameDocument.documentElement, {
    backgroundColor,
    height: frameBounds.height,
    width: frameBounds.width,
    imageTimeout: 3_000,
    logging: false,
    scale,
    scrollX: 0,
    scrollY: 0,
    useCORS: true,
    windowHeight: frameBounds.height,
    windowWidth: frameBounds.width,
  });
  snapshotContext.save();
  snapshotContext.setTransform(1, 0, 0, 1, 0, 0);
  snapshotContext.drawImage(
    frameSnapshot,
    (frameBounds.left - bounds.left) * scale,
    (frameBounds.top - bounds.top) * scale,
    frameBounds.width * scale,
    frameBounds.height * scale,
  );
  snapshotContext.restore();
  return snapshot;
}

async function runFallbackTurn({
  target,
  shade,
  direction,
  changePage,
  mountedRef,
}: {
  target: HTMLElement;
  shade: HTMLElement | null;
  direction: PageTurnDirection;
  changePage: () => void | Promise<void>;
  mountedRef: { current: boolean };
}) {
  const exit = target.animate(pageTurnKeyframes(direction, "EXIT"), {
    duration: FALLBACK_EXIT_DURATION_MS,
    easing: FALLBACK_EXIT_EASING,
    fill: "forwards",
  });
  const exitShade = shade?.animate(pageTurnShadeKeyframes(direction, "EXIT"), {
    duration: FALLBACK_EXIT_DURATION_MS,
    easing: FALLBACK_EXIT_EASING,
    fill: "forwards",
  });
  await finishAnimation(exit);
  if (!mountedRef.current) return;
  await changePage();
  if (!mountedRef.current) return;
  await afterNextPaint();
  exit.cancel();
  exitShade?.cancel();
  const enter = target.animate(pageTurnKeyframes(direction, "ENTER"), {
    duration: FALLBACK_ENTER_DURATION_MS,
    easing: FALLBACK_ENTER_EASING,
    fill: "both",
  });
  const enterShade = shade?.animate(pageTurnShadeKeyframes(direction, "ENTER"), {
    duration: FALLBACK_ENTER_DURATION_MS,
    easing: FALLBACK_ENTER_EASING,
    fill: "both",
  });
  await finishAnimation(enter);
  enter.cancel();
  enterShade?.cancel();
}

export function usePageTurnTransition(
  targetRef: RefObject<HTMLElement | null>,
  enabled = true,
  { spread = false, snapshotKey = "page" }: PageTurnTransitionOptions = {},
) {
  const runningRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const shadeAnimationRef = useRef<Animation | null>(null);
  const curlRendererRef = useRef<PageCurlRenderer | null>(null);
  const snapshotCacheRef = useRef<CachedPageSnapshot | null>(null);
  const latestSnapshotKeyRef = useRef(snapshotKey);
  const mountedRef = useRef(true);
  const [turning, setTurning] = useState(false);
  latestSnapshotKeyRef.current = snapshotKey;

  const cleanupCurl = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    shadeAnimationRef.current?.cancel();
    shadeAnimationRef.current = null;
    curlRendererRef.current?.dispose();
    curlRendererRef.current = null;
    const overlay = targetRef.current?.querySelector<HTMLCanvasElement>("[data-page-turn-overlay]");
    overlay?.style.removeProperty("opacity");
  }, [targetRef]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      snapshotCacheRef.current = null;
      cleanupCurl();
    };
  }, [cleanupCurl]);

  useEffect(() => {
    snapshotCacheRef.current = null;
    if (!enabled || typeof window.requestIdleCallback !== "function") return;
    let cancelled = false;
    const idleHandle = window.requestIdleCallback(() => {
      const target = targetRef.current;
      if (!target || runningRef.current) return;
      const bounds = target.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      void capturePageSurface(target).then((snapshot) => {
        if (cancelled || runningRef.current || latestSnapshotKeyRef.current !== snapshotKey) return;
        snapshotCacheRef.current = {
          key: snapshotKey,
          width: bounds.width,
          height: bounds.height,
          pixelRatio: snapshot.width / bounds.width,
          snapshot,
        };
      }).catch(() => undefined);
    }, { timeout: PAGE_SNAPSHOT_IDLE_TIMEOUT_MS });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(idleHandle);
    };
  }, [enabled, snapshotKey, targetRef]);

  const animateCurl = useCallback((curl: PageCurlRenderer) => new Promise<void>((resolve) => {
    const startedAt = performance.now();
    const step = (now: number) => {
      if (!mountedRef.current) {
        resolve();
        return;
      }
      const elapsed = Math.min(1, (now - startedAt) / CURL_DURATION_MS);
      curl.render(easePaperTurn(elapsed));
      if (elapsed < 1) frameRef.current = window.requestAnimationFrame(step);
      else {
        frameRef.current = null;
        resolve();
      }
    };
    frameRef.current = window.requestAnimationFrame(step);
  }), []);

  const turnPage = useCallback(async (direction: PageTurnDirection, changePage: () => void | Promise<void>) => {
    if (runningRef.current) return;
    const target = targetRef.current;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!enabled || !target || typeof target.animate !== "function" || reducedMotion) {
      await changePage();
      return;
    }

    runningRef.current = true;
    setTurning(true);
    const shade = target.querySelector<HTMLElement>("[data-page-turn-shade]");
    const overlay = target.querySelector<HTMLCanvasElement>("[data-page-turn-overlay]");
    let pageChanged = false;
    try {
      if (!overlay) throw new Error("翻页覆盖层不可用");
      const targetBounds = target.getBoundingClientRect();
      const currentPixelRatio = pageTurnPixelRatio(window.devicePixelRatio || 1);
      const cachedSnapshot = snapshotCacheRef.current;
      const cachedFrontSnapshot = cachedSnapshot
        && cachedSnapshot.key === snapshotKey
        && Math.abs(cachedSnapshot.width - targetBounds.width) < 1
        && Math.abs(cachedSnapshot.height - targetBounds.height) < 1
        && Math.abs(cachedSnapshot.pixelRatio - currentPixelRatio) < 0.01
        ? cachedSnapshot.snapshot
        : null;
      snapshotCacheRef.current = null;
      const [frontSnapshot, curlModule] = await Promise.all([
        cachedFrontSnapshot ? Promise.resolve(cachedFrontSnapshot) : capturePageSurface(target),
        import("./page-turn-curl"),
      ]);
      if (!mountedRef.current) return;
      const curl = curlModule.createPageCurlRenderer({ canvas: overlay, frontSnapshot, direction, spread });
      curlRendererRef.current = curl;
      curl.render(0);
      overlay.style.opacity = "1";
      await afterNextPaint();
      if (!mountedRef.current) return;

      await changePage();
      pageChanged = true;
      if (!mountedRef.current) return;
      await afterNextPaint();
      if (!mountedRef.current) return;
      const backSnapshotKey = latestSnapshotKeyRef.current;
      void capturePageSurface(target).then((backSnapshot) => {
        if (mountedRef.current && curlRendererRef.current === curl) curl.setBackSnapshot(backSnapshot);
        if (!mountedRef.current || latestSnapshotKeyRef.current !== backSnapshotKey) return;
        const bounds = target.getBoundingClientRect();
        snapshotCacheRef.current = {
          key: backSnapshotKey,
          width: bounds.width,
          height: bounds.height,
          pixelRatio: backSnapshot.width / bounds.width,
          snapshot: backSnapshot,
        };
      }).catch(() => {
        // The page still curls correctly with the front texture if a complex
        // embedded document cannot be captured for the paper's reverse side.
      });

      shadeAnimationRef.current = shade?.animate(pageCurlShadeKeyframes(direction), {
        duration: CURL_DURATION_MS,
        easing: "linear",
        fill: "both",
      }) ?? null;
      await animateCurl(curl);
    } catch {
      cleanupCurl();
      if (!pageChanged && mountedRef.current) {
        await runFallbackTurn({ target, shade, direction, changePage, mountedRef });
      }
    } finally {
      cleanupCurl();
      runningRef.current = false;
      if (mountedRef.current) setTurning(false);
    }
  }, [animateCurl, cleanupCurl, enabled, snapshotKey, spread, targetRef]);

  return { turnPage, turning };
}
