// 把批注样式应用到 EPUB 文档范围，清理旧标记后重建，避免叠加重复包装。
// Applies annotation styles to EPUB ranges, rebuilding after old markers are cleared to avoid repeated wrappers.
import { annotationColorHex, readerHighlightStyle, type AnnotationTextTheme } from "../../domain/annotation-colors";
import type { Annotation } from "../../domain/types";
import { tokens } from "../../theme/generated-tokens";

export const EPUB_INLINE_ANNOTATION_CLASS = "page-annotation-inline";

function isReadableTextNode(node: Text) {
  const parent = node.parentElement;
  return Boolean(node.data && parent && !parent.closest("script, style, noscript"));
}

export function findEpubTextRange(document: Document, quote: string, searchRoot: Node = document.body) {
  const root = searchRoot;
  const normalizedQuote = quote.replace(/\s/gu, "");
  if (!root || !normalizedQuote) return undefined;

  const nodeFilter = document.defaultView?.NodeFilter ?? NodeFilter;
  const walker = document.createTreeWalker(root, nodeFilter.SHOW_TEXT);
  const characters: Array<{ node: Text; offset: number; value: string }> = [];
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    if (isReadableTextNode(node)) {
      for (let offset = 0; offset < node.data.length; offset += 1) {
        const value = node.data[offset];
        if (!/\s/u.test(value)) characters.push({ node, offset, value });
      }
    }
    current = walker.nextNode();
  }

  const start = characters.map((character) => character.value).join("").indexOf(normalizedQuote);
  if (start < 0) return undefined;
  const first = characters[start];
  const last = characters[start + normalizedQuote.length - 1];
  if (!first || !last) return undefined;

  const range = document.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset + 1);
  return range;
}

export function isEpubArticleParagraphLocator(locator: string) {
  return /^(?:article\.xhtml#)?p-\d+$/u.test(locator);
}

export function findEpubArticleParagraphRange(document: Document, locator: string, quote: string) {
  const match = /^(?:article\.xhtml#)?(p-\d+)$/u.exec(locator);
  const paragraph = match?.[1] ? document.getElementById(match[1]) : null;
  if (!paragraph || !quote) return undefined;
  return findEpubTextRange(document, quote, paragraph);
}

export function clearEpubInlineAnnotations(document: Document) {
  document.querySelectorAll<HTMLElement>(`.${EPUB_INLINE_ANNOTATION_CLASS}`).forEach((wrapper) => {
    const parent = wrapper.parentNode;
    if (!parent) return;
    while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  });
  document.body?.normalize();
}

export function applyEpubInlineAnnotation(range: Range, annotation: Annotation, theme: AnnotationTextTheme = {
  background: tokens.color.semantic.canvas,
  foreground: tokens.color.semantic.textPrimary,
}) {
  if (range.collapsed) return 0;
  const document = range.startContainer.ownerDocument;
  if (!document) return 0;
  const root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
    ? range.commonAncestorContainer.parentNode
    : range.commonAncestorContainer;
  if (!root) return 0;

  const nodeFilter = document.defaultView?.NodeFilter ?? NodeFilter;
  const walker = document.createTreeWalker(root, nodeFilter.SHOW_TEXT);
  const selected: Array<{ node: Text; start: number; end: number }> = [];
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    if (isReadableTextNode(node) && range.intersectsNode(node)) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.data.length;
      if (end > start) selected.push({ node, start, end });
    }
    current = walker.nextNode();
  }

  selected.reverse().forEach(({ node, start, end }) => {
    const selectedText = node.splitText(start);
    selectedText.splitText(end - start);
    const wrapper = document.createElement("span");
    wrapper.className = EPUB_INLINE_ANNOTATION_CLASS;
    wrapper.dataset.annotationId = annotation.id;
    wrapper.dataset.annotationStyle = annotation.style;
    wrapper.dataset.highlightColor = annotation.color ?? "YELLOW";
    wrapper.style.setProperty("color", "inherit", "important");
    wrapper.style.setProperty("box-decoration-break", "clone");
    wrapper.style.setProperty("-webkit-box-decoration-break", "clone");
    if (annotation.style === "HIGHLIGHT") {
      const highlight = readerHighlightStyle(annotation.color, theme);
      wrapper.style.setProperty("background-color", highlight.background, "important");
      wrapper.style.setProperty("color", highlight.color, "important");
    } else if (annotation.style === "BOLD") {
      wrapper.style.setProperty("font-weight", "700", "important");
    } else {
      const color = annotationColorHex(annotation.color);
      wrapper.style.setProperty("text-decoration-line", "underline", "important");
      wrapper.style.setProperty("text-decoration-color", color, "important");
      wrapper.style.setProperty("text-decoration-thickness", "3px", "important");
      wrapper.style.setProperty("text-underline-offset", "0.2em", "important");
      wrapper.style.setProperty("text-decoration-skip-ink", "none", "important");
    }
    selectedText.parentNode?.insertBefore(wrapper, selectedText);
    wrapper.append(selectedText);
  });

  return selected.length;
}
