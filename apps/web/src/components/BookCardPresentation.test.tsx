import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { BookCardPresentation } from "./BookCardPresentation";

describe("BookCardPresentation isolated collections", () => {
  it("opens a coverless private book through its own reader callback", async () => {
    const read = vi.fn();
    render(<TestProviders><BookCardPresentation
      book={{ id: "private-book", title: "加密书籍", author: "EPUB" }}
      onOpen={read} onRead={read}
    /></TestProviders>);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加密书籍" }));
    expect(read).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "加密书籍更多操作" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "开始阅读" }));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps the default book route and fills the shared portrait frame", () => {
    render(<TestProviders><BookCardPresentation
      book={{ id: "book-1", title: "一本书", author: "作者", coverUrl: "/covers/book.jpg" }}
    /></TestProviders>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/reader/book-1");
    expect(screen.getByRole("link")).toHaveStyle({ aspectRatio: "3 / 4" });
    expect(screen.getByRole("img", { name: "一本书封面" })).toHaveStyle({ objectFit: "cover", width: "100%", height: "100%" });
  });

  it("links an article card to its detail page and shows its summary", () => {
    render(<TestProviders><BookCardPresentation
      variant="article"
      book={{ id: "article-1", title: "一篇文章", author: "作者", coverUrl: "/covers/article.jpg" }}
      description="文章正文摘要"
    /></TestProviders>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/articles/article-1");
    expect(screen.getByRole("link")).toHaveStyle({ aspectRatio: "2.35 / 1" });
    expect(screen.getByRole("img", { name: "一篇文章封面" })).toHaveStyle({ objectFit: "cover" });
    expect(screen.getByText("文章正文摘要")).toBeInTheDocument();
  });

  it("uses the safe article-cover placeholder when an image fails", () => {
    render(<TestProviders><BookCardPresentation
      variant="article"
      book={{ id: "broken-cover", title: "缺图文章", author: "作者", coverUrl: "/missing.jpg" }}
    /></TestProviders>);
    fireEvent.error(screen.getByRole("img", { name: "缺图文章封面" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("暂无封面")).toBeInTheDocument();
  });

  it("calls article actions from the shared menu", async () => {
    const edit = vi.fn();
    render(<TestProviders><BookCardPresentation
      variant="article"
      book={{ id: "article-2", title: "可编辑文章", author: "作者" }}
      actions={[{ label: "编辑文章", onClick: edit }]}
    /></TestProviders>);
    fireEvent.click(screen.getByRole("button", { name: "可编辑文章更多操作" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "编辑文章" }));
    expect(edit).toHaveBeenCalledOnce();
  });
});
