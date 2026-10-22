import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { BookCover } from "./BookCover";

function loadCover(width: number, height: number) {
  const image = screen.getByRole("img", { name: "测试封面" });
  Object.defineProperties(image, { naturalWidth: { configurable: true, value: width }, naturalHeight: { configurable: true, value: height } });
  fireEvent.load(image);
  return image;
}

describe("shared book cover", () => {
  it.each([[72, 108], [1200, 1800], [1600, 900], [600, 600], [200, 1200]])(
    "fills the same frame for a %s × %s source without changing its geometry",
    (width, height) => {
      const { container } = render(<TestProviders><BookCover src="/cover.jpg" alt="测试封面" /></TestProviders>);
      const image = loadCover(width, height);
      expect(container.querySelector("[data-book-cover]")).toHaveStyle({ aspectRatio: "3 / 4", position: "relative", overflow: "hidden" });
      expect(image).toHaveStyle({ objectFit: "cover", objectPosition: "center", width: "100%", height: "100%", position: "absolute" });
    },
  );

  it("retains its frame on failure and recovers when the cover URL changes", () => {
    const { container, rerender } = render(<BookCover src="/broken.jpg" alt="测试封面" title="一本书" />);
    fireEvent.error(screen.getByRole("img", { name: "测试封面" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("一本书")).toBeInTheDocument();
    expect(container.querySelector("[data-book-cover]")).toHaveStyle({ aspectRatio: "3 / 4" });
    rerender(<BookCover src="/replacement.jpg" alt="测试封面" title="一本书" />);
    expect(screen.getByRole("img", { name: "测试封面" })).toHaveAttribute("src", "/replacement.jpg");
  });
});
