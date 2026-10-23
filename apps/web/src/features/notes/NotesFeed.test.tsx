import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { TestProviders } from "../../test/TestProviders";
import { ReadingNotesPage } from "../../pages/ReadingNotesPage";
import { articles } from "../content/api";
import { articleNotesApi, listCompleteBookNotes } from "./api";
import { readingPosts } from "./posts-api";

const source = { bookId: "b", bookTitle: "书籍来源", bookAuthor: "作者", coverUrl: "", annotationCount: 1, noteCount: 1, highlightCount: 0, underlineCount: 0, boldCount: 0, latestAt: "2026-10-22" };
beforeEach(() => {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false }));
  vi.spyOn(api, "listAnnotationBooks").mockResolvedValue({ items: [source] });
  vi.spyOn(api, "listAnnotations").mockResolvedValue([{ id: "n", bookId: "b", bookTitle: "书籍来源", type: "NOTE", quote: "书籍摘录", note: "书籍想法", style: "HIGHLIGHT", createdAt: "2026-10-22" }]);
  vi.spyOn(articleNotesApi, "list").mockResolvedValue([{ articleId: "a", title: "文章来源", author: "文章作者", annotations: [{ id: "n", type: "NOTE", quote: "文章摘录", note: "文章想法", locator: "p-4", createdAt: "2026-10-21" }] }]);
  vi.spyOn(articles, "list").mockResolvedValue([{ id: "a", title: "文章来源", author: "文章作者", tags: "架构,编程", source_url: "", published_at: "", visibility: "PUBLIC", created_at: "2026-10-21", updated_at: "2026-10-21" }]);
  vi.spyOn(readingPosts, "list").mockResolvedValue({ items: [], nextCursor: null });
});
afterEach(() => vi.restoreAllMocks());

describe("reading-note navigation and data views", () => {
  it("opens book notes directly and fetches book posts only when their tab is selected", async () => {
    render(<TestProviders><ReadingNotesPage kind="BOOK" /></TestProviders>);
    expect(screen.getByRole("tab", { name: "札记", selected: true })).toBeInTheDocument();
    expect(await screen.findByText("书籍想法")).toBeInTheDocument();
    expect(readingPosts.list).not.toHaveBeenCalled();
    expect(articleNotesApi.list).not.toHaveBeenCalled();
    expect(articles.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "随笔" }));
    expect(await screen.findByRole("heading", { name: "暂无随笔" })).toBeInTheDocument();
    expect(readingPosts.list).toHaveBeenCalledWith("BOOK", undefined);
    expect(screen.queryByText("书籍想法")).not.toBeInTheDocument();
  });
  it("combines the current user's stores, filters article tags and exposes a structured table", async () => {
    render(<TestProviders><ReadingNotesPage kind="ALL" /></TestProviders>);
    expect(await screen.findByText("书籍想法")).toBeInTheDocument();
    expect(screen.getByText("文章想法")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "文章标签" }));
    fireEvent.click((await screen.findAllByText("架构", { exact: true })).at(-1)!);
    await waitFor(() => expect(screen.queryByText("书籍想法")).not.toBeInTheDocument());
    expect(screen.getByText("文章想法")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "展示方式" }));
    fireEvent.click((await screen.findAllByText("表格", { exact: true })).at(-1)!);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "原文" })).toHaveAttribute("href", "/articles/a?locator=p-4");
    expect(screen.queryByRole("button", { name: "导出笔记" })).not.toBeInTheDocument();
  });
  it("reads beyond the old global 500-note cap through paged sources without duplicating another store", async () => {
    vi.mocked(api.listAnnotationBooks).mockResolvedValueOnce({ items: [source], nextCursor: "next" }).mockResolvedValueOnce({ items: [{ ...source, bookId: "older" }] });
    vi.mocked(api.listAnnotations).mockImplementation(async id => Array.from({ length: 300 }, (_, index) => ({ id: `${id}:${index}`, bookId: id!, type: "NOTE", note: "完整笔记", style: "HIGHLIGHT", createdAt: "2026-10-22" })));
    const notes = await listCompleteBookNotes();
    expect(notes).toHaveLength(600);
    expect(api.listAnnotationBooks).toHaveBeenNthCalledWith(2, { cursor: "next", limit: 36 });
    expect(api.listAnnotations).toHaveBeenCalledWith("older");
    expect(articleNotesApi.list).not.toHaveBeenCalled();
  });
});
