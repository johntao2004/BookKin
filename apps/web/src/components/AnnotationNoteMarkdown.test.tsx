import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnnotationNoteMarkdown, annotationNotePlainText } from "./AnnotationNoteMarkdown";

describe("annotation note Markdown", () => {
  it("renders sanitized prose without loading remote or private images", () => {
    const { container } = render(<AnnotationNoteMarkdown markdown={'**强调** ![私图](/api/v1/articles/assets/00000000-0000-0000-0000-000000000000) ![远程](https://example.com/image.png)'} />);
    expect(screen.getByText("强调")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.textContent).toContain("私图");
    expect(container.textContent).toContain("远程");
    expect(container.querySelector('[href^="https://"]')).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("extracts readable text without Markdown delimiters", () => {
    expect(annotationNotePlainText("**加粗**\n\n- 一项")).toBe("加粗 一项");
  });
});
