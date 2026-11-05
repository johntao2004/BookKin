import { AddRounded } from "@/ui/icons";
import { NavigateBeforeRounded } from "@/ui/icons";
import { NavigateNextRounded } from "@/ui/icons";
import { RemoveRounded } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { ButtonBase } from "@/ui/buttons";
import { CircularProgress } from "@/ui/feedback";
import { IconButton } from "@/ui/buttons";
import { Popover } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type PDFDataRangeTransport, type RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import { Fragment, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode, type RefObject, type TouchEvent } from "react";
import { api } from "../../api/client";
import type { Annotation } from "../../domain/types";
import { tokens } from "../../theme/generated-tokens";
import { readerWidthSx } from "../PageHeader";
import { bindAnnotationNoteActivation } from "./annotation-activation";
import { applyPdfTextAnnotations } from "./pdf-annotations";
import { pdfNavigation } from "./pdf-navigation";
import { PdfImageSpread } from "./PdfImageSpread";
import { pdfPageBoundarySeparator, pdfTextToReadingBlocks, shouldJoinPdfPageBoundaryParagraphs, splitPdfInlineFootnoteReferences, type PdfReadingBlock } from "./pdf-reading-text";
import type { ReaderPageLayout } from "./reader-layout";
import { isEditableReaderTarget, isReaderSwipe } from "./reader-navigation";
import { PageTurnShade } from "./PageTurnShade";
import { readerSelectionFromRect, type ReaderSelection, type TocItem } from "./types";
import { useReaderPageLayout } from "./use-reader-page-layout";
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

export interface PdfSourceBlock {
  block?: PdfReadingBlock;
  pageNumber: number;
  imagePage?: boolean;
}

interface IndexedPdfSourceBlock {
  source: PdfSourceBlock;
  index: number;
  sourceStart: boolean;
}

export function groupPdfSourceBlocks(blocks: PdfSourceBlock[]) {
  const indexed = blocks.map((source, index) => ({
    source,
    index,
    sourceStart: index === 0 || blocks[index - 1]?.pageNumber !== source.pageNumber,
  }));
  const groups: IndexedPdfSourceBlock[][] = [];
  for (let index = 0; index < indexed.length; index += 1) {
    const current = indexed[index];
    if (!current) continue;
    const group = [current];
    let cursor = index;
    while (indexed[cursor] && indexed[cursor + 1]) {
      const previous = indexed[cursor]!;
      const next = indexed[cursor + 1]!;
      if (previous.source.pageNumber + 1 !== next.source.pageNumber
        || !previous.source.block || !next.source.block
        || !shouldJoinPdfPageBoundaryParagraphs(previous.source.block, next.source.block)) break;
      group.push(next);
      cursor += 1;
    }
    groups.push(group);
    index = cursor;
  }
  return groups;
}

export function pdfSourcePositionAt(
  sourcePageStarts: ReadonlyMap<number, number>,
  virtualPageIndex: number,
  fallbackPageNumber: number,
  // 翻页时同屏多个源页起点并存，应锚定到最先开始的源页，而不是沿用当前页，否则翻回第一屏会显示第 2 页。
  // When turning, anchor to the first source page starting on a shared screen instead of keeping the current one; otherwise paging back to the first screen reports page 2.
  options: { preferFirstOnSharedScreen?: boolean } = {},
) {
  const starts = [...sourcePageStarts.entries()];
  const currentScreenStart = starts.filter(([, start]) => start === virtualPageIndex).sort((left, right) => left[0] - right[0])[0];
  const previousScreenStart = starts.filter(([, start]) => start < virtualPageIndex).sort((left, right) => right[1] - left[1] || right[0] - left[0])[0];
  const fallbackStart = sourcePageStarts.get(fallbackPageNumber);
  const source = fallbackStart === virtualPageIndex && !options.preferFirstOnSharedScreen
    ? [fallbackPageNumber, fallbackStart] as const
    : currentScreenStart ?? previousScreenStart;
  return source
    ? { pageNumber: source[0], offset: Math.max(0, virtualPageIndex - source[1]) }
    : { pageNumber: fallbackPageNumber, offset: Math.max(0, virtualPageIndex - (sourcePageStarts.get(fallbackPageNumber) ?? 0)) };
}

export function pdfSourceVirtualPageIndex(localX: number, pagePadding: number, columnWidth: number, columnGap: number, visibleColumns: number) {
  const sourceColumn = Math.floor(Math.max(0, localX - pagePadding) / (columnWidth + columnGap));
  return Math.floor(sourceColumn / Math.max(1, visibleColumns));
}

function pdfSourcePageVirtualCount(sourcePageStarts: ReadonlyMap<number, number>, sourcePage: number, totalCount: number) {
  const start = sourcePageStarts.get(sourcePage) ?? 0;
  return Math.max(1, (sourcePageStarts.get(sourcePage + 1) ?? totalCount) - start);
}

export function pdfTurnPositionAt(
  cursor: { pageNumber: number; virtualPageIndex: number; virtualPageCount: number },
  direction: "PREVIOUS" | "NEXT",
  sourcePageStarts: ReadonlyMap<number, number>,
) {
  const nextIndex = cursor.virtualPageIndex + (direction === "NEXT" ? 1 : -1);
  if (nextIndex < 0 || nextIndex >= cursor.virtualPageCount) return null;
  return { pageNumber: pdfSourcePositionAt(sourcePageStarts, nextIndex, cursor.pageNumber, { preferFirstOnSharedScreen: true }).pageNumber, virtualPageIndex: nextIndex };
}

export function remapPdfSourceTarget(
  target: { pageNumber: number; offset: number; virtualPageIndex: number },
  sourcePageStarts: ReadonlyMap<number, number>,
  totalCount: number,
) {
  const start = sourcePageStarts.get(target.pageNumber);
  return start === undefined
    ? null
    : { ...target, virtualPageIndex: Math.min(Math.max(0, totalCount - 1), start + target.offset) };
}

export default function PdfDocumentReader({ bookId, annotations, theme, fontSize, fontFamily, pageTurnEnabled = true, fontSourceUrl, contentUrl, dataRange, readOnly = false, target, targetRevision, onNavigation, onAnnotationActivate, onSelect, onPosition }: {
  bookId: string;
  annotations: Annotation[];
  theme: { background: string; foreground: string; muted: string };
  fontSize: number;
  fontFamily: string;
  pageTurnEnabled?: boolean;
  fontSourceUrl?: string;
  contentUrl?: string;
  dataRange?: PDFDataRangeTransport;
  readOnly?: boolean;
  target?: string;
  targetRevision?: number;
  onNavigation?: (items: TocItem[]) => void;
  onAnnotationActivate?: (id: string, rect?: DOMRect) => void;
  onSelect: (selection: ReaderSelection) => void;
  onPosition: (locator: string, progress: number) => void;
}) {
  const annotationActivationRootRef = useRef<HTMLDivElement | null>(null);
  const annotationsRef = useRef(annotations);
  const annotationCallbackRef = useRef(onAnnotationActivate);
  const annotatedSourcePagesRef = useRef(new Set<number>());
  annotationsRef.current = annotations;
  annotationCallbackRef.current = onAnnotationActivate;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  // PDF 原始页与重排后的虚拟页分开管理；locator 的 offset 指向原始页内分页。
  // Track original PDF pages separately from reflowed virtual pages; locator offset identifies pagination within an original page.
  const [virtualPageIndex, setVirtualPageIndex] = useState(0);
  const [virtualPageCount, setVirtualPageCount] = useState(1);
  const [sourcePageStartRevision, setSourcePageStartRevision] = useState(0);
  const [scale, setScale] = useState(1.25);
  const [viewMode] = useState<PdfViewMode>("READING");
  const [readingBlocks, setReadingBlocks] = useState<PdfSourceBlock[]>([]);
  const [textLoading, setTextLoading] = useState(true);
  const [textError, setTextError] = useState("");
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(true);
  const readingTextRef = useRef<HTMLDivElement | null>(null);
  const textCacheRef = useRef(new Map<number, PdfReadingBlock[]>());
  const initialTargetPageRef = useRef(1);
  const parsedThroughRef = useRef(0);
  const hasDisplayedTextRef = useRef(false);
  const footnoteCacheRef = useRef(new Map<string, PdfFootnoteResult | null>());
  const footnoteRequestRef = useRef(0);
  const footnoteOriginRef = useRef(new Map<string, string>());
  const [activeFootnote, setActiveFootnote] = useState<ActivePdfFootnote | null>(null);
  const [displayedPosition, setDisplayedPosition] = useState({
    pageNumber: 1,
    virtualPageIndex: 0,
    virtualPageCount: 1,
  });
  const initialTargetRef = useRef(target);
  const touchStartXRef = useRef<number | null>(null);
  const readingSurfaceRef = useRef<HTMLDivElement | null>(null);
  const pageLayout = useReaderPageLayout(readingSurfaceRef);
  const wideSpread = pageLayout?.spread ?? false;
  const hasTextBlocks = useMemo(() => readingBlocks.some((item) => !item.imagePage), [readingBlocks]);
  const latestCursorRef = useRef({
    pageNumber,
    virtualPageIndex,
    virtualPageCount,
  });
  latestCursorRef.current = {
    pageNumber,
    virtualPageIndex,
    virtualPageCount,
  };
  const sourcePageStartsRef = useRef(new Map<number, number>());
  const pendingSourceTargetRef = useRef<{ pageNumber: number; offset: number } | null>(null);
  const restoredSourceTargetRef = useRef<{ pageNumber: number; offset: number; virtualPageIndex: number } | null>(null);
  const annotationRevision = useMemo(
    () => annotations.map((annotation) => `${annotation.id}:${annotation.updatedAt ?? annotation.createdAt}:${annotation.style}:${annotation.color ?? ""}`).join(","),
    [annotations],
  );
  const pageSnapshotKey = `${bookId}:${pageNumber}:${virtualPageIndex}:${virtualPageCount}:${textLoading}:${wideSpread}:${theme.background}:${theme.foreground}:${fontSize}:${fontFamily}:${annotationRevision}`;
  const { turnPage, turning } = usePageTurnTransition(
    readingSurfaceRef,
    pageTurnEnabled,
    { spread: wideSpread, snapshotKey: pageSnapshotKey, snapshot: !hasTextBlocks },
  );

  useEffect(() => {
    const root = annotationActivationRootRef.current;
    if (!root) return;
    return bindAnnotationNoteActivation(
      root,
      (id) => {
        if (!annotationCallbackRef.current) return undefined;
        const annotation = annotationsRef.current.find((candidate) => candidate.id === id);
        return annotation ? { id: annotation.id, note: annotation.note } : undefined;
      },
      (id, rect) => annotationCallbackRef.current?.(id, rect),
    );
  }, [error]);

  useEffect(() => {
    if (turning) return;
    const sourcePosition = pdfSourcePositionAt(sourcePageStartsRef.current, virtualPageIndex, pageNumber);
    const restoredTarget = restoredSourceTargetRef.current;
    const displayPosition = restoredTarget?.virtualPageIndex === virtualPageIndex
      ? { pageNumber: restoredTarget.pageNumber, offset: restoredTarget.offset }
      : sourcePosition;
    setDisplayedPosition({ pageNumber: displayPosition.pageNumber, virtualPageIndex: displayPosition.offset, virtualPageCount });
  }, [pageNumber, sourcePageStartRevision, turning, virtualPageCount, virtualPageIndex]);

  useEffect(() => {
    let disposed = false;
    textCacheRef.current.clear();
    sourcePageStartsRef.current.clear();
    pendingSourceTargetRef.current = null;
    restoredSourceTargetRef.current = null;
    initialTargetPageRef.current = 1;
    parsedThroughRef.current = 0;
    hasDisplayedTextRef.current = false;
    restoredSourceTargetRef.current = null;
    setSourcePageStartRevision((revision) => revision + 1);
    pendingSourceTargetRef.current = null;
    footnoteCacheRef.current.clear();
    footnoteOriginRef.current.clear();
    annotatedSourcePagesRef.current.clear();
    setActiveFootnote(null);
    setDocument(null);
    setPageNumber(1);
    setVirtualPageIndex(0);
    setVirtualPageCount(1);
    setReadingBlocks([]);
    setTextLoading(true);
    setError("");
    setTextError("");
    // 每本书独立拥有 PDF 加载任务；切换或卸载时销毁任务并忽略迟到响应。
    // Each book owns its PDF loading task; switching or unmounting destroys it and ignores late responses.
    const task = getDocument(dataRange ? { range: dataRange, disableAutoFetch: true, disableStream: true, rangeChunkSize: 1024 * 1024 } : { url: contentUrl ?? `/api/v1/books/${bookId}/content`, withCredentials: true, rangeChunkSize: 1024 * 1024 });
    void Promise.all([task.promise, readOnly ? Promise.resolve(null) : api.getReadingPosition(bookId)]).then(([loaded, position]) => {
      if (disposed) return;
      setDocument(loaded);
      const locator = initialTargetRef.current ?? position?.locator;
      const match = locator?.match(/^pdf:page=(\d+)(?:&offset=(\d+))?/);
      if (match) {
        const sourcePage = Math.min(loaded.numPages, Math.max(1, Number(match[1])));
        setPageNumber(sourcePage);
        initialTargetPageRef.current = sourcePage;
        pendingSourceTargetRef.current = { pageNumber: sourcePage, offset: Math.max(0, Number(match[2] ?? 0)) };
      }
    }).catch((reason) => { if (!disposed) setError(reason instanceof Error ? reason.message : "无法打开 PDF"); });
    return () => {
      disposed = true;
      void task.destroy();
    };
  }, [bookId, contentUrl, dataRange, readOnly]);

  const navigateToTarget = useEffectEvent((loaded: PDFDocumentProxy, locator: string) => {
    const match = /^pdf:page=(\d+)(?:&offset=(\d+))?/u.exec(locator);
    if (!match) return;
    const nextPage = Math.min(loaded.numPages, Math.max(1, Number(match[1])));
    const offset = Math.max(0, Number(match[2] ?? 0));
    pendingSourceTargetRef.current = null;
    restoredSourceTargetRef.current = null;
    // Unmount the old text layout before it can clamp the destination's virtual offset.
    setPageNumber(nextPage);
    const sourceStart = sourcePageStartsRef.current.get(nextPage);
    if (sourceStart === undefined && parsedThroughRef.current < nextPage) pendingSourceTargetRef.current = { pageNumber: nextPage, offset };
    else if (sourceStart === undefined) {
      pendingSourceTargetRef.current = null;
      setVirtualPageIndex(0);
    }
    else {
      const targetIndex = sourceStart + offset;
      restoredSourceTargetRef.current = { pageNumber: nextPage, offset, virtualPageIndex: targetIndex };
      setVirtualPageIndex(targetIndex);
    }
  });
  useEffect(() => {
    if (document && target) navigateToTarget(document, target);
  }, [document, target, targetRevision]);

  useEffect(() => {
    if (!document || !onNavigation) return;
    let disposed = false;
    void (async () => {
      const items = await pdfNavigation(document);
      if (!disposed) onNavigation(items);
    })().catch(() => { if (!disposed) onNavigation([]); });
    return () => { disposed = true; };
  }, [document, onNavigation]);

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
    const allBlocks: PdfSourceBlock[] = [];
    const initialBatchSize = 12;
    const backgroundBatchSize = 36;
    void (async () => {
      for (let firstPage = 1; firstPage <= document.numPages;) {
        const step = hasDisplayedTextRef.current ? backgroundBatchSize : initialBatchSize;
        const lastPage = Math.min(document.numPages, firstPage + step - 1);
        for (let sourcePage = firstPage; sourcePage <= lastPage; sourcePage += 1) {
          let blocks = textCacheRef.current.get(sourcePage);
          if (!blocks) {
            const page = await document.getPage(sourcePage);
            if (disposed) return;
            const content = await page.getTextContent();
            if (disposed) return;
            blocks = pdfTextToReadingBlocks(content.items);
            textCacheRef.current.set(sourcePage, blocks);
          }
          allBlocks.push(...(blocks.length
            ? blocks.map((block) => ({ block, pageNumber: sourcePage }))
            : [{ pageNumber: sourcePage, imagePage: true }]));
        }
        if (disposed) return;
        parsedThroughRef.current = lastPage;
        if (lastPage >= initialTargetPageRef.current || lastPage === document.numPages) {
          hasDisplayedTextRef.current = true;
          setReadingBlocks([...allBlocks]);
          setTextLoading(false);
        }
        firstPage = lastPage + 1;
      }
      if (!disposed) setTextLoading(false);
    })().catch((reason) => {
      if (disposed) return;
      const message = reason instanceof Error ? reason.message : "PDF 文字解析失败";
      if (!hasDisplayedTextRef.current) setError(message);
      else setTextError(message);
    });
    return () => { disposed = true; };
  }, [document, viewMode]);

  useEffect(() => {
    if (viewMode !== "READING" || textLoading) return;
    if (readingTextRef.current) {
      const sourcePages = new Set(readingBlocks.map(({ pageNumber: sourcePage }) => sourcePage));
      const activeAnnotationPages = new Set(annotations
        .filter((annotation) => annotation.type !== "BOOKMARK")
        .map((annotation) => Number(annotation.locator?.match(/^pdf:page=(\d+)/u)?.[1]))
        .filter((pageNumber) => Number.isFinite(pageNumber)));
      const pagesToRefresh = new Set([...activeAnnotationPages, ...annotatedSourcePagesRef.current]);
      pagesToRefresh.forEach((sourcePage) => {
        if (sourcePages.has(sourcePage)) applyPdfTextAnnotations(readingTextRef.current!, sourcePage, annotations, { theme });
      });
      annotatedSourcePagesRef.current = activeAnnotationPages;
    }
  }, [annotations, document, pageNumber, readingBlocks, textLoading, viewMode, theme.background, theme.foreground]);

  useEffect(() => {
    if (!document) return;
    if (turning) return;
    const unresolvedTarget = pendingSourceTargetRef.current;
    if (unresolvedTarget) {
      const locator = `pdf:page=${unresolvedTarget.pageNumber}&offset=${unresolvedTarget.offset}`;
      const sourceCount = pdfSourcePageVirtualCount(sourcePageStartsRef.current, unresolvedTarget.pageNumber, virtualPageCount);
      const progress = Math.max(0, Math.min(1, (unresolvedTarget.pageNumber - 1 + (unresolvedTarget.offset + 0.5) / sourceCount) / document.numPages));
      onPosition(locator, progress);
      return;
    }
    const sourcePosition = pdfSourcePositionAt(sourcePageStartsRef.current, virtualPageIndex, pageNumber);
    const restoredTarget = restoredSourceTargetRef.current;
    const position = restoredTarget?.virtualPageIndex === virtualPageIndex
      ? { pageNumber: restoredTarget.pageNumber, offset: restoredTarget.offset }
      : sourcePosition;
    const locator = `pdf:page=${position.pageNumber}&offset=${position.offset}`;
    const sourceCount = pdfSourcePageVirtualCount(sourcePageStartsRef.current, position.pageNumber, virtualPageCount);
    const progress = Math.max(0, Math.min(1, (position.pageNumber - 1 + (position.offset + 0.5) / sourceCount) / document.numPages));
    onPosition(locator, progress);
    if (!readOnly) void api.saveReadingPosition(bookId, locator, progress).catch(() => undefined);
  }, [bookId, document, onPosition, pageNumber, readOnly, sourcePageStartRevision, turning, virtualPageCount, virtualPageIndex]);

  const captureSelection = (fallbackPageNumber = pageNumber) => {
    const nativeSelection = window.getSelection();
    const quote = nativeSelection?.toString().trim() ?? "";
    if (!quote || quote.length > 600 || !nativeSelection?.rangeCount) return;
    const rect = nativeSelection.getRangeAt(0).getBoundingClientRect();
    const selectedNode = nativeSelection.getRangeAt(0).startContainer;
    const sourcePageNumber = (selectedNode instanceof HTMLElement ? selectedNode : selectedNode.parentElement)?.closest<HTMLElement>("[data-pdf-source-page]")?.dataset.pdfSourcePage;
    const sourcePage = Number(sourcePageNumber) || fallbackPageNumber;
    const sourceOffset = Math.max(0, virtualPageIndex - (sourcePageStartsRef.current.get(sourcePage) ?? 0));
    onSelect(readerSelectionFromRect({ quote, locator: `pdf:page=${sourcePage}&offset=${sourceOffset}`, rect }));
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

  const handleVirtualPageCountChange = useCallback((count: number, sourcePageStarts: Array<[number, number]>) => {
    const nextCount = Math.max(1, count);
    const previousStart = sourcePageStartsRef.current.get(pageNumber);
    const previousOffset = previousStart === undefined ? null : Math.max(0, virtualPageIndex - previousStart);
    const nextStarts = new Map(sourcePageStarts);
    const currentStarts = sourcePageStartsRef.current;
    const startsChanged = currentStarts.size !== nextStarts.size
      || [...nextStarts].some(([sourcePage, start]) => currentStarts.get(sourcePage) !== start);
    sourcePageStartsRef.current = nextStarts;
    // 仅在分页起点真实变化时刷新依赖项，避免每次重新测量都重复保存阅读进度。
    // Only bump the revision when page starts really change, so re-measuring does not re-save reading progress.
    if (startsChanged) setSourcePageStartRevision((revision) => revision + 1);
    const pendingSourceTarget = pendingSourceTargetRef.current;
    if (pendingSourceTarget) {
      const targetStart = nextStarts.get(pendingSourceTarget.pageNumber);
      if (targetStart !== undefined) {
        pendingSourceTargetRef.current = null;
        setPageNumber(pendingSourceTarget.pageNumber);
        const targetIndex = Math.min(nextCount - 1, targetStart + pendingSourceTarget.offset);
        restoredSourceTargetRef.current = { ...pendingSourceTarget, virtualPageIndex: targetIndex };
        setVirtualPageIndex(targetIndex);
      }
    } else {
      const restoredTarget = restoredSourceTargetRef.current;
      if (restoredTarget) {
        const remappedTarget = remapPdfSourceTarget(restoredTarget, nextStarts, nextCount);
        if (remappedTarget) {
          restoredSourceTargetRef.current = remappedTarget;
          setPageNumber(remappedTarget.pageNumber);
          setVirtualPageIndex(remappedTarget.virtualPageIndex);
        }
      } else {
        const nextStart = nextStarts.get(pageNumber);
        if (nextStart !== undefined && previousOffset !== null) setVirtualPageIndex(Math.min(nextCount - 1, nextStart + previousOffset));
      }
    }
    setVirtualPageCount(nextCount);
    setVirtualPageIndex((current) => Math.min(current, nextCount - 1));
  }, [pageNumber, virtualPageIndex]);

  const canPrevious = virtualPageIndex > 0;
  const canNext = Boolean(document) && virtualPageIndex < virtualPageCount - 1;
  const changeToPreviousPage = useCallback(() => {
    const cursor = latestCursorRef.current;
    restoredSourceTargetRef.current = null;
    const position = pdfTurnPositionAt(cursor, "PREVIOUS", sourcePageStartsRef.current);
    if (!position) return;
    setVirtualPageIndex(position.virtualPageIndex);
    setPageNumber(position.pageNumber);
  }, []);
  const changeToNextPage = useCallback(() => {
    const cursor = latestCursorRef.current;
    restoredSourceTargetRef.current = null;
    const position = pdfTurnPositionAt(cursor, "NEXT", sourcePageStartsRef.current);
    if (!position) return;
    setVirtualPageIndex(position.virtualPageIndex);
    setPageNumber(position.pageNumber);
  }, []);
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

  if (error) return <Stack ref={annotationActivationRootRef} className="reader-viewport" sx={{ height: "100%", alignItems: "center", justifyContent: "center", p: 3 }}><Alert severity="error">{error}</Alert></Stack>;

  return (
    <Stack ref={annotationActivationRootRef} className="reader-viewport" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} sx={{ height: "100%", minHeight: 0, overflow: "hidden", bgcolor: viewMode === "ORIGINAL" ? theme.foreground : theme.background, color: viewMode === "ORIGINAL" ? theme.background : theme.foreground }}>
      {fontSourceUrl && <style>{`@font-face { font-family: ${fontFamily.split(",")[0]}; src: url("${fontSourceUrl}"); font-display: swap; }`}</style>}
      {textError && <Alert severity="warning">{textError}</Alert>}
      {viewMode === "READING" ? (
        <Box ref={readingSurfaceRef} className="reader-page-turn-surface" data-reader-spread={wideSpread} sx={{ position: "relative", ...readerWidthSx, flex: "1 1 auto", minHeight: 0, overflow: "hidden", bgcolor: theme.background, backfaceVisibility: "hidden", transformStyle: "preserve-3d", willChange: turning ? "transform, opacity, filter, clip-path" : "auto" }}>
          <PdfReadingClipFrame width={readingBlocks.length === 0 ? undefined : pageLayout?.articleWidth}>
            {textLoading
              ? <Stack spacing={1.5} sx={{ height: "100%", alignItems: "center", justifyContent: "center" }}><CircularProgress size={30} /><Typography sx={{ color: theme.muted }}>正在解析第 {pageNumber} 页文字…</Typography></Stack>
              : <PdfPagedText textRef={readingTextRef} document={document!} blocks={readingBlocks} sourcePageStarts={sourcePageStartsRef.current} pageNumber={pageNumber} theme={theme} fontFamily={fontFamily} fontSize={fontSize} layout={pageLayout} pageIndex={virtualPageIndex} turning={turning} onPageCountChange={handleVirtualPageCountChange} onOpenFootnote={openFootnote} onReturnToReference={returnToFootnoteReference} onCaptureSelection={() => captureSelection(pageNumber)} />}
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
      <Stack component="nav" aria-label="PDF 翻页" className="pdf-reader-pagination" direction="row" spacing={1} sx={{ ...readerWidthSx, flex: `0 0 ${tokens.layout.readerControlHeight}px`, minHeight: tokens.layout.readerControlHeight, alignItems: "center", justifyContent: "center", overflowX: "auto", py: 0.75, bgcolor: theme.background, color: theme.foreground, borderTop: "1px solid", borderColor: "divider" }}>
        <IconButton color="inherit" aria-label="PDF 上一页" disabled={turning || !canPrevious} onClick={goPrevious} sx={{ width: tokens.layout.touchTarget, height: tokens.layout.touchTarget }}><NavigateBeforeRounded /></IconButton>
        <Typography variant="body2" sx={{ minWidth: 0, flex: "1 1 auto", textAlign: "center", whiteSpace: "nowrap", color: theme.muted }}>{document ? `第 ${displayedPosition.pageNumber} 页 · 共 ${document.numPages} 页` : "正在打开 PDF…"}</Typography>
        <IconButton color="inherit" aria-label="PDF 下一页" disabled={turning || !canNext} onClick={goNext} sx={{ width: tokens.layout.touchTarget, height: tokens.layout.touchTarget }}><NavigateNextRounded /></IconButton>
        {viewMode === "ORIGINAL" && <>
          <Box sx={{ width: { xs: 0, sm: 8 } }} />
          <IconButton color="inherit" aria-label="缩小 PDF" disabled={scale <= 0.75} onClick={() => setScale((value) => Math.max(0.75, value - 0.25))} sx={{ width: tokens.layout.touchTarget, height: tokens.layout.touchTarget }}><RemoveRounded /></IconButton>
          <Typography variant="caption" sx={{ display: { xs: "none", sm: "block" }, color: "#C8C0B5" }}>{Math.round(scale * 100)}%</Typography>
          <IconButton color="inherit" aria-label="放大 PDF" disabled={scale >= 2.5} onClick={() => setScale((value) => Math.min(2.5, value + 0.25))} sx={{ width: tokens.layout.touchTarget, height: tokens.layout.touchTarget }}><AddRounded /></IconButton>
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

export function PdfReadingClipFrame({ children, width }: { children: ReactNode; width?: number }) {
  return <Box className="pdf-reading-clip-frame" sx={{ height: "100%", minHeight: 0, width: width ? `${width}px` : "100%", maxWidth: "100%", mx: "auto", overflow: "hidden" }}>{children}</Box>;
}

export function PdfPagedText({ textRef, document, blocks, sourcePageStarts, pageNumber, theme, fontFamily, fontSize, layout, pageIndex, turning, onPageCountChange, onOpenFootnote, onReturnToReference, onCaptureSelection }: {
  textRef: RefObject<HTMLDivElement | null>;
  document: PDFDocumentProxy;
  blocks: PdfSourceBlock[];
  sourcePageStarts: ReadonlyMap<number, number>;
  pageNumber: number;
  theme: { background: string; foreground: string; muted: string };
  fontFamily: string;
  fontSize: number;
  layout: ReaderPageLayout | null;
  pageIndex: number;
  turning: boolean;
  onPageCountChange: (count: number, sourcePageStarts: Array<[number, number]>) => void;
  onOpenFootnote: (marker: string, anchor: HTMLElement, originId: string, sourcePageNumber: number, sourceBlocks: PdfReadingBlock[]) => void;
  onReturnToReference: (marker: string) => void;
  onCaptureSelection: () => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const visibleColumns = layout?.visibleColumns ?? 1;
  const columnWidth = layout?.columnWidth ?? null;
  const columnGap = layout?.columnGap ?? tokens.layout.readerPageGap;
  const pagePadding = layout?.pagePadding ?? tokens.spacing[5];
  const blocksBySourcePage = useMemo(() => {
    const grouped = new Map<number, PdfReadingBlock[]>();
    blocks.forEach(({ block, pageNumber: sourcePage }) => {
      if (!block) return;
      const sourceBlocks = grouped.get(sourcePage) ?? [];
      sourceBlocks.push(block);
      grouped.set(sourcePage, sourceBlocks);
    });
    return grouped;
  }, [blocks]);
  const renderGroups = useMemo(() => groupPdfSourceBlocks(blocks), [blocks]);

  useEffect(() => {
    if (turning) return;
    const frame = frameRef.current;
    if (!frame || columnWidth === null) return;
    let animationFrame = 0;
    const measure = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const totalColumns = Math.max(1, Math.round((frame.scrollWidth + columnGap) / (columnWidth + columnGap)));
        const sourcePageStarts = new Map<number, number>();
        frame.querySelectorAll<HTMLElement>("[data-pdf-source-marker]").forEach((span) => {
          const sourcePage = Number(span.dataset.pdfSourcePage);
          if (!Number.isFinite(sourcePage) || sourcePageStarts.has(sourcePage)) return;
          let firstRect = span.getBoundingClientRect();
          if (!span.hasAttribute("data-pdf-image-page")) {
            const textWalker = window.document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
            const firstText = textWalker.nextNode();
            if (firstText?.textContent) {
              const firstCharacter = window.document.createRange();
              firstCharacter.setStart(firstText, 0);
              firstCharacter.setEnd(firstText, Math.min(1, firstText.textContent.length));
              if (typeof firstCharacter.getBoundingClientRect === "function") firstRect = firstCharacter.getBoundingClientRect();
            }
          }
          const localX = firstRect.left - frame.getBoundingClientRect().left;
          sourcePageStarts.set(sourcePage, pdfSourceVirtualPageIndex(localX, pagePadding, columnWidth, columnGap, visibleColumns));
        });
        onPageCountChange(Math.max(1, Math.ceil(totalColumns / visibleColumns)), [...sourcePageStarts.entries()]);
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => { observer.disconnect(); window.cancelAnimationFrame(animationFrame); };
  }, [blocks, columnGap, columnWidth, fontFamily, fontSize, layout?.articleWidth, onPageCountChange, turning, visibleColumns]);

  const pageStride = layout?.pageStride ?? 0;

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
        width: layout ? `${layout.articleWidth}px` : "100%",
        maxWidth: "100%",
        mx: "auto",
        overflow: "visible",
        transform: columnWidth === null ? `translateX(-${pageIndex * 100}%)` : `translateX(-${pageIndex * pageStride}px)`,
        transition: "none",
        // 由浏览器按文本需要生成完整列宽，避免固定列数在窄屏把横排中文挤成近似竖排。
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
        px: `${pagePadding}px`,
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
      {renderGroups.map((group) => {
        if (group.length > 1) {
          const first = group[0]!;
          const firstSource = first.source;
          const firstPage = firstSource.pageNumber;
          const last = group[group.length - 1]!;
          return <Typography key={`${firstPage}-${first.index}-${last.source.pageNumber}-${last.index}`} component="p" data-pdf-source-page={firstPage} sx={{ m: 0, mb: `${tokens.spacing[5]}px`, color: "inherit", fontFamily: "inherit", fontSize: "inherit", lineHeight: tokens.typography.lineHeight.body, textAlign: "justify", textIndent: first.index === 0 ? 0 : "2em" }}>
            {group.map((part, partIndex) => {
              const sourcePage = part.source.pageNumber;
              const text = part.source.block!.text;
              return <Fragment key={`${sourcePage}-${part.index}`}>
                <PdfInlineText text={text} pageNumber={sourcePage} blockIndex={part.index} sourceStart={part.sourceStart} onOpenFootnote={(marker, anchor, originId) => onOpenFootnote(marker, anchor, originId, sourcePage, blocksBySourcePage.get(sourcePage) ?? [])} />
                {partIndex < group.length - 1 && pdfPageBoundarySeparator(text, group[partIndex + 1]!.source.block!.text)}
              </Fragment>;
            })}
          </Typography>;
        }
        const { source, index, sourceStart } = group[0]!;
        const { block, pageNumber: sourcePageNumber, imagePage } = source;
        const imageStart = sourcePageStarts.get(sourcePageNumber);
        const imageIsNearViewport = imageStart === undefined
          ? Math.abs(sourcePageNumber - pageNumber) <= visibleColumns + 1
          : imageStart >= pageIndex - 1 && imageStart <= pageIndex + visibleColumns;
        return <Fragment key={`${sourcePageNumber}-${index}`}>
          {imagePage
            ? <Box data-pdf-source-page={sourcePageNumber} data-pdf-image-page="" data-pdf-source-marker={sourceStart ? "" : undefined} sx={{ height: "100%", minHeight: "100%", breakInside: "avoid" }}>{imageIsNearViewport && <PdfImageSpread document={document} pageNumber={sourcePageNumber} spread={false} muted={theme.muted} />}</Box>
            : <PdfReadingBlockView block={block!} index={index} pageNumber={sourcePageNumber} sourceStart={sourceStart} readingBlocks={blocksBySourcePage.get(sourcePageNumber) ?? []} onOpenFootnote={onOpenFootnote} onReturnToReference={onReturnToReference} />}
        </Fragment>;
      })}
    </Box>
  );
}

function PdfReadingBlockView({ block, index, pageNumber, sourceStart, readingBlocks, onOpenFootnote, onReturnToReference }: { block: PdfReadingBlock; index: number; pageNumber: number; sourceStart: boolean; readingBlocks: PdfReadingBlock[]; onOpenFootnote: (marker: string, anchor: HTMLElement, originId: string, sourcePageNumber: number, sourceBlocks: PdfReadingBlock[]) => void; onReturnToReference: (marker: string) => void }) {
  const inlineText = (text: string) => <PdfInlineText text={text} pageNumber={pageNumber} blockIndex={index} sourceStart={sourceStart} onOpenFootnote={(marker, anchor, originId) => onOpenFootnote(marker, anchor, originId, pageNumber, readingBlocks)} />;
  if (block.kind === "heading") {
    return <Typography component="h2" data-pdf-source-page={pageNumber} sx={{ m: 0, mb: `${tokens.spacing[8]}px`, color: "inherit", fontFamily: "inherit", fontSize: "inherit", fontWeight: tokens.typography.fontWeight.semibold, lineHeight: tokens.typography.lineHeight.heading, textAlign: "center" }}>{inlineText(block.text)}</Typography>;
  }
  if (block.kind === "toc-entry") {
    return (
      <Box component="p" data-pdf-source-page={pageNumber} sx={{ m: 0, mb: `${tokens.spacing[4]}px`, display: "flex", alignItems: "baseline", color: "inherit", fontFamily: "inherit", fontSize: "inherit", lineHeight: tokens.typography.lineHeight.body, textAlign: "left" }}>
        <Box component="span" data-pdf-source-page={pageNumber} data-pdf-source-marker={sourceStart ? "" : undefined} sx={{ minWidth: 0 }}>{block.text}</Box>
        <Box component="span" aria-hidden sx={{ minWidth: tokens.spacing[6], flex: 1, borderBottom: 1, borderColor: "currentColor", borderStyle: "dotted", opacity: 0.38 }} />
        <Box component="span" sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{block.pageLabel}</Box>
      </Box>
    );
  }
  if (block.kind === "footnote") {
    return (
      <Box component="aside" role="note" id={`pdf-footnote-${pageNumber}-${footnoteMarkerKey(block.marker)}`} data-pdf-source-page={pageNumber} sx={{ mt: `${tokens.spacing[6]}px`, pt: `${tokens.spacing[4]}px`, borderTop: 1, borderColor: "divider" }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", gap: `${tokens.spacing[3]}px` }}>
          <ButtonBase aria-label={`返回文中注释 ${block.marker}`} onClick={() => onReturnToReference(block.marker)} sx={{ flexShrink: 0, color: "primary.main", fontSize: tokens.typography.fontSize.bodySm, fontWeight: tokens.typography.fontWeight.semibold, lineHeight: tokens.typography.lineHeight.body }}>{block.marker}</ButtonBase>
          <Typography component="p" sx={{ m: 0, color: "text.secondary", fontFamily: "inherit", fontSize: tokens.typography.fontSize.bodySm, lineHeight: tokens.typography.lineHeight.body }}>{inlineText(block.text)}</Typography>
        </Stack>
      </Box>
    );
  }
  return <Typography component="p" data-pdf-source-page={pageNumber} sx={{ m: 0, mb: `${tokens.spacing[5]}px`, color: "inherit", fontFamily: "inherit", fontSize: "inherit", lineHeight: tokens.typography.lineHeight.body, textAlign: "justify", textIndent: index === 0 ? 0 : "2em" }}>{inlineText(block.text)}</Typography>;
}

function PdfInlineText({ text, pageNumber, blockIndex, sourceStart = false, onOpenFootnote }: { text: string; pageNumber: number; blockIndex: number; sourceStart?: boolean; onOpenFootnote: (marker: string, anchor: HTMLElement, originId: string) => void }) {
  return splitPdfInlineFootnoteReferences(text).map((part, partIndex) => {
    if (part.kind === "text") return <Box component="span" data-pdf-text data-pdf-source-page={pageNumber} data-pdf-source-marker={sourceStart && partIndex === 0 ? "" : undefined} key={`${partIndex}-${part.text}`}>{part.text}</Box>;
    const id = `pdf-footnote-ref-${pageNumber}-${footnoteMarkerKey(part.marker)}-${blockIndex}-${partIndex}`;
    return (
      <ButtonBase
        component="button"
        data-pdf-source-page={pageNumber}
        data-pdf-source-marker={sourceStart && partIndex === 0 ? "" : undefined}
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
