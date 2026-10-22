// 验证 EPUB 实际文本上的高亮、下划线和粗体可应用与清理，而非只检查保存返回值。
// Checks highlight, underline and bold on actual EPUB text with cleanup, not only save responses.
import { applyEpubInlineAnnotation, clearEpubInlineAnnotations, findEpubArticleParagraphRange, findEpubTextRange } from "./epub-annotations";
import type { Annotation } from "../../domain/types";
import { bookKinThemeOptions } from "../../theme/theme";
import { readerHighlightStyle } from "../../domain/annotation-colors";

function opaqueHex(cssColor: string | undefined) {
  if (!cssColor) throw new Error("Expected an opaque color");
  const hex = /^#[\da-f]{6}$/iu.exec(cssColor)?.[0];
  if (hex) return hex.toLowerCase();
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/iu.exec(cssColor);
  if (!rgb) throw new Error(`Expected an opaque six-digit color, received ${cssColor}`);
  return `#${rgb.slice(1).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
}

function annotation(style: "HIGHLIGHT" | "UNDERLINE" | "BOLD", id: string, color: Annotation["color"] = "YELLOW", quote = "河面先暗了一层"): Annotation {
  return {
    id,
    bookId: "book-epub",
    type: "HIGHLIGHT",
    locator: "epubcfi(/6/2!/4/2)",
    quote,
    style,
    color,
    createdAt: "2026-08-21T00:00:00Z",
  };
}

describe("EPUB inline annotations", () => {
  it("places an opaque theme-colored highlight behind EPUB text", () => {
    document.body.innerHTML = "<p>黄昏从山脊落下，河面先暗了一层，渡船归岸。</p>";
    const range = findEpubTextRange(document, "河面先暗了一层");
    const theme = bookKinThemeOptions.PAPER.reader;

    expect(applyEpubInlineAnnotation(range!, annotation("HIGHLIGHT", "highlight-1"))).toBe(1);
    const wrapper = document.querySelector<HTMLElement>("[data-annotation-style='HIGHLIGHT']");
    expect(wrapper).toHaveTextContent("河面先暗了一层");
    expect(opaqueHex(wrapper?.style.getPropertyValue("background-color")))
      .toBe(readerHighlightStyle("YELLOW", theme).background);
    expect(wrapper?.style.getPropertyPriority("background-color")).toBe("important");
    expect(opaqueHex(wrapper?.style.getPropertyValue("color"))).toBe(theme.foreground.toLowerCase());
    expect(wrapper?.style.getPropertyPriority("color")).toBe("important");
  });

  it("keeps nested two- and three-layer highlights opaque with foreground over linked text", () => {
    document.body.innerHTML = "<p><a id='source-link' style='color: #CC785C !important'>甲乙丙丁戊己</a></p>";
    const theme = bookKinThemeOptions.NIGHT.reader;
    const layers = [
      { id: "outer", quote: "甲乙丙丁戊己", color: "YELLOW" as const },
      { id: "middle", quote: "丙丁戊己", color: "PINK" as const },
      { id: "inner", quote: "戊己", color: "BLUE" as const },
    ];

    layers.forEach(({ id, quote, color }) => {
      const range = findEpubTextRange(document, quote);
      expect(range).toBeDefined();
      expect(applyEpubInlineAnnotation(range!, annotation("HIGHLIGHT", id, color, quote), theme)).toBe(1);
    });

    const wrappers = layers.map(({ id }) => document.querySelector<HTMLElement>(`[data-annotation-id='${id}']`));
    expect(wrappers.every(Boolean)).toBe(true);
    expect(wrappers[1]?.parentElement).toBe(wrappers[0]);
    expect(wrappers[2]?.parentElement).toBe(wrappers[1]);
    wrappers.forEach((wrapper, index) => {
      expect(opaqueHex(wrapper?.style.getPropertyValue("background-color")))
        .toBe(readerHighlightStyle(layers[index].color, theme).background);
      expect(opaqueHex(wrapper?.style.getPropertyValue("color"))).toBe(theme.foreground.toLowerCase());
      expect(wrapper?.style.getPropertyPriority("color")).toBe("important");
    });
    expect(opaqueHex(document.querySelector<HTMLElement>("#source-link")?.style.getPropertyValue("color"))).toBe("#cc785c");
    expect(wrappers[2]).toHaveTextContent("戊己");
  });

  it("cleans and rebuilds highlights with the newly selected theme", () => {
    document.body.innerHTML = "<p><a id='source-link' style='color: #CC785C !important'>主题切换文字</a></p>";
    const nightTheme = bookKinThemeOptions.NIGHT.reader;
    const paperTheme = bookKinThemeOptions.PAPER.reader;
    const initialRange = findEpubTextRange(document, "主题切换文字");
    expect(applyEpubInlineAnnotation(initialRange!, annotation("HIGHLIGHT", "night-highlight", "GREEN", "主题切换文字"), nightTheme)).toBe(1);
    expect(opaqueHex(document.querySelector<HTMLElement>("[data-annotation-id='night-highlight']")?.style.color))
      .toBe(nightTheme.foreground.toLowerCase());

    clearEpubInlineAnnotations(document);
    expect(document.querySelector("[data-annotation-id]")).toBeNull();
    expect(document.querySelector("#source-link")?.textContent).toBe("主题切换文字");

    const rebuiltRange = findEpubTextRange(document, "主题切换文字");
    expect(applyEpubInlineAnnotation(rebuiltRange!, annotation("HIGHLIGHT", "paper-highlight", "PINK", "主题切换文字"), paperTheme)).toBe(1);
    const rebuilt = document.querySelector<HTMLElement>("[data-annotation-id='paper-highlight']");
    expect(opaqueHex(rebuilt?.style.getPropertyValue("background-color")))
      .toBe(readerHighlightStyle("PINK", paperTheme).background);
    expect(opaqueHex(rebuilt?.style.getPropertyValue("color"))).toBe(paperTheme.foreground.toLowerCase());
  });

  it("applies an underline across multiple text nodes and can cleanly remove it", () => {
    document.body.innerHTML = "<p>黄昏从山脊落下，河面先暗</p><p>了一层，渡船归岸。</p>";
    const range = findEpubTextRange(document, "河面先暗了一层");

    expect(range).toBeDefined();
    expect(applyEpubInlineAnnotation(range!, annotation("UNDERLINE", "underline-1"))).toBe(2);
    const wrappers = Array.from(document.querySelectorAll<HTMLElement>("[data-annotation-style='UNDERLINE']"));
    expect(wrappers.map((wrapper) => wrapper.textContent).join("")).toBe("河面先暗了一层");
    wrappers.forEach((wrapper) => {
      expect(wrapper.style.getPropertyValue("text-decoration-line")).toBe("underline");
      expect(wrapper.style.getPropertyValue("text-decoration-thickness")).toBe("3px");
    });

    clearEpubInlineAnnotations(document);
    expect(document.querySelector("[data-annotation-style]")).toBeNull();
    expect(document.body.textContent).toContain("河面先暗了一层");
  });

  it("applies a visible bold weight to the selected EPUB text", () => {
    document.body.innerHTML = "<p>黄昏从山脊落下，河面先暗了一层，渡船归岸。</p>";
    const range = findEpubTextRange(document, "河面先暗了一层");

    expect(applyEpubInlineAnnotation(range!, annotation("BOLD", "bold-1"))).toBe(1);
    const wrapper = document.querySelector<HTMLElement>("[data-annotation-style='BOLD']");
    expect(wrapper).toHaveTextContent("河面先暗了一层");
    expect(wrapper?.style.getPropertyValue("font-weight")).toBe("700");
    expect(wrapper?.style.getPropertyPriority("font-weight")).toBe("important");
  });

  it("keeps a legacy paragraph highlight inside the paragraph named by its locator", () => {
    document.body.innerHTML = "<p id='p-1'>共享片段</p><p id='p-2'>共享片段</p>";
    const range = findEpubArticleParagraphRange(document, "article.xhtml#p-2", "共享片段");

    expect(range).toBeDefined();
    expect(applyEpubInlineAnnotation(range!, annotation("HIGHLIGHT", "legacy-p-2"))).toBe(1);
    expect(document.querySelector("#p-1 [data-annotation-id]")).toBeNull();
    expect(document.querySelector("#p-2 [data-annotation-id]")).toHaveTextContent("共享片段");
  });

  it("does not find a legacy quote in a neighboring paragraph", () => {
    document.body.innerHTML = "<p id='p-1'>前半段</p><p id='p-2'>后半段</p>";

    expect(findEpubArticleParagraphRange(document, "p-1", "前半段后半段")).toBeUndefined();
  });
});
