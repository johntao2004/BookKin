// 验证跨页去重不打乱原顺序，并只为后来加载的条目添加渐入标记。
// Checks deduplication preserves source order and marks only later-loaded entries for staggered reveal.
import { render, screen } from "@testing-library/react";
import { flattenUniquePaginatedItems, PaginatedItemReveal, revealDelay } from "./PaginatedItemReveal";

describe("PaginatedItemReveal", () => {
  it("keeps the source page and item order while removing repeated books", () => {
    expect(flattenUniquePaginatedItems([
      { items: [{ id: "first" }, { id: "shared" }] },
      { items: [{ id: "shared" }, { id: "later" }] },
    ])).toEqual([
      { item: { id: "first" }, pageIndex: 0, itemIndex: 0 },
      { item: { id: "shared" }, pageIndex: 0, itemIndex: 1 },
      { item: { id: "later" }, pageIndex: 1, itemIndex: 1 },
    ]);
  });

  it("marks only lazy-loaded items for the staggered upward reveal", () => {
    render(
      <>
        <PaginatedItemReveal animate={false} order={0}><span>首批书籍</span></PaginatedItemReveal>
        <PaginatedItemReveal animate order={3}><span>懒加载书籍</span></PaginatedItemReveal>
      </>,
    );

    expect(screen.getByText("首批书籍").parentElement).toHaveAttribute("data-lazy-load-reveal", "false");
    expect(screen.getByText("懒加载书籍").parentElement).toHaveAttribute("data-lazy-load-reveal", "true");
    expect(screen.getByText("懒加载书籍").parentElement).toHaveAttribute("data-reveal-delay-ms", String(revealDelay(3)));
    expect(revealDelay(99)).toBe(revealDelay(8));
  });
});
