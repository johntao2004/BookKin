// 覆盖按书分组、空态和 Word 导出入口，保留选中书籍的批注范围。
// Covers per-book grouping, empty states and Word export while retaining selected-book scope.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import type { Annotation } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { articles } from "../features/content/api";
import { articleNotesApi, type ArticleNoteGroup } from "../features/notes/api";
import { AnnotationsPage } from "./AnnotationsPage";
import { ReadingNotesPage } from "./ReadingNotesPage";
import { readingPosts } from "../features/notes/posts-api";

const bookId = demoBooks[0].id;
const entries: Annotation[] = [{
  id: "note-1",
  bookId,
  bookTitle: demoBooks[0].title,
  bookAuthor: demoBooks[0].author,
  type: "NOTE",
  locator: "epubcfi(/6/2!/4/2)",
  quote: "把一天的光慢慢折进书页",
  note: "这是我想保留的一句话。",
  style: "HIGHLIGHT",
  color: "YELLOW",
  createdAt: "2026-08-21T03:00:00Z",
  updatedAt: "2026-08-21T03:00:00Z",
}];

describe("AnnotationsPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false }));
    vi.spyOn(api, "listAnnotationBooks").mockResolvedValue({ items: [{
      bookId,
      bookTitle: demoBooks[0].title,
      bookAuthor: demoBooks[0].author,
      coverUrl: demoBooks[0].coverUrl,
      annotationCount: 1,
      noteCount: 1,
      highlightCount: 1,
      underlineCount: 0,
      boldCount: 0,
      latestAt: "2026-08-21T03:00:00Z",
    }] });
    vi.spyOn(api, "getBook").mockResolvedValue(demoBooks[0]);
    vi.spyOn(api, "listAnnotations").mockResolvedValue(entries);
    vi.spyOn(articleNotesApi, "list").mockResolvedValue([]);
    vi.spyOn(articles, "list").mockResolvedValue([]);
    vi.spyOn(readingPosts, "list").mockResolvedValue({ items: [], nextCursor: null });
  });

  afterEach(() => vi.restoreAllMocks());

  it("groups annotations by book and opens the selected book's notes", async () => {
    render(<TestProviders initialPath="/annotations/books?view=annotations"><SearchProbe /><NotesRoutes /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "札记轩" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("route-search")).toHaveTextContent("?view=annotations"));
    expect(screen.queryByText("PRIVATE NOTES")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: `查看《${demoBooks[0].title}》的阅读札记` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `查看《${demoBooks[0].title}》的阅读札记` }));

    expect(await screen.findByRole("heading", { name: demoBooks[0].title })).toBeInTheDocument();
    expect(screen.queryByText("BOOK NOTES")).not.toBeInTheDocument();
    expect(await screen.findByText("把一天的光慢慢折进书页")).toBeInTheDocument();
    expect(screen.getByText("这是我想保留的一句话。")).toBeInTheDocument();
    expect(api.listAnnotations).toHaveBeenCalledWith(bookId);
  });

  it.each(["/annotations/books?view=annotations", "/annotations?q=not-found"]) ("没有阅读札记书籍时显示统一空态（%s）", async (initialPath) => {
    vi.mocked(api.listAnnotationBooks).mockResolvedValueOnce({ items: [] });
    render(<TestProviders initialPath={initialPath}><NotesRoutes /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "暂无阅读札记" })).toBeInTheDocument();
    expect(screen.queryByText("无书目")).not.toBeInTheDocument();
    expect(screen.queryByText("在阅读器中选择文字，即可划线并写下想法。")).not.toBeInTheDocument();
    expect(screen.queryByText("换一个书名或作者关键词试试。")).not.toBeInTheDocument();
  });

  it("单本书没有笔记时保留书籍操作并显示统一空态", async () => {
    vi.mocked(api.listAnnotations).mockResolvedValueOnce([]);
    render(<TestProviders initialPath={`/annotations?bookId=${bookId}&q=preserve`}><SearchProbe /><NotesRoutes /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "暂无阅读札记", level: 4 })).toBeInTheDocument();
    expect(screen.queryByText("无书目")).not.toBeInTheDocument();
    expect(screen.queryByText("这本书还没有阅读札记或划线。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回原文" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出 Word" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回笔记" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回笔记" }));
    expect(await screen.findByRole("button", { name: `查看《${demoBooks[0].title}》的阅读札记` })).toBeInTheDocument();
    expect(screen.getByTestId("route-search")).toHaveTextContent("?q=preserve&view=annotations");
  });

  it("同时存在书籍和文章参数时只显示实际选中书籍的返回", async () => {
    render(<TestProviders initialPath={`/annotations/all?bookId=${bookId}&articleId=article-1`}><NotesRoutes /></TestProviders>);

    expect(await screen.findByRole("heading", { name: demoBooks[0].title })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "返回笔记" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "返回阅文札记" })).not.toBeInTheDocument();
    expect(articleNotesApi.list).not.toHaveBeenCalled();
  });

  it("exports the selected book's notes as Word", async () => {
    vi.spyOn(api, "downloadAnnotationExport").mockResolvedValue("《山川与灯火》阅读札记.docx");
    render(<TestProviders initialPath={`/annotations?bookId=${bookId}`}><NotesRoutes /></TestProviders>);

    fireEvent.click(await screen.findByRole("button", { name: "导出 Word" }));

    await waitFor(() => expect(api.downloadAnnotationExport).toHaveBeenCalledWith(bookId, "DOCX"));
    expect(await screen.findByText("已导出 《山川与灯火》阅读札记.docx")).toBeInTheDocument();
  });

  it("switches by URL, requests only the active source, and opens article notes at their exact locator", async () => {
    const article: ArticleNoteGroup = {
      articleId: "article-1",
      title: "潮汐之间",
      author: "林予",
      coverUrl: "/covers/article-wide.jpg",
      annotations: [
        { id: "article-note", type: "NOTE", quote: "潮水留下细线。", note: "记住这一段。", locator: "p-8&offset=2", style: "UNDERLINE", color: "BLUE", createdAt: "2026-08-21T03:00:00Z" },
        { id: "article-bookmark", type: "BOOKMARK", quote: "书签不应显示", note: "", locator: "p-9", createdAt: "2026-08-22T03:00:00Z" },
      ],
    };
    vi.mocked(articleNotesApi.list).mockResolvedValue([article]);
    let queryKeys: unknown[][] = [];
    const captureKeys = (keys: unknown[][]) => { queryKeys = keys; };
    render(<TestProviders initialPath="/annotations/articles?view=annotations&filter=recent"><SearchProbe /><QueryKeyProbe onKeys={captureKeys} /><NotesRoutes /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "札记轩" })).toBeInTheDocument();
    expect(api.listAnnotationBooks).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "查看《潮汐之间》的阅文札记" }));

    expect(screen.getByTestId("route-search")).toHaveTextContent("?view=annotations&filter=recent&articleId=article-1");
    expect(await screen.findByText("记住这一段。")).toBeInTheDocument();
    expect(screen.queryByText("书签不应显示")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回原文" })).toHaveAttribute("href", "/articles/article-1?locator=p-8%26offset%3D2");
    expect(api.getBook).not.toHaveBeenCalled();
    expect(api.listAnnotations).not.toHaveBeenCalled();
    await waitFor(() => expect(queryKeys).toContainEqual(["article-notes", "user-owner"]));
    expect(screen.getAllByRole("button", { name: "返回阅文札记" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "返回阅文札记" }));
    expect(await screen.findByRole("button", { name: "查看《潮汐之间》的阅文札记" })).toBeInTheDocument();
    expect(screen.getByTestId("route-search")).toHaveTextContent("?view=annotations&filter=recent");

  });

  it("shows article-note loading, empty and failure states clearly", async () => {
    let resolveNotes!: (value: ArticleNoteGroup[]) => void;
    vi.mocked(articleNotesApi.list).mockReturnValueOnce(new Promise<ArticleNoteGroup[]>((resolve) => { resolveNotes = resolve; }));
    const view = render(<TestProviders initialPath="/annotations?type=articles"><NotesRoutes /></TestProviders>);
    expect(screen.getByRole("status", { name: "正在加载阅文札记" })).toBeInTheDocument();
    resolveNotes([]);
    expect(await screen.findByRole("heading", { name: "暂无阅读札记" })).toBeInTheDocument();
    view.unmount();

    vi.mocked(articleNotesApi.list).mockRejectedValueOnce(new Error("offline"));
    render(<TestProviders initialPath="/annotations?type=articles"><NotesRoutes /></TestProviders>);
    expect(await screen.findByText("无法加载阅读札记")).toBeInTheDocument();
  });
});

function NotesRoutes() {
  return <Routes><Route path="/annotations" element={<AnnotationsPage />} /><Route path="/annotations/books" element={<ReadingNotesPage kind="BOOK" />} /><Route path="/annotations/articles" element={<ReadingNotesPage kind="ARTICLE" />} /><Route path="/annotations/all" element={<ReadingNotesPage kind="ALL" />} /></Routes>;
}

function SearchProbe() {
  const location = useLocation();
  return <output data-testid="route-search">{location.search}</output>;
}

function QueryKeyProbe({ onKeys }: { onKeys: (keys: unknown[][]) => void }) {
  const client = useQueryClient();
  useEffect(() => {
    const publish = () => onKeys(client.getQueryCache().getAll().map((query) => [...query.queryKey]));
    publish();
    return client.getQueryCache().subscribe(publish);
  }, [client, onKeys]);
  return null;
}
