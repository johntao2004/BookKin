import { applyEpubInlineAnnotation, clearEpubInlineAnnotations, findEpubTextRange } from "./epub-annotations";
import type { Annotation } from "../../domain/types";

function annotation(style: "HIGHLIGHT" | "UNDERLINE" | "BOLD", id: string): Annotation {
  return {
    id,
    bookId: "book-epub",
    type: "HIGHLIGHT",
    locator: "epubcfi(/6/2!/4/2)",
    quote: "河面先暗了一层",
    style,
    color: "YELLOW",
    createdAt: "2026-08-21T00:00:00Z",
  };
}

describe("EPUB inline annotations", () => {
  it("places a translucent highlight behind EPUB text instead of an SVG overlay above it", () => {
    document.body.innerHTML = "<p>黄昏从山脊落下，河面先暗了一层，渡船归岸。</p>";
    const range = findEpubTextRange(document, "河面先暗了一层");

    expect(applyEpubInlineAnnotation(range!, annotation("HIGHLIGHT", "highlight-1"))).toBe(1);
    const wrapper = document.querySelector<HTMLElement>("[data-annotation-style='HIGHLIGHT']");
    expect(wrapper).toHaveTextContent("河面先暗了一层");
    expect(wrapper?.style.getPropertyValue("background-color")).toContain("rgba(255, 243, 109, 0.34)");
    expect(wrapper?.style.getPropertyPriority("background-color")).toBe("important");
    expect(wrapper?.style.getPropertyValue("color")).toBe("inherit");
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
});
