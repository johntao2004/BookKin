import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { BookCard } from "./BookCard";

describe("BookCard", () => {
  it("以书名和作者为主，并在更多操作左侧显示阅读百分比", () => {
    const book = demoBooks[0];

    render(
      <TestProviders>
        <BookCard book={book} onOpen={vi.fn()} onRead={vi.fn()} />
      </TestProviders>,
    );

    expect(screen.getByText(book.title)).toBeInTheDocument();
    expect(screen.getByText(book.author)).toBeInTheDocument();
    expect(screen.getByText(`已读 ${book.progress}%`)).toBeInTheDocument();
    expect(screen.queryByText(book.format)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("未开始阅读时不显示百分比", () => {
    const book = demoBooks[2];

    render(
      <TestProviders>
        <BookCard book={book} onOpen={vi.fn()} onRead={vi.fn()} />
      </TestProviders>,
    );

    expect(screen.queryByText(/^已读/)).not.toBeInTheDocument();
  });

  it("把封面和书名编辑合并为一个元信息入口，同时保留独立的文件移动", () => {
    const book = demoBooks[0];
    const editMetadata = vi.fn();
    const fileOperation = vi.fn();

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
    expect(screen.getByRole("menuitem", { name: "移动" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "编辑元信息" }));
    expect(editMetadata).toHaveBeenCalledWith(book);

    fireEvent.click(screen.getByRole("button", { name: `${book.title}更多操作` }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移动" }));
    expect(fileOperation).toHaveBeenCalledWith(book, "MOVE");
  });

  it("从藏书卡片直接加入书单", () => {
    const book = demoBooks[0];
    const addToBooklist = vi.fn();

    render(
      <TestProviders>
        <BookCard book={book} onOpen={vi.fn()} onRead={vi.fn()} onAddToBooklist={addToBooklist} />
      </TestProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: `${book.title}更多操作` }));
    fireEvent.click(screen.getByRole("menuitem", { name: "加入书单" }));
    expect(addToBooklist).toHaveBeenCalledWith(book);
  });
});
