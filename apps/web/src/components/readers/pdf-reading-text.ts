export interface PdfTextItemLike {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

interface ReadingLine {
  text: string;
  x: number;
  y: number;
  height: number;
  endX: number;
}

export type PdfReadingBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "toc-entry"; text: string; pageLabel: string }
  | { kind: "footnote"; marker: string; text: string };

export type PdfInlineTextPart =
  | { kind: "text"; text: string }
  | { kind: "footnote-reference"; marker: string };

export function pdfTextToReadingBlocks(items: unknown[]): PdfReadingBlock[] {
  const lines = buildLines(items);
  if (lines.length === 0) return [];
  if (isTableOfContents(lines)) return tableOfContentsBlocks(lines);
  return reflowParagraphs(lines).map(readingBlockFromParagraph);
}

export function pdfTextToParagraphs(items: unknown[]): string[] {
  return reflowParagraphs(buildLines(items));
}

function buildLines(items: unknown[]): ReadingLine[] {
  const lines: ReadingLine[] = [];
  let current: ReadingLine | null = null;

  items.filter(isTextItem).forEach((item) => {
    const text = normalizeText(item.str);
    if (!text) {
      if (item.hasEOL && current) {
        lines.push(current);
        current = null;
      }
      return;
    }

    const x = finite(item.transform[4]);
    const y = finite(item.transform[5]);
    const height = Math.max(1, Math.abs(finite(item.height) || finite(item.transform[3]) || 12));
    const width = Math.max(0, finite(item.width));
    const startsNewLine = current && Math.abs(current.y - y) > Math.max(2, Math.max(current.height, height) * 0.55);
    if (startsNewLine && current) {
      lines.push(current);
      current = null;
    }

    if (!current) {
      current = { text, x, y, height, endX: x + width };
    } else {
      const gap = x - current.endX;
      current.text += tokenSeparator(current.text, text, gap, height) + text;
      current.height = Math.max(current.height, height);
      current.endX = Math.max(current.endX, x + width);
    }

    if (item.hasEOL && current) {
      lines.push(current);
      current = null;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function reflowParagraphs(lines: ReadingLine[]): string[] {
  if (lines.length === 0) return [];

  const paragraphs: string[] = [];
  let paragraph = lines[0].text;
  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1];
    const line = lines[index];
    const referenceHeight = Math.max(previous.height, line.height);
    const verticalGap = Math.abs(previous.y - line.y);
    const fontScaleChanged = Math.max(previous.height, line.height) / Math.max(1, Math.min(previous.height, line.height)) > 1.35;
    const visiblyIndented = line.x - previous.x > referenceHeight * 1.15;
    const startsFootnote = Boolean(parseFootnote(line.text));
    const startsParagraph = startsFootnote || fontScaleChanged || visiblyIndented || verticalGap > referenceHeight * 1.65;

    if (startsParagraph) {
      paragraphs.push(paragraph.trim());
      paragraph = line.text;
    } else {
      paragraph += lineSeparator(paragraph, line.text) + line.text;
    }
  }
  paragraphs.push(paragraph.trim());
  return paragraphs.filter(Boolean);
}

function readingBlockFromParagraph(text: string): PdfReadingBlock {
  if (text.replace(/\s/gu, "") === "注释") return { kind: "heading", text: "注释" };
  return parseFootnote(text) ?? { kind: "paragraph", text };
}

function parseFootnote(value: string): Extract<PdfReadingBlock, { kind: "footnote" }> | null {
  const match = value.trim().match(/^(\*|\[\d+\]|［\d+］|〔\d+〕)\s*(.+)$/u);
  if (!match?.[1] || !match[2]) return null;
  return { kind: "footnote", marker: normalizeFootnoteMarker(match[1]), text: match[2].trim() };
}

export function splitPdfInlineFootnoteReferences(value: string): PdfInlineTextPart[] {
  const parts: PdfInlineTextPart[] = [];
  let cursor = 0;
  const pattern = /(\*|\[\d+\]|［\d+］|〔\d+〕)/gu;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ kind: "text", text: value.slice(cursor, index) });
    parts.push({ kind: "footnote-reference", marker: normalizeFootnoteMarker(match[0]) });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) parts.push({ kind: "text", text: value.slice(cursor) });
  return parts.length > 0 ? parts : [{ kind: "text", text: value }];
}

function normalizeFootnoteMarker(value: string) {
  const number = value.match(/\d+/u)?.[0];
  return number ? `[${number}]` : value;
}

function isTableOfContents(lines: ReadingLine[]) {
  const hasContentsHeading = lines.some((line) => line.text.replace(/\s/gu, "") === "目录");
  const leaderLines = lines.filter((line) => parseTableOfContentsEntry(line.text)).length;
  return hasContentsHeading || leaderLines >= 3;
}

function tableOfContentsBlocks(lines: ReadingLine[]): PdfReadingBlock[] {
  const contentLines = lines.filter((line) => line.text.replace(/\s/gu, "") !== "目录");
  const leftEdge = Math.min(...contentLines.map((line) => line.x));
  const sortedHeights = contentLines.map((line) => line.height).sort((left, right) => left - right);
  const medianHeight = sortedHeights[Math.floor(sortedHeights.length / 2)] ?? 1;
  const blocks: PdfReadingBlock[] = [];
  let pending: string[] = [];

  const flushPending = () => {
    const text = pending.join("").trim();
    if (text) blocks.push({ kind: "paragraph", text });
    pending = [];
  };

  lines.forEach((line) => {
    if (line.text.replace(/\s/gu, "") === "目录") {
      flushPending();
      blocks.push({ kind: "heading", text: "目录" });
      return;
    }

    const directEntry = parseTableOfContentsEntry(line.text);
    if (directEntry && pending.length === 0) {
      blocks.push(directEntry);
      return;
    }

    const centeredSection = pending.length === 0
      && line.x > leftEdge + line.height * 2
      && line.height >= medianHeight;
    if (centeredSection) {
      blocks.push({ kind: "heading", text: line.text });
      return;
    }

    pending.push(line.text);
    const wrappedEntry = parseTableOfContentsEntry(pending.join(""));
    if (wrappedEntry) {
      blocks.push(wrappedEntry);
      pending = [];
    }
  });
  flushPending();
  return blocks;
}

function parseTableOfContentsEntry(value: string): PdfReadingBlock | null {
  const match = value.trim().match(/^(.*?)[.…·]{3,}\s*(\d+(?:\s*[—–-]\s*\d+)?)$/u);
  if (!match?.[1] || !match[2]) return null;
  return {
    kind: "toc-entry",
    text: match[1].trim(),
    pageLabel: match[2].replace(/\s/gu, ""),
  };
}

function isTextItem(value: unknown): value is PdfTextItemLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PdfTextItemLike>;
  return typeof candidate.str === "string" && Array.isArray(candidate.transform) && candidate.transform.length >= 6;
}

function normalizeText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function tokenSeparator(previous: string, next: string, gap: number, height: number) {
  if (!previous || !next || /\s$/u.test(previous) || /^\s/u.test(next)) return "";
  const latinBoundary = /[A-Za-z0-9)]$/u.test(previous) && /^[A-Za-z0-9(]/u.test(next);
  return latinBoundary || gap > height * 0.42 ? " " : "";
}

function lineSeparator(previous: string, next: string) {
  return /[A-Za-z0-9,;:)]$/u.test(previous) && /^[A-Za-z0-9(]/u.test(next) ? " " : "";
}

function finite(value: number | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}
