import { NavigateBeforeRounded } from "@/ui/icons";
import { NavigateNextRounded } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { CircularProgress } from "@/ui/feedback";
import { IconButton } from "@/ui/buttons";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import ePub, { type Book, type Contents, type NavItem, type Rendition } from "epubjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import type { Annotation } from "../../domain/types";
import { tokens } from "../../theme/generated-tokens";
import { readerWidthSx } from "../PageHeader";
import { applyEpubInlineAnnotation, clearEpubInlineAnnotations, EPUB_INLINE_ANNOTATION_CLASS, findEpubTextRange } from "./epub-annotations";
import { isEditableReaderTarget, isReaderSwipe } from "./reader-navigation";
import { PageTurnShade } from "./PageTurnShade";
import { readerSelectionFromRect, type ReaderSelection, type TocItem } from "./types";
import { useReaderPageLayout } from "./use-reader-page-layout";
import { usePageTurnTransition } from "./use-page-turn-transition";

interface Props {
  bookId: string;
  annotations: Annotation[];
  theme: { background: string; foreground: string; muted: string };
  fontSize: number;
  fontFamily: string;
  pageTurnEnabled?: boolean;
  fontSourceUrl?: string;
  contentUrl?: string;
  readOnly?: boolean;
  target?: string;
  onNavigation: (items: TocItem[]) => void;
  onSelect: (selection: ReaderSelection) => void;
  onPosition: (locator: string, progress: number) => void;
}

function renderedContents(rendition: Rendition) {
  // epub.js 0.3 declares a single Contents value, while every manager returns an array at runtime.
  return rendition.getContents() as unknown as Contents[];
}

export default function EpubDocumentReader({ bookId, annotations, theme, fontSize, fontFamily, pageTurnEnabled = true, fontSourceUrl, contentUrl, readOnly = false, target, onNavigation, onSelect, onPosition }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [renditionReady, setRenditionReady] = useState(false);
  const [renderedViewRevision, setRenderedViewRevision] = useState(0);
  const [readingProgress, setReadingProgress] = useState(0);
  const [error, setError] = useState("");
  const initialTargetRef = useRef(target);
  const currentLocatorRef = useRef<string | undefined>(target);
  const gestureCleanupsRef = useRef(new Map<Document, () => void>());
  const touchStartXRef = useRef<number | null>(null);
  const pageSurfaceRef = useRef<HTMLDivElement | null>(null);
  const pageLayout = useReaderPageLayout(pageSurfaceRef);
  const wideSpread = pageLayout?.spread ?? false;
  const annotationRevision = useMemo(
    () => annotations.map((annotation) => `${annotation.id}:${annotation.updatedAt ?? annotation.createdAt}:${annotation.style}:${annotation.color ?? ""}`).join(","),
    [annotations],
  );
  const pageSnapshotKey = `${bookId}:${renderedViewRevision}:${loading}:${wideSpread}:${theme.background}:${theme.foreground}:${fontSize}:${fontFamily}:${annotationRevision}`;
  const { turnPage, turning } = usePageTurnTransition(
    pageSurfaceRef,
    pageTurnEnabled,
    { spread: wideSpread, snapshotKey: pageSnapshotKey },
  );
  const goPrevious = useCallback(() => {
    if (!renditionRef.current) return;
    void turnPage("PREVIOUS", async () => { await renditionRef.current?.prev(); });
  }, [turnPage]);
  const goNext = useCallback(() => {
    if (!renditionRef.current) return;
    void turnPage("NEXT", async () => { await renditionRef.current?.next(); });
  }, [turnPage]);

  const installReaderFont = (contents: Contents) => {
    const document = contents.document;
    const existing = document.querySelector("style[data-page-reader-font]");
    existing?.remove();
    const style = document.createElement("style");
    style.dataset.pageReaderFont = "true";
    const familyName = fontFamily.match(/^"([^"]+)"/u)?.[1] ?? fontFamily.split(",")[0].trim();
    style.textContent = [
      '@import url("/fonts/noto-fonts.css");',
      '@font-face { font-family: "Source Han Serif SC"; src: url("/fonts/source-han-serif-sc-regular.woff2") format("woff2"); font-display: swap; }',
      '@font-face { font-family: "Source Han Sans SC"; src: url("/fonts/source-han-sans-sc-regular.woff2") format("woff2"); font-display: swap; }',
      '@font-face { font-family: "Alibaba PuHuiTi"; src: url("/fonts/alibaba-puhuiti-regular.woff2") format("woff2"); font-display: swap; }',
      fontSourceUrl ? `@font-face { font-family: "${familyName}"; src: url("${fontSourceUrl}"); font-display: swap; }` : "",
    ].join("\n");
    document.head.append(style);
    const existingGestureCleanup = gestureCleanupsRef.current.get(document);
    existingGestureCleanup?.();
    const onTouchStart = (event: TouchEvent) => { touchStartXRef.current = event.changedTouches[0]?.clientX ?? null; };
    const onTouchEnd = (event: TouchEvent) => {
      const endX = event.changedTouches[0]?.clientX;
      if (endX === undefined || !isReaderSwipe(touchStartXRef.current, endX)) return;
      const startX = touchStartXRef.current;
      touchStartXRef.current = null;
      if (startX !== null && endX < startX) goNext();
      else goPrevious();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableReaderTarget(event.target)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    gestureCleanupsRef.current.set(document, () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("keydown", onKeyDown);
    });
  };

  const applyRenditionStyles = (rendition: Rendition) => {
    rendition.themes.register("page", {
      body: {
        color: `${theme.foreground} !important`,
        background: `${theme.background} !important`,
        "font-family": `${fontFamily} !important`,
        "line-height": "1.9 !important",
        padding: `0 ${tokens.spacing[5]}px !important`,
        "box-sizing": "border-box !important",
      },
      "p, h1, h2, h3, blockquote": {
        "max-width": `${tokens.layout.readingMax}px !important`,
        "margin-left": "auto !important",
        "margin-right": "auto !important",
      },
      a: { color: `${tokens.color.semantic.primary} !important` },
      "::selection": { background: `${tokens.color.semantic.primarySoft} !important` },
    });
    rendition.themes.select("page");
    rendition.themes.fontSize(`${Math.round((fontSize / 19) * 100)}%`);
    renderedContents(rendition).forEach((contents) => installReaderFont(contents));
  };

  useEffect(() => {
    if (!hostRef.current) return;
    setRenditionReady(false);
    let disposed = false;
    let book: Book | undefined;
    let rendition: Rendition | undefined;

    void (async () => {
      const response = await fetch(contentUrl ?? `/api/v1/books/${bookId}/content`, { credentials: "include" });
      if (!response.ok) throw new Error("无法读取 EPUB 文件");
      const data = await response.arrayBuffer();
      if (disposed || !hostRef.current) return;

      book = ePub(data);
      rendition = book.renderTo(hostRef.current, {
        width: "100%",
        height: "100%",
        flow: "paginated",
        spread: "none",
        minSpreadWidth: 1,
        allowScriptedContent: false,
      });
      renditionRef.current = rendition;
      applyRenditionStyles(rendition);

      rendition.on("selected", (cfiRange: string, contents: Contents) => {
        const nativeSelection = contents.window.getSelection();
        const quote = nativeSelection?.toString().trim() ?? "";
        if (!quote || quote.length > 600 || !nativeSelection?.rangeCount) return;
        const rect = nativeSelection.getRangeAt(0).getBoundingClientRect();
        const frameRect = contents.window.frameElement?.getBoundingClientRect()
          ?? hostRef.current?.querySelector("iframe")?.getBoundingClientRect();
        onSelect(readerSelectionFromRect({ quote, locator: cfiRange, rect, frameRect }));
      });
      rendition.on("rendered", () => setRenderedViewRevision((revision) => revision + 1));
      rendition.on("relocated", (location: { start: { cfi: string; percentage?: number } }) => {
        currentLocatorRef.current = location.start.cfi;
        let measuredProgress = location.start.percentage ?? 0;
        try {
          if (book && book.locations.length() > 0) measuredProgress = book.locations.percentageFromCfi(location.start.cfi);
        } catch {
          // Keep the rendition-provided percentage when a malformed CFI cannot be measured.
        }
        const progress = Math.max(0, Math.min(1, measuredProgress));
        setReadingProgress(progress);
        onPosition(location.start.cfi, progress);
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          if (!readOnly) void api.saveReadingPosition(bookId, location.start.cfi, progress).catch(() => undefined);
        }, 350);
      });

      void book.loaded.navigation.then((navigation) => {
        const flatten = (items: NavItem[], depth = 0): TocItem[] => items.flatMap((item) => [
          { href: item.href, label: item.label.trim(), depth },
          ...flatten(item.subitems ?? [], depth + 1),
        ]);
        if (!disposed) onNavigation(flatten(navigation.toc));
      });

      await book.ready;
      await book.locations.generate(128);
      const initialTarget = initialTargetRef.current;
      const position = readOnly ? null : await api.getReadingPosition(bookId);
      if (initialTarget) {
        try {
          await rendition.display(initialTarget);
        } catch {
          if (position) {
            try {
              await rendition.display(position.locator);
            } catch {
              await rendition.display(book.locations.cfiFromPercentage(position.progress));
            }
          } else {
            await rendition.display();
          }
        }
      } else if (position) {
        try {
          await rendition.display(position.locator);
        } catch {
          await rendition.display(book.locations.cfiFromPercentage(position.progress));
        }
      } else {
        await rendition.display();
      }
      if (!disposed) {
        setRenditionReady(true);
        setLoading(false);
      }
    })().catch((reason) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : "无法打开 EPUB");
    });

    return () => {
      disposed = true;
      window.clearTimeout(saveTimer.current);
      gestureCleanupsRef.current.forEach((cleanup) => cleanup());
      gestureCleanupsRef.current.clear();
      renditionRef.current = null;
      rendition?.destroy();
      book?.destroy();
    };
  }, [bookId, contentUrl, onNavigation, onPosition, onSelect, readOnly]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableReaderTarget(event.target)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrevious]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    const locator = currentLocatorRef.current;
    applyRenditionStyles(rendition);
    rendition.resize(hostRef.current?.clientWidth ?? 0, hostRef.current?.clientHeight ?? 0);
    if (locator) void rendition.display(locator).catch(() => undefined);
  }, [fontFamily, fontSize, fontSourceUrl, theme.background, theme.foreground]);

  useEffect(() => {
    const rendition = renditionRef.current;
    const host = hostRef.current;
    if (!rendition || !host || !renditionReady) return;
    const locator = currentLocatorRef.current;
    rendition.spread(wideSpread ? "always" : "none", 1);
    rendition.resize(host.clientWidth, host.clientHeight);
    if (locator) void rendition.display(locator).catch(() => undefined);
  }, [renditionReady, wideSpread]);

  useEffect(() => {
    const host = hostRef.current;
    const rendition = renditionRef.current;
    if (!host || !rendition || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const locator = currentLocatorRef.current;
        rendition.resize(host.clientWidth, host.clientHeight);
        if (locator) void rendition.display(locator).catch(() => undefined);
      });
    });
    observer.observe(host);
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [renditionReady]);

  useEffect(() => {
    if (!renditionReady || !renditionRef.current) return;
    renderedContents(renditionRef.current).forEach((contents) => installReaderFont(contents));
  }, [fontSourceUrl, fontFamily, renditionReady]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !renditionReady) return;

    renderedContents(rendition).forEach((contents) => clearEpubInlineAnnotations(contents.document));
    annotations.forEach((annotation) => {
      if (!annotation.locator || annotation.type === "BOOKMARK") return;
      try {
        const cfiRange = rendition.getRange(annotation.locator, EPUB_INLINE_ANNOTATION_CLASS);
        if (!cfiRange) return;
        const rangeDocument = cfiRange.startContainer.ownerDocument;
        const range = cfiRange.collapsed && annotation.quote && rangeDocument
          ? findEpubTextRange(rangeDocument, annotation.quote)
          : cfiRange;
        if (range) applyEpubInlineAnnotation(range, annotation);
      } catch {
        // Ignore stale or externally changed CFI ranges while keeping the book readable.
      }
    });

    return () => {
      renderedContents(rendition).forEach((contents) => clearEpubInlineAnnotations(contents.document));
    };
  }, [annotations, renderedViewRevision, renditionReady]);

  useEffect(() => {
    if (target) void renditionRef.current?.display(target);
  }, [target]);

  if (error) return <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center", p: 3 }}><Alert severity="error">{error}</Alert></Stack>;

  return (
    <Box className="reader-viewport" sx={{ position: "relative", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: theme.background }}>
      {loading && <Stack spacing={1.5} sx={{ position: "absolute", inset: 0, zIndex: 2, alignItems: "center", justifyContent: "center", bgcolor: theme.background }}><CircularProgress size={30} /><Typography sx={{ color: theme.muted }}>正在排版 EPUB…</Typography></Stack>}
      <Box ref={pageSurfaceRef} className="reader-page-turn-surface" data-reader-spread={wideSpread} sx={{ position: "relative", ...readerWidthSx, flex: "1 1 auto", minHeight: 0, overflow: "hidden", bgcolor: theme.background, backfaceVisibility: "hidden", transformStyle: "preserve-3d", willChange: turning ? "transform, opacity, filter, clip-path" : "auto" }}>
        <Box ref={hostRef} sx={{ width: "100%", height: "100%", overflow: "hidden", "& iframe": { border: 0 } }} />
        <PageTurnShade />
      </Box>
      <Stack component="nav" aria-label="EPUB 翻页" direction="row" spacing={1} sx={{ ...readerWidthSx, flex: `0 0 ${tokens.layout.readerControlHeight}px`, minHeight: tokens.layout.readerControlHeight, alignItems: "center", justifyContent: "center", overflowX: "auto", borderTop: 1, borderColor: "divider", bgcolor: theme.background, color: theme.foreground }}>
        <IconButton color="inherit" aria-label="EPUB 上一页" disabled={loading || turning} onClick={goPrevious} sx={{ width: tokens.layout.touchTarget, height: tokens.layout.touchTarget }}><NavigateBeforeRounded /></IconButton>
        <Typography variant="caption" sx={{ minWidth: 0, flex: "1 1 auto", textAlign: "center", whiteSpace: "nowrap", color: theme.muted }}>已读 {Math.round(readingProgress * 100)}% · 左右滑动翻页</Typography>
        <IconButton color="inherit" aria-label="EPUB 下一页" disabled={loading || turning} onClick={goNext} sx={{ width: tokens.layout.touchTarget, height: tokens.layout.touchTarget }}><NavigateNextRounded /></IconButton>
      </Stack>
    </Box>
  );
}
