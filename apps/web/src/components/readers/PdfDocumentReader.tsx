import { AddRounded } from "@/ui/icons";
import { NavigateBeforeRounded } from "@/ui/icons";
import { NavigateNextRounded } from "@/ui/icons";
import { RemoveRounded } from "@/ui/icons";
import { Alert } from "@/ui";
import { Box } from "@/ui";
import { Button } from "@/ui";
import { ButtonBase } from "@/ui";
import { CircularProgress } from "@/ui";
import { IconButton } from "@/ui";
import { Popover } from "@/ui";
import { Stack } from "@/ui";
import { Typography } from "@/ui";
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject, type TouchEvent } from "react";
import { api } from "../../api/client";
import type { Annotation } from "../../domain/types";
import { tokens } from "../../theme/generated-tokens";
import { applyPdfTextAnnotations } from "./pdf-annotations";
import { pdfTextToReadingBlocks, splitPdfInlineFootnoteReferences, type PdfReadingBlock } from "./pdf-reading-text";
import { READER_CONTENT_HEIGHT, READER_PAGE_HEIGHT } from "./reader-layout";
import { isEditableReaderTarget, isReaderSwipe } from "./reader-navigation";
import { PageTurnShade } from "./PageTurnShade";
import { readerSelectionFromRect, type ReaderSelection } from "./types";
import { usePageTurnTransition } from "./use-page-turn-transition";

GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfViewMode = "READING" | "ORIGINAL";

interface ActivePdfFootnote {
  marker: string;
  anchor: HTMLElement;
  loading: boolean;
  text?: string;
  sourcePage?: number;
}

interface PdfFootnoteResult {
  text: string;
  pageNumber: number;
}

export function previousPdfLocation({
  pageNumber,
  virtualPageIndex,
  previousVirtualPageCount,
}: {
  pageNumber: number;
  virtualPageIndex: number;
  previousVirtualPageCount?: number;
}) {
  if (virtualPageIndex > 0) {
    return { pageNumber, virtualPageIndex: virtualPageIndex - 1, waitForPageCount: false };
  }
  if (pageNumber <= 1) {
    return { pageNumber, virtualPageIndex: 0, waitForPageCount: false };
  }
  return {
    pageNumber: pageNumber - 1,
    virtualPageIndex: Math.max(0, (previousVirtualPageCount ?? 1) - 1),
    waitForPageCount: previousVirtualPageCount === undefined,
  };
}

export default function PdfDocumentReader({ bookId, annotations, theme, fontSize, fontFamily, pageTurnEnabled = true, fontSourceUrl, contentUrl, readOnly = false, target, onSelect, onPosition }: {
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
  onSelect: (selection: ReaderSelection) => void;
  onPosition: (locator: string, progress: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [virtualPageIndex, setVirtualPageIndex] = useState(0);
  const [virtualPageCount, setVirtualPageCount] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [viewMode] = useState<PdfViewMode>("READING");
  const [readingBlocks, setReadingBlocks] = useState<PdfReadingBlock[]>([]);
  const [textLoading, setTextLoading] = useState(true);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(true);
  const readingTextRef = useRef<HTMLDivElement | null>(null);
  const textCacheRef = useRef(new Map<number, PdfReadingBlock[]>());
  const footnoteCacheRef = useRef(new Map<string, PdfFootnoteResult | null>());
  const footnoteRequestRef = useRef(0);
  const footnoteOriginRef = useRef(new Map<string, string>());
  const [activeFootnote, setActiveFootnote] = useState<ActivePdfFootnote | null>(null);
  const [wideSpread, setWideSpread] = useState(false);
  const [pendingPreviousPageNumber, setPendingPreviousPageNumber] = useState<number | null>(null);
  const [displayedPosition, setDisplayedPosition] = useState({
    pageNumber: 1,
    virtualPageIndex: 0,
    virtualPageCount: 1,
  });
  const initialTargetRef = useRef(target);
  const touchStartXRef = useRef<number | null>(null);
  const readingSurfaceRef = useRef<HTMLDivElement | null>(null);
  const virtualPageCountsRef = useRef(new Map<number, number>());
  const pendingPreviousPageNumberRef = useRef<number | null>(null);
  const previousPageReadyResolverRef = useRef<(() => void) | null>(null);
  const annotationRevision = useMemo(
    () => annotations.map((annotation) => `${annotation.id}:${annotation.updatedAt ?? annotation.createdAt}:${annotation.style}:${annotation.color ?? ""}`).join(","),
    [annotations],
  );
  const pageSnapshotKey = `${bookId}:${pageNumber}:${virtualPageIndex}:${virtualPageCount}:${textLoading}:${wideSpread}:${theme.background}:${theme.foreground}:${fontSize}:${fontFamily}:${annotationRevision}`;
  const { turnPage, turning } = usePageTurnTransition(
    readingSurfaceRef,
    pageTurnEnabled,
    { spread: wideSpread, snapshotKey: pageSnapshotKey },
  );

  useEffect(() => {
    if (turning) return;
    setDisplayedPosition({ pageNumber, virtualPageIndex, virtualPageCount });
  }, [pageNumber, turning, virtualPageCount, virtualPageIndex]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(`(min-width: ${tokens.layout.breakpointTablet}px)`);
    const update = () => setWideSpread(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let disposed = false;
    textCacheRef.current.clear();
    virtualPageCountsRef.current.clear();
    pendingPreviousPageNumberRef.current = null;
    previousPageReadyResolverRef.current?.();
    previousPageReadyResolverRef.current = null;
    footnoteCacheRef.current.clear();
    footnoteOriginRef.current.clear();
    setActiveFootnote(null);
    setDocument(null);
    setPageNumber(1);
    setVirtualPageIndex(0);
    setVirtualPageCount(1);
    setPendingPreviousPageNumber(null);
    setReadingBlocks([]);
    setTextLoading(true);
    setError("");
    const task = getDocument({ url: contentUrl ?? `/api/v1/books/${bookId}/content`, withCredentials: true, rangeChunkSize: 1024 * 1024 });
    void Promise.all([task.promise, readOnly ? Promise.resolve(null) : api.getReadingPosition(bookId)]).then(([loaded, position]) => {
      if (disposed) return;
      setDocument(loaded);
      const locator = initialTargetRef.current ?? position?.locator;
      const match = locator?.match(/^pdf:page=(\d+)(?:&offset=(\d+))?/);
      if (match) {
        setPageNumber(Math.min(loaded.numPages, Math.max(1, Number(match[1]))));
        setVirtualPageIndex(Math.max(0, Number(match[2] ?? 0)));
      }
    }).catch((reason) => { if (!disposed) setError(reason instanceof Error ? reason.message : "无法打开 PDF"); });
    return () => {
      disposed = true;
      pendingPreviousPageNumberRef.current = null;
      previousPageReadyResolverRef.current?.();
      previousPageReadyResolverRef.current = null;
      void task.destroy();
    };
  }, [bookId, contentUrl, readOnly]);

  useEffect(() => {
    if (viewMode !== "ORIGINAL" || !document || !canvasRef.current || !textLayerRef.current) return;
    let disposed = false;
    let renderTask: RenderTask | undefined;
    let textLayer: TextLayer | undefined;
    setRendering(true);
    void document.getPage(pageNumber).then(async (page) => {
      if (disposed || !canvasRef.current || !textLayerRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("浏览器无法创建 PDF 画布");
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({ canvas: null, canvasContext: context, viewport, transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0] });
      await renderTask.promise;
      if (disposed) return;
      const layer = textLayerRef.current;
      layer.replaceChildren();
      layer.style.width = `${viewport.width}px`;
      layer.style.height = `${viewport.height}px`;
      layer.style.setProperty("--scale-factor", String(viewport.scale));
      textLayer = new TextLayer({ textContentSource: await page.getTextContent(), container: layer, viewport });
      await textLayer.render();
      applyPdfTextAnnotations(layer, pageNumber, annotations, { overlaysCanvasText: true });
      if (!disposed) setRendering(false);
    }).catch((reason) => { if (!disposed && reason?.name !== "RenderingCancelledException") setError(reason instanceof Error ? reason.message : "PDF 页面渲染失败"); });
    return () => { disposed = true; renderTask?.cancel(); textLayer?.cancel(); };
  }, [annotations, document, pageNumber, scale, viewMode]);

  useEffect(() => {
    if (viewMode !== "READING" || !document) return;
    let disposed = false;
    setTextLoading(true);
    void Promise.all([pageNumber].map(async (visiblePageNumber) => {
      const cached = textCacheRef.current.get(visiblePageNumber);
      if (cached) return cached;
      const page = await document.getPage(visiblePageNumber);
      const content = await page.getTextContent();
      const blocks = pdfTextToReadingBlocks(content.items);
      textCacheRef.current.set(visiblePageNumber, blocks);
      return blocks;
    })).then((pages) => {
      if (disposed) return;
      setReadingBlocks(pages[0] ?? []);
      setTextLoading(false);
    }).catch((reason) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : "PDF 文字解析失败");
    });
    return () => { disposed = true; };
  }, [document, pageNumber, viewMode]);

  useEffect(() => {
    if (viewMode !== "READING" || textLoading) return;
    if (readingTextRef.current) applyPdfTextAnnotations(readingTextRef.current, pageNumber, annotations);
  }, [annotations, document, pageNumber, readingBlocks, textLoading, viewMode]);

  useEffect(() => {
    if (!document || pendingPreviousPageNumber !== null) return;
    const locator = `pdf:page=${pageNumber}&offset=${virtualPageIndex}`;
    const progress = Math.max(0, Math.min(1, (pageNumber - 1 + (virtualPageIndex + 0.5) / Math.max(1, virtualPageCount)) / document.numPages));
    onPosition(locator, progress);
    if (!readOnly) void api.saveReadingPosition(bookId, locator, progress).catch(() => undefined);
  }, [bookId, document, onPosition, pageNumber, pendingPreviousPageNumber, readOnly, virtualPageCount, virtualPageIndex]);

  const captureSelection = (sourcePageNumber = pageNumber) => {
    const nativeSelection = window.getSelection();
    const quote = nativeSelection?.toString().trim() ?? "";
    if (!quote || quote.length > 600 || !nativeSelection?.rangeCount) return;
    const rect = nativeSelection.getRangeAt(0).getBoundingClientRect();
    onSelect(readerSelectionFromRect({ quote, locator: `pdf:page=${sourcePageNumber}&offset=${virtualPageIndex}`, rect }));
  };

  const openFootnote = (marker: string, anchor: HTMLElement, originId: string, sourcePageNumber: number, sourceBlocks: PdfReadingBlock[]) => {
    footnoteOriginRef.current.set(marker, originId);
    const local = sourceBlocks.find((block): block is Extract<PdfReadingBlock, { kind: "footnote" }> => block.kind === "footnote" && block.marker === marker);
    if (local) {
      setActiveFootnote({ marker, anchor, loading: false, text: local.text, sourcePage: sourcePageNumber });
      return;
    }

    const cacheKey = `${sourcePageNumber}:${marker}`;
    if (footnoteCacheRef.current.has(cacheKey)) {
      const cached = footnoteCacheRef.current.get(cacheKey);
      setActiveFootnote({ marker, anchor, loading: false, text: cached?.text, sourcePage: cached?.pageNumber });
      return;
    }

    setActiveFootnote({ marker, anchor, loading: true, sourcePage: sourcePageNumber });
    const requestId = footnoteRequestRef.current + 1;
    footnoteRequestRef.current = requestId;
    void findPdfFootnote(document, sourcePageNumber, marker, textCacheRef.current).then((result) => {
      footnoteCacheRef.current.set(cacheKey, result);
      if (footnoteRequestRef.current !== requestId) return;
      setActiveFootnote({ marker, anchor, loading: false, text: result?.text, sourcePage: result?.pageNumber });
    }).catch(() => {
      if (footnoteRequestRef.current === requestId) setActiveFootnote({ marker, anchor, loading: false });
    });
  };

  const returnToFootnoteReference = (marker: string) => {
    const referenceId = footnoteOriginRef.current.get(marker);
    const reference = referenceId ? window.document.getElementById(referenceId) : null;
    reference?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (pendingPreviousPageNumber !== null || !previousPageReadyResolverRef.current) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const resolve = previousPageReadyResolverRef.current;
        previousPageReadyResolverRef.current = null;
        resolve?.();
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [pendingPreviousPageNumber, virtualPageIndex]);

  const handleVirtualPageCountChange = useCallback((count: number) => {
    const nextCount = Math.max(1, count);
    virtualPageCountsRef.current.set(pageNumber, nextCount);
    setVirtualPageCount(nextCount);
    if (pendingPreviousPageNumberRef.current === pageNumber) {
      pendingPreviousPageNumberRef.current = null;
      setVirtualPageIndex(nextCount - 1);
      setPendingPreviousPageNumber(null);
      return;
    }
    setVirtualPageIndex((current) => Math.min(current, nextCount - 1));
  }, [pageNumber]);

  const canPrevious = virtualPageIndex > 0 || pageNumber > 1;
  const canNext = Boolean(document) && (virtualPageIndex < virtualPageCount - 1 || pageNumber < (document?.numPages ?? pageNumber));
  const changeToPreviousPage = useCallback(() => {
    const previousPageNumber = pageNumber - 1;
    const destination = previousPdfLocation({
      pageNumber,
      virtualPageIndex,
      previousVirtualPageCount: virtualPageCountsRef.current.get(previousPageNumber),
    });
    if (destination.pageNumber === pageNumber) {
      setVirtualPageIndex(destination.virtualPageIndex);
      return;
    }

    setPageNumber(destination.pageNumber);
    setVirtualPageIndex(destination.virtualPageIndex);
    const knownPageCount = virtualPageCountsRef.current.get(destination.pageNumber);
    setVirtualPageCount(knownPageCount ?? 1);
    if (!destination.waitForPageCount) {
      pendingPreviousPageNumberRef.current = null;
      return;
    }

    pendingPreviousPageNumberRef.current = destination.pageNumber;
    setPendingPreviousPageNumber(destination.pageNumber);
    return new Promise<void>((resolve) => {
      previousPageReadyResolverRef.current = resolve;
    });
  }, [pageNumber, virtualPageIndex]);
  const changeToNextPage = useCallback(() => {
    if (virtualPageIndex < virtualPageCount - 1) setVirtualPageIndex((value) => value + 1);
    else if (document && pageNumber < document.numPages) {
      const nextPageNumber = Math.min(document.numPages, pageNumber + 1);
      setPageNumber(nextPageNumber);
      setVirtualPageIndex(0);
      setVirtualPageCount(virtualPageCountsRef.current.get(nextPageNumber) ?? 1);
    }
  }, [document, pageNumber, virtualPageCount, virtualPageIndex]);
  const goPrevious = useCallback(() => {
    if (canPrevious) void turnPage("PREVIOUS", changeToPreviousPage);
  }, [canPrevious, changeToPreviousPage, turnPage]);
  const goNext = useCallback(() => {
    if (canNext) void turnPage("NEXT", changeToNextPage);
  }, [canNext, changeToNextPage, turnPage]);

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

  const handleTouchStart = (event: TouchEvent) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (event: TouchEvent) => {
    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined || !isReaderSwipe(touchStartXRef.current, endX)) return;
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX !== null && endX < startX) goNext();
    else goPrevious();
  };

  if (error) return <Stack sx={{ minHeight: READER_CONTENT_HEIGHT, alignItems: "center", justifyContent: "center", p: 3 }}><Alert severity="error">{error}</Alert></Stack>;

  return (
    <Stack className="reader-viewport" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} sx={{ height: READER_CONTENT_HEIGHT, minHeight: 0, overflow: "hidden", bgcolor: viewMode === "ORIGINAL" ? theme.foreground : theme.background, color: viewMode === "ORIGINAL" ? theme.background : theme.foreground }}>
      {fontSourceUrl && <style>{`@font-face { font-family: ${fontFamily.split(",")[0]}; src: url("${fontSourceUrl}"); font-display: swap; }`}</style>}
      {viewMode === "READING" ? (
        <Box ref={readingSurfaceRef} className="reader-page-turn-surface" sx={{ position: "relative", width: "100%", maxWidth: wideSpread ? tokens.layout.contentMax : tokens.layout.readingMax, height: READER_PAGE_HEIGHT, minHeight: 0, mx: "auto", overflow: "hidden", px: { xs: 0, sm: 1, md: 2 }, bgcolor: theme.background, backfaceVisibility: "hidden", transformStyle: "preserve-3d", willChange: turning ? "transform, opacity, filter, clip-path" : "auto" }}>
          <PdfReadingClipFrame>
            {textLoading
              ? <Stack spacing={1.5} sx={{ height: "100%", alignItems: "center", justifyContent: "center" }}><CircularProgress size={30} /><Typography sx={{ color: theme.muted }}>正在解析第 {pageNumber} 页文字…</Typography></Stack>
              : readingBlocks.length === 0 && document
                ? <PdfImagePage document={document} pageNumber={pageNumber} muted={theme.muted} />
                : <PdfPagedText textRef={readingTextRef} blocks={readingBlocks} pageNumber={pageNumber} theme={theme} fontFamily={fontFamily} fontSize={fontSize} wideSpread={wideSpread} pageIndex={virtualPageIndex} onPageCountChange={handleVirtualPageCountChange} onOpenFootnote={openFootnote} onReturnToReference={returnToFootnoteReference} onCaptureSelection={() => captureSelection(pageNumber)} />}
          </PdfReadingClipFrame>
          <PageTurnShade />
        </Box>
      ) : (
        <Box sx={{ position: "relative", alignSelf: "center", my: { xs: 2, md: 4 }, boxShadow: "0 12px 50px rgba(0,0,0,.26)", overflow: "hidden" }} onMouseUp={() => captureSelection()} onTouchEnd={() => captureSelection()}>
          <canvas ref={canvasRef} />
          <Box ref={textLayerRef} className="textLayer" sx={{ position: "absolute", inset: 0 }} />
          {rendering && <Stack sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", bgcolor: "rgba(255,255,255,.78)" }}><CircularProgress size={30} /></Stack>}
        </Box>
      )}
      <Stack component="nav" aria-label="PDF 翻页" className="pdf-reader-pagination" direction="row" spacing={1} sx={{ flex: `0 0 ${tokens.layout.readerControlHeight}px`, minHeight: tokens.layout.readerControlHeight, alignItems: "center", justifyContent: "center", overflowX: "auto", px: { xs: 1, sm: 2 }, py: 0.75, bgcolor: theme.background, color: theme.foreground, borderTop: "1px solid", borderColor: "divider" }}>
        <IconButton color="inherit" aria-label="PDF 上一页" disabled={turning || !canPrevious} onClick={goPrevious}><NavigateBeforeRounded /></IconButton>
        <Typography variant="body2" sx={{ minWidth: { xs: 120, sm: 180 }, textAlign: "center", color: theme.muted }}>{document ? `第 ${displayedPosition.pageNumber} 页 · ${displayedPosition.virtualPageIndex + 1}/${displayedPosition.virtualPageCount} · 共 ${document.numPages} 页` : "正在打开 PDF…"}</Typography>
        <IconButton color="inherit" aria-label="PDF 下一页" disabled={turning || !canNext} onClick={goNext}><NavigateNextRounded /></IconButton>
        {viewMode === "ORIGINAL" && <>
          <Box sx={{ width: { xs: 0, sm: 8 } }} />
          <IconButton color="inherit" aria-label="缩小 PDF" disabled={scale <= 0.75} onClick={() => setScale((value) => Math.max(0.75, value - 0.25))}><RemoveRounded /></IconButton>
          <Typography variant="caption" sx={{ display: { xs: "none", sm: "block" }, color: "#C8C0B5" }}>{Math.round(scale * 100)}%</Typography>
          <IconButton color="inherit" aria-label="放大 PDF" disabled={scale >= 2.5} onClick={() => setScale((value) => Math.min(2.5, value + 0.25))}><AddRounded /></IconButton>
        </>}
      </Stack>
      <Popover
        open={Boolean(activeFootnote)}
        anchorEl={activeFootnote?.anchor}
        onClose={() => setActiveFootnote(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        marginThreshold={tokens.spacing[2]}
        slotProps={{ paper: { sx: { width: tokens.layout.breakpointMobile - tokens.spacing[24], maxWidth: `calc(100vw - ${tokens.spacing[8]}px)`, borderRadius: `${tokens.radius.xl}px`, boxShadow: tokens.shadow.popover } } }}
      >
        <Box role="note" aria-label={activeFootnote ? `文中注释 ${activeFootnote.marker}` : "文中注释"} sx={{ p: `${tokens.spacing[5]}px` }}>
          <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", gap: `${tokens.spacing[4]}px`, mb: `${tokens.spacing[3]}px` }}>
            <Typography variant="overline" sx={{ color: "primary.main", fontWeight: tokens.typography.fontWeight.semibold }}>文中注释 {activeFootnote?.marker}</Typography>
            {activeFootnote?.sourcePage && <Typography variant="caption" color="text.secondary">原注释第 {activeFootnote.sourcePage} 页</Typography>}
          </Stack>
          <Box aria-live="polite" sx={{ minHeight: tokens.spacing[6] }}>
            {activeFootnote?.loading
              ? <Stack direction="row" sx={{ alignItems: "center", gap: `${tokens.spacing[3]}px` }}><CircularProgress size={tokens.spacing[5]} /><Typography variant="body2">正在查找对应注释…</Typography></Stack>
              : <Typography sx={{ fontFamily: tokens.typography.fontFamily.display, fontSize: tokens.typography.fontSize.body, lineHeight: tokens.typography.lineHeight.body }}>{activeFootnote?.text ?? "未在后续页面找到对应注释。"}</Typography>}
          </Box>
          <Stack direction="row" sx={{ justifyContent: "flex-end", mt: `${tokens.spacing[4]}px` }}><Button size="small" onClick={() => setActiveFootnote(null)}>返回原文</Button></Stack>
        </Box>
      </Popover>
    </Stack>
  );
}

export function PdfReadingClipFrame({ children }: { children: ReactNode }) {
  return <Box className="pdf-reading-clip-frame" sx={{ height: "100%", minHeight: 0, width: "100%", overflow: "hidden" }}>{children}</Box>;
}

function PdfPagedText({ textRef, blocks, pageNumber, theme, fontFamily, fontSize, wideSpread, pageIndex, onPageCountChange, onOpenFootnote, onReturnToReference, onCaptureSelection }: {
  textRef: RefObject<HTMLDivElement | null>;
  blocks: PdfReadingBlock[];
  pageNumber: number;
  theme: { background: string; foreground: string; muted: string };
  fontFamily: string;
  fontSize: number;
  wideSpread: boolean;
  pageIndex: number;
  onPageCountChange: (count: number) => void;
  onOpenFootnote: (marker: string, anchor: HTMLElement, originId: string, sourcePageNumber: number, sourceBlocks: PdfReadingBlock[]) => void;
  onReturnToReference: (marker: string) => void;
  onCaptureSelection: () => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const visibleColumns = wideSpread ? 2 : 1;
  const gap = tokens.layout.readerPageGap;
  const [columnWidth, setColumnWidth] = useState<number | null>(null);
  const [columnGap, setColumnGap] = useState<number>(gap);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measureColumnWidth = () => {
      const styles = window.getComputedStyle(frame);
      const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
      const padding = (Number.parseFloat(styles.paddingLeft) || 0) + paddingRight;
      const contentWidth = Math.max(1, frame.clientWidth - padding);
      // Keep the next CSS column outside the clipped page frame. The reader
      // uses padding for the page margin, so the column gap must be at least
      // that margin or the next virtual page can peek into the current one.
      const nextGap = Math.max(gap, paddingRight + tokens.spacing[2]);
      const nextWidth = Math.max(1, Math.floor((contentWidth - (visibleColumns - 1) * nextGap) / visibleColumns));
      setColumnGap((current) => current === nextGap ? current : nextGap);
      setColumnWidth((current) => current === nextWidth ? current : nextWidth);
    };
    measureColumnWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureColumnWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [gap, visibleColumns]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || columnWidth === null) return;
    let animationFrame = 0;
    const measure = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const totalColumns = Math.max(1, Math.round((frame.scrollWidth + columnGap) / (columnWidth + columnGap)));
        onPageCountChange(Math.max(1, Math.ceil(totalColumns / visibleColumns)));
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => { observer.disconnect(); window.cancelAnimationFrame(animationFrame); };
  }, [blocks, columnGap, columnWidth, fontFamily, fontSize, onPageCountChange, visibleColumns]);

  const pageStride = columnWidth === null ? 0 : visibleColumns * (columnWidth + columnGap);

  return (
    <Box
      ref={(node: HTMLDivElement | null) => {
        frameRef.current = node;
        textRef.current = node;
      }}
      component="article"
      aria-label={`PDF 第 ${pageNumber} 页阅读正文`}
      onMouseUp={onCaptureSelection}
      onTouchEnd={onCaptureSelection}
      className="reader-paged-text"
      sx={{
        height: "100%",
        width: "100%",
        overflow: "visible",
        transform: columnWidth === null ? `translateX(-${pageIndex * 100}%)` : `translateX(-${pageIndex * pageStride}px)`,
        transition: "none",
        // Let the browser create only as many full-width columns as the text
        // needs. A fixed column count made each column just a few pixels wide
        // on narrow reader viewports, which made horizontal Chinese text look
        // like vertical writing.
        columnCount: "auto",
        columnWidth: columnWidth === null ? "auto" : `${columnWidth}px`,
        columnGap: `${columnGap}px`,
        columnFill: "auto",
        direction: "ltr",
        writingMode: "horizontal-tb",
        textOrientation: "mixed",
        unicodeBidi: "normal",
        px: { xs: `${tokens.spacing[5]}px`, sm: `${tokens.spacing[10]}px`, md: `${tokens.spacing[12]}px` },
        pt: { xs: `${tokens.spacing[6]}px`, md: `${tokens.spacing[10]}px` },
        pb: `${tokens.spacing[6]}px`,
        color: theme.foreground,
        background: theme.background,
        fontFamily,
        fontSize,
        lineHeight: tokens.typography.lineHeight.body,
        "& > *": { breakInside: "auto" },
        "& h2, & aside": { breakInside: "avoid" },
      }}
    >
      {blocks.map((block, index) => <PdfReadingBlockView block={block} index={index} pageNumber={pageNumber} readingBlocks={blocks} onOpenFootnote={onOpenFootnote} onReturnToReference={onReturnToReference} key={`${pageNumber}-${index}`} />)}
    </Box>
  );
}

function PdfReadingBlockView({ block, index, pageNumber, readingBlocks, onOpenFootnote, onReturnToReference }: { block: PdfReadingBlock; index: number; pageNumber: number; readingBlocks: PdfReadingBlock[]; onOpenFootnote: (marker: string, anchor: HTMLElement, originId: string, sourcePageNumber: number, sourceBlocks: PdfReadingBlock[]) => void; onReturnToReference: (marker: string) => void }) {
  const inlineText = (text: string) => <PdfInlineText text={text} pageNumber={pageNumber} blockIndex={index} onOpenFootnote={(marker, anchor, originId) => onOpenFootnote(marker, anchor, originId, pageNumber, readingBlocks)} />;
  if (block.kind === "heading") {
    return <Typography component="h2" sx={{ m: 0, mb: `${tokens.spacing[8]}px`, color: "inherit", fontFamily: "inherit", fontSize: "inherit", fontWeight: tokens.typography.fontWeight.semibold, lineHeight: tokens.typography.lineHeight.heading, textAlign: "center" }}>{inlineText(block.text)}</Typography>;
  }
  if (block.kind === "toc-entry") {
    return (
      <Box component="p" sx={{ m: 0, mb: `${tokens.spacing[4]}px`, display: "flex", alignItems: "baseline", color: "inherit", fontFamily: "inherit", fontSize: "inherit", lineHeight: tokens.typography.lineHeight.body, textAlign: "left" }}>
        <Box component="span" sx={{ minWidth: 0 }}>{block.text}</Box>
        <Box component="span" aria-hidden sx={{ minWidth: tokens.spacing[6], flex: 1, borderBottom: 1, borderColor: "currentColor", borderStyle: "dotted", opacity: 0.38 }} />
        <Box component="span" sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{block.pageLabel}</Box>
      </Box>
    );
  }
  if (block.kind === "footnote") {
    return (
      <Box component="aside" role="note" id={`pdf-footnote-${pageNumber}-${footnoteMarkerKey(block.marker)}`} sx={{ mt: `${tokens.spacing[6]}px`, pt: `${tokens.spacing[4]}px`, borderTop: 1, borderColor: "divider" }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", gap: `${tokens.spacing[3]}px` }}>
          <ButtonBase aria-label={`返回文中注释 ${block.marker}`} onClick={() => onReturnToReference(block.marker)} sx={{ flexShrink: 0, color: "primary.main", fontSize: tokens.typography.fontSize.bodySm, fontWeight: tokens.typography.fontWeight.semibold, lineHeight: tokens.typography.lineHeight.body }}>{block.marker}</ButtonBase>
          <Typography component="p" sx={{ m: 0, color: "text.secondary", fontFamily: "inherit", fontSize: tokens.typography.fontSize.bodySm, lineHeight: tokens.typography.lineHeight.body }}>{inlineText(block.text)}</Typography>
        </Stack>
      </Box>
    );
  }
  return <Typography component="p" sx={{ m: 0, mb: `${tokens.spacing[5]}px`, color: "inherit", fontFamily: "inherit", fontSize: "inherit", lineHeight: tokens.typography.lineHeight.body, textAlign: "justify", textIndent: index === 0 ? 0 : "2em" }}>{inlineText(block.text)}</Typography>;
}

function PdfInlineText({ text, pageNumber, blockIndex, onOpenFootnote }: { text: string; pageNumber: number; blockIndex: number; onOpenFootnote: (marker: string, anchor: HTMLElement, originId: string) => void }) {
  return splitPdfInlineFootnoteReferences(text).map((part, partIndex) => {
    if (part.kind === "text") return <Box component="span" data-pdf-text key={`${partIndex}-${part.text}`}>{part.text}</Box>;
    const id = `pdf-footnote-ref-${pageNumber}-${footnoteMarkerKey(part.marker)}-${blockIndex}-${partIndex}`;
    return (
      <ButtonBase
        component="button"
        id={id}
        aria-label={`查看文中注释 ${part.marker}`}
        onClick={(event: any) => onOpenFootnote(part.marker, event.currentTarget, id)}
        key={id}
        sx={{ display: "inline-flex", minWidth: 0, color: "primary.main", fontFamily: tokens.typography.fontFamily.body, fontSize: tokens.typography.fontSize.caption, fontWeight: tokens.typography.fontWeight.semibold, lineHeight: tokens.typography.lineHeight.tight, verticalAlign: "super", borderBottom: 1, borderColor: "currentColor", "&:focus-visible": { boxShadow: tokens.shadow.focus } }}
      >
        {part.marker}
      </ButtonBase>
    );
  });
}

function footnoteMarkerKey(marker: string) {
  return marker === "*" ? "star" : marker.replace(/\D/gu, "");
}

async function findPdfFootnote(document: PDFDocumentProxy | null, startPage: number, marker: string, textCache: Map<number, PdfReadingBlock[]>): Promise<PdfFootnoteResult | null> {
  if (!document) return null;
  const lastPage = Math.min(document.numPages, startPage + 80);
  for (let candidatePage = startPage + 1; candidatePage <= lastPage; candidatePage += 1) {
    let blocks = textCache.get(candidatePage);
    if (!blocks) {
      const page = await document.getPage(candidatePage);
      const content = await page.getTextContent();
      blocks = pdfTextToReadingBlocks(content.items);
      textCache.set(candidatePage, blocks);
    }
    const match = blocks.find((block): block is Extract<PdfReadingBlock, { kind: "footnote" }> => block.kind === "footnote" && block.marker === marker);
    if (match) return { text: match.text, pageNumber: candidatePage };
  }
  return null;
}

function PdfImagePage({ document, pageNumber, muted }: { document: PDFDocumentProxy; pageNumber: number; muted: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let disposed = false;
    let renderTask: RenderTask | undefined;
    let resizeFrame = 0;
    let cleanupObserver: () => void = () => undefined;

    void document.getPage(pageNumber).then((page) => {
      if (disposed) return;
      const renderPage = () => {
        if (disposed || !hostRef.current || !canvasRef.current) return;
        renderTask?.cancel();
        setLoading(true);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(1, hostRef.current.clientWidth);
        const availableHeight = Math.max(1, hostRef.current.clientHeight);
        const scale = Math.min(2, availableWidth / baseViewport.width, availableHeight / baseViewport.height);
        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const target = canvasRef.current;
        const context = target.getContext("2d", { alpha: false });
        if (!context) {
          setError("浏览器无法创建 PDF 图片画布");
          setLoading(false);
          return;
        }
        target.width = Math.floor(viewport.width * outputScale);
        target.height = Math.floor(viewport.height * outputScale);
        target.style.width = `${Math.floor(viewport.width)}px`;
        target.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = page.render({ canvas: null, canvasContext: context, viewport, transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0] });
        void renderTask.promise.then(() => {
          if (!disposed) setLoading(false);
        }).catch((reason) => {
          if (!disposed && reason?.name !== "RenderingCancelledException") {
            setError(reason instanceof Error ? reason.message : "PDF 图片页渲染失败");
            setLoading(false);
          }
        });
      };
      renderPage();
      const observer = new ResizeObserver(() => {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(renderPage);
      });
      observer.observe(host);
      if (disposed) observer.disconnect();
      else cleanupObserver = () => observer.disconnect();
    }).catch((reason) => {
      if (!disposed) {
        setError(reason instanceof Error ? reason.message : "PDF 图片页读取失败");
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
      cleanupObserver();
      window.cancelAnimationFrame(resizeFrame);
      renderTask?.cancel();
    };
  }, [document, pageNumber]);

  return (
    <Stack sx={{ height: "100%", minHeight: 0, alignItems: "center", gap: `${tokens.spacing[3]}px` }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Box ref={hostRef} sx={{ position: "relative", width: "100%", flex: 1, minHeight: 0, display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
        <Box component="canvas" ref={canvasRef} role="img" aria-label={`PDF 第 ${pageNumber} 页图片`} sx={{ display: error ? "none" : "block", maxWidth: "100%", height: "auto", borderRadius: `${tokens.radius.lg}px`, boxShadow: tokens.shadow.cover }} />
        {loading && !error && <Stack sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: `${tokens.spacing[2]}px`, bgcolor: "background.default" }}><CircularProgress size={tokens.spacing[8]} /><Typography variant="body2" sx={{ color: muted }}>正在加载第 {pageNumber} 页图片…</Typography></Stack>}
      </Box>
      {!error && <Typography variant="caption" component="p" sx={{ color: muted }}>第 {pageNumber} 页 · 图片页按阅读宽度展示 · 未进行 OCR</Typography>}
    </Stack>
  );
}
