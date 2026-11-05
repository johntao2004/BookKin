// 把 PDF 页码、定位与文本匹配转换为可见标记，保留已有阅读文本结构。
// Maps PDF page/locator/text matching to visible annotations while preserving reading text structure.
import { annotationColorBackground, annotationColorHex, readerHighlightStyle, type AnnotationTextTheme } from "../../domain/annotation-colors";
import type { Annotation } from "../../domain/types";

interface Segment {
  start: number;
  end: number;
  annotation: Annotation;
}

export function applyPdfTextAnnotations(
  layer: HTMLElement,
  pageNumber: number,
  annotations: Annotation[],
  options: { overlaysCanvasText?: boolean; theme?: AnnotationTextTheme } = {},
) {
  const allSpans = Array.from(layer.querySelectorAll<HTMLSpanElement>("span"));
  const hasSourcePageSpans = allSpans.some((span) => span.dataset.pdfSourcePage !== undefined);
  const spans = allSpans.filter((span) => hasSourcePageSpans
    ? Number(span.dataset.pdfSourcePage) === pageNumber
    : true);
  spans.forEach((span) => {
    if (span.dataset.pdfOriginalText === undefined) span.dataset.pdfOriginalText = span.textContent ?? "";
    else if (span.querySelector("mark") || span.textContent !== span.dataset.pdfOriginalText) span.textContent = span.dataset.pdfOriginalText;
  });
  const characters: Array<{ span: HTMLSpanElement; offset: number; value: string }> = [];
  spans.forEach((span) => {
    const text = span.textContent ?? "";
    for (let offset = 0; offset < text.length; offset += 1) {
      const value = text[offset];
      if (!/\s/u.test(value)) characters.push({ span, offset, value });
    }
  });
  const normalizedText = characters.map((character) => character.value).join("");
  const occupied = new Set<number>();
  const segmentsBySpan = new Map<HTMLSpanElement, Segment[]>();
  const notedAnnotations = new Set<string>();

  annotations
    .filter((annotation) => annotation.type !== "BOOKMARK" && pdfPageFromLocator(annotation.locator) === pageNumber && annotation.quote)
    .forEach((annotation) => {
      const quote = annotation.quote!.replace(/\s/gu, "");
      if (!quote) return;
      const start = normalizedText.indexOf(quote);
      if (start < 0) return;
      const characterIndexes = Array.from({ length: quote.length }, (_, index) => start + index);
      if (characterIndexes.some((index) => occupied.has(index))) return;
      characterIndexes.forEach((index) => occupied.add(index));

      const bounds = new Map<HTMLSpanElement, { start: number; end: number }>();
      characterIndexes.forEach((index) => {
        const character = characters[index];
        if (!character) return;
        const current = bounds.get(character.span);
        bounds.set(character.span, {
          start: current ? Math.min(current.start, character.offset) : character.offset,
          end: current ? Math.max(current.end, character.offset + 1) : character.offset + 1,
        });
      });
      bounds.forEach((bound, span) => {
        segmentsBySpan.set(span, [...(segmentsBySpan.get(span) ?? []), { ...bound, annotation }]);
      });
    });

  for (const span of spans) {
    const segments = segmentsBySpan.get(span);
    if (!segments) continue;
    const text = span.textContent ?? "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    segments.sort((left, right) => left.start - right.start).forEach((segment) => {
      if (segment.start > cursor) fragment.append(text.slice(cursor, segment.start));
      const mark = document.createElement("mark");
      mark.dataset.annotationId = segment.annotation.id;
      mark.dataset.highlightColor = segment.annotation.color ?? "YELLOW";
      if (segment.annotation.id) {
        mark.setAttribute("role", "button");
        mark.setAttribute("aria-label", "编辑划线或笔记");
        mark.tabIndex = notedAnnotations.has(segment.annotation.id) ? -1 : 0;
        mark.style.cursor = "pointer";
        notedAnnotations.add(segment.annotation.id);
      }
      mark.textContent = text.slice(segment.start, segment.end);
      mark.style.color = "inherit";
      mark.style.borderRadius = "var(--radius-md)";
      mark.style.background = segment.annotation.style === "HIGHLIGHT"
        ? annotationColorBackground(segment.annotation.color)
        : "transparent";
      if (segment.annotation.style === "HIGHLIGHT" && !options.overlaysCanvasText && options.theme) {
        const highlight = readerHighlightStyle(segment.annotation.color, options.theme);
        mark.style.background = highlight.background;
        mark.style.color = highlight.color;
      }
      if (segment.annotation.style === "HIGHLIGHT" && options.overlaysCanvasText) {
        mark.style.mixBlendMode = "multiply";
      }
      if (segment.annotation.style === "UNDERLINE") {
        mark.style.textDecoration = "underline";
        mark.style.textDecorationColor = annotationColorHex(segment.annotation.color);
        mark.style.textDecorationThickness = "3px";
        mark.style.textUnderlineOffset = "3px";
        mark.style.textDecorationSkipInk = "none";
      }
      if (segment.annotation.style === "BOLD") mark.style.fontWeight = "700";
      fragment.append(mark);
      cursor = segment.end;
    });
    if (cursor < text.length) fragment.append(text.slice(cursor));
    span.replaceChildren(fragment);
  }
}

function pdfPageFromLocator(locator?: string) {
  if (!locator) return null;
  const match = locator.match(/^pdf:page=(\d+)(?:&|$)/u);
  return match ? Number(match[1]) : null;
}
