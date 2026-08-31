import { applyPdfTextAnnotations } from "./pdf-annotations";
import type { Annotation } from "../../domain/types";

describe("applyPdfTextAnnotations", () => {
  it("keeps a highlighted note visibly colored across PDF text spans", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>黄昏从山脊落下，河面先暗</span><span>了一层，渡船归岸。</span>";
    const annotation: Annotation = {
      id: "annotation-pink-note",
      bookId: "book-pdf",
      type: "NOTE",
      locator: "pdf:page=3&offset=1",
      quote: "河面先暗了一层",
      note: "记住这层暮色",
      style: "HIGHLIGHT",
      color: "PINK",
      createdAt: "2026-08-21T00:00:00Z",
    };

    applyPdfTextAnnotations(layer, 3, [annotation], { overlaysCanvasText: true });

    const marks = Array.from(layer.querySelectorAll("mark"));
    expect(marks).toHaveLength(2);
    expect(marks.map((mark) => mark.textContent).join("")).toBe("河面先暗了一层");
    marks.forEach((mark) => {
      expect(mark).toHaveAttribute("data-highlight-color", "PINK");
      expect(mark.style.background).toContain("rgba(255, 179, 209");
      expect(mark.style.background).toContain("0.34");
      expect(mark.style.mixBlendMode).toBe("multiply");
    });
  });

  it("renders underline and bold annotations as real PDF text styles", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>山里的灯并不多，窗在暮色里亮起。</span><span>有人仍守着火。</span>";
    const base = {
      bookId: "book-pdf",
      type: "HIGHLIGHT" as const,
      locator: "pdf:page=4&offset=2",
      color: "GREEN" as const,
      createdAt: "2026-08-21T00:00:00Z",
    };
    const annotations: Annotation[] = [
      { ...base, id: "underline", quote: "窗在暮色里亮起", style: "UNDERLINE" },
      { ...base, id: "bold", quote: "有人仍守着火", style: "BOLD" },
    ];

    applyPdfTextAnnotations(layer, 4, annotations);

    const underline = layer.querySelector<HTMLElement>("[data-annotation-id='underline']");
    const bold = layer.querySelector<HTMLElement>("[data-annotation-id='bold']");
    expect(underline?.style.textDecoration).toBe("underline");
    expect(underline?.style.textDecorationThickness).toBe("3px");
    expect(bold?.style.fontWeight).toBe("700");
  });

  it("renders a newly appended virtual-page annotation on the existing PDF text layer", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>选择文字后应立即在正文中显示高亮。</span>";
    const annotation: Annotation = {
      id: "live-highlight",
      bookId: "book-pdf",
      type: "HIGHLIGHT",
      locator: "pdf:page=1&offset=3",
      quote: "立即在正文中显示高亮",
      style: "HIGHLIGHT",
      color: "BLUE",
      createdAt: "2026-08-23T00:00:00Z",
    };

    applyPdfTextAnnotations(layer, 1, []);
    expect(layer.querySelector("mark")).toBeNull();

    applyPdfTextAnnotations(layer, 1, [annotation]);

    expect(layer.querySelector("[data-annotation-id='live-highlight']")).toHaveTextContent("立即在正文中显示高亮");
  });
});
