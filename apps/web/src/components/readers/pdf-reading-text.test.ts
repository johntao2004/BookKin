import { describe, expect, it } from "vitest";
import { pdfTextToParagraphs, pdfTextToReadingBlocks, splitPdfInlineFootnoteReferences } from "./pdf-reading-text";

const item = (str: string, x: number, y: number, options: { width?: number; height?: number; hasEOL?: boolean } = {}) => ({
  str,
  transform: [1, 0, 0, options.height ?? 12, x, y],
  width: options.width ?? str.length * 8,
  height: options.height ?? 12,
  hasEOL: options.hasEOL ?? false,
});

describe("pdfTextToParagraphs", () => {
  it("reflows consecutive Chinese PDF lines into a reading paragraph", () => {
    const paragraphs = pdfTextToParagraphs([
      item("黄昏从山脊落下来时，", 48, 720, { hasEOL: true }),
      item("河面先暗了一层。", 36, 704, { hasEOL: true }),
    ]);

    expect(paragraphs).toEqual(["黄昏从山脊落下来时，河面先暗了一层。"]);
  });

  it("keeps visibly indented lines as separate paragraphs", () => {
    const paragraphs = pdfTextToParagraphs([
      item("第一段结束。", 36, 720, { hasEOL: true }),
      item("第二段开始。", 56, 704, { hasEOL: true }),
    ]);

    expect(paragraphs).toEqual(["第一段结束。", "第二段开始。"]);
  });

  it("preserves spaces between split Latin words and ignores non-text items", () => {
    const paragraphs = pdfTextToParagraphs([
      item("HELLO", 36, 720, { width: 35 }),
      { type: "beginMarkedContent", id: "text" },
      item("WORLD", 76, 720, { width: 66, hasEOL: true }),
    ]);

    expect(paragraphs).toEqual(["HELLO WORLD"]);
  });

  it("returns no fabricated content for image-only pages", () => {
    expect(pdfTextToParagraphs([{ type: "beginMarkedContent" }])).toEqual([]);
  });

  it("structures table-of-contents entries instead of joining them into prose", () => {
    const blocks = pdfTextToReadingBlocks([
      item("目", 236, 615, { width: 26, height: 26 }),
      item("录", 340, 615, { width: 26, height: 26, hasEOL: true }),
      item("社会主义革命和社会主义建设时期（一）", 150, 556, { height: 18, hasEOL: true }),
      item("中国人民站起来了（一九四九年九月二十一日）…………………3—7", 90, 505, { height: 16, hasEOL: true }),
      item("永远保持艰苦奋斗的作风（一九四九年十月", 90, 436, { height: 16, hasEOL: true }),
      item("二十六日）……………………………12", 108, 413, { height: 12, hasEOL: true }),
    ]);

    expect(blocks).toEqual([
      { kind: "heading", text: "目录" },
      { kind: "heading", text: "社会主义革命和社会主义建设时期（一）" },
      { kind: "toc-entry", text: "中国人民站起来了（一九四九年九月二十一日）", pageLabel: "3—7" },
      { kind: "toc-entry", text: "永远保持艰苦奋斗的作风（一九四九年十月二十六日）", pageLabel: "12" },
    ]);
  });

  it("keeps superscript references inline and separates page footnotes", () => {
    const blocks = pdfTextToReadingBlocks([
      item("我们曾和蒋介石国民党一道开过一次政治协商会议", 90, 161, { width: 352, height: 16 }),
      item("[1]", 442, 169, { width: 12, height: 8 }),
      item("。那次", 454, 161, { width: 40, height: 16, hasEOL: true }),
      item("* 这是毛泽东同志在中国人民政治协商会议第一届全体会议上", 125, 136, { height: 14, hasEOL: true }),
      item("的开幕词。", 139, 113, { height: 14 }),
    ]);

    expect(blocks).toEqual([
      { kind: "paragraph", text: "我们曾和蒋介石国民党一道开过一次政治协商会议[1]。那次" },
      { kind: "footnote", marker: "*", text: "这是毛泽东同志在中国人民政治协商会议第一届全体会议上的开幕词。" },
    ]);
  });

  it("recognizes numbered notes in a notes section", () => {
    const blocks = pdfTextToReadingBlocks([
      item("注", 122, 561, { width: 12, height: 12 }),
      item("释", 158, 561, { width: 12, height: 12, hasEOL: true }),
      item("[1]参看本书第四卷《以自卫战争粉碎蒋介石的进攻》[2]。", 122, 538, { height: 12, hasEOL: true }),
    ]);

    expect(blocks).toEqual([
      { kind: "heading", text: "注释" },
      { kind: "footnote", marker: "[1]", text: "参看本书第四卷《以自卫战争粉碎蒋介石的进攻》[2]。" },
    ]);
  });

  it("splits common Chinese footnote markers into clickable references", () => {
    expect(splitPdfInlineFootnoteReferences("标题*与正文［1］、〔2〕")).toEqual([
      { kind: "text", text: "标题" },
      { kind: "footnote-reference", marker: "*" },
      { kind: "text", text: "与正文" },
      { kind: "footnote-reference", marker: "[1]" },
      { kind: "text", text: "、" },
      { kind: "footnote-reference", marker: "[2]" },
    ]);
  });
});
