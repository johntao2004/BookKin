// 保护统一元信息入口、回收站及加入书目动作，避免卡片菜单出现重复编辑路径。
// Protects unified metadata editing alongside separate file-move and booklist actions without duplicate edit paths.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { BookCard } from "./BookCard";

describe("BookCard", () => {
  it.each([0, 68])("阅读进度为 %i 时仅显示书名、作者与更多操作，不显示百分比", (progress) => {
    const book = { ...demoBooks[0], progress };

    render(
      <TestProviders>
        <BookCard book={book} onOpen={vi.fn()} onRead={vi.fn()} />
      </TestProviders>,
    );

    expect(screen.getByText(book.title)).toBeInTheDocument();
    expect(screen.getByText(book.author)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${book.title}更多操作` })).toBeInTheDocument();
    expect(screen.queryByText(/^已读/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+(?:\.\d+)?\s*%/)).not.toBeInTheDocument();
    expect(screen.queryByText(book.format)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("保留元信息及回收站入口，移除移动操作", () => {
    const book = demoBooks[0];
    const editMetadata = vi.fn();
    const fileOperation = vi.fn();
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "owner", username: "owner", displayName: "主人", role: "OWNER", mustChangePassword: false }));

    render(
      <TestProviders>
        <BookCard
          book={book}
          onOpen={vi.fn()}
          onRead={vi.fn()}
          onEditMetadata={editMetadata}
          onFileOperation={fileOperation}
        />
      </TestProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: `${book.title}更多操作` }));
    expect(screen.queryByRole("menuitem", { name: "更换封面" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "重命名" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "移动" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "编辑元信息" }));
    expect(editMetadata).toHaveBeenCalledWith(book);

    fireEvent.click(screen.getByRole("button", { name: `${book.title}更多操作` }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移入回收站" }));
    expect(fileOperation).toHaveBeenCalledWith(book, "TRASH");
  });

  it("从藏书卡片直接加入书目", () => {
    const book = demoBooks[0];
    const addToBooklist = vi.fn();

    render(
      <TestProviders>
        <BookCard book={book} onOpen={vi.fn()} onRead={vi.fn()} onAddToBooklist={addToBooklist} />
      </TestProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: `${book.title}更多操作` }));
    fireEvent.click(screen.getByRole("menuitem", { name: "加入书目" }));
    expect(addToBooklist).toHaveBeenCalledWith(book);
  });
});
