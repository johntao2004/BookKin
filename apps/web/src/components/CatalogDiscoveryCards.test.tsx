import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BrowseBook } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { CoverMosaic } from "./CatalogDiscoveryCards";

const makeBooks = (count: number): BrowseBook[] => Array.from({ length: count }, (_, index) => ({
  id: `book-${index + 1}`,
  title: `Book ${index + 1}`,
  author: "Author",
  coverUrl: `/covers/${index + 1}.jpg`,
  available: true,
  addedAt: "2026-10-22T00:00:00Z",
}));

describe("CoverMosaic", () => {
  it.each([
    [0, "empty", "0"],
    [1, "single", "1"],
    [2, "pair", "2"],
    [3, "row", "3"],
    [4, "quad", "2"],
  ] as const)("uses the %s-cover layout", (count, layout, columns) => {
    const { unmount } = render(<CoverMosaic books={makeBooks(count)} label="测试书目封面" compact />);
    const mosaic = screen.getByRole("img", { name: "测试书目封面" });

    expect(mosaic).toHaveAttribute("data-mosaic-layout", layout);
    expect(mosaic).toHaveAttribute("data-mosaic-columns", columns);
    expect(mosaic.querySelectorAll("[data-book-cover]")).toHaveLength(count);

    if (count > 0) {
      const content = mosaic.querySelector("[data-mosaic-content]");
      expect(content).not.toBeNull();
      expect(getComputedStyle(content!).gap).toBe(`${tokens.spacing[1]}px`);
      for (const frame of mosaic.querySelectorAll("[data-book-cover]")) {
        expect(getComputedStyle(frame).aspectRatio).toBe("3 / 4");
      }
    } else {
      expect(mosaic.querySelector("[data-mosaic-content]")).toBeNull();
      expect(mosaic.querySelector("[data-book-cover]")).toBeNull();
    }
    unmount();
  });

  it("keeps the empty state in the same frame geometry as a populated compact mosaic", () => {
    const { rerender } = render(<CoverMosaic books={[]} label="书目封面" compact />);
    const empty = screen.getByRole("img", { name: "书目封面" });
    const emptyFrameStyle = getComputedStyle(empty);

    rerender(<CoverMosaic books={makeBooks(4)} label="书目封面" compact />);
    const populated = screen.getByRole("img", { name: "书目封面" });
    const populatedFrameStyle = getComputedStyle(populated);

    expect(emptyFrameStyle.aspectRatio).toBe(populatedFrameStyle.aspectRatio);
    expect(emptyFrameStyle.borderRadius).toBe(populatedFrameStyle.borderRadius);
    expect(emptyFrameStyle.backgroundColor).toBe(populatedFrameStyle.backgroundColor);
  });
});
