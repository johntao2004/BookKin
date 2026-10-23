import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { demoBooks } from "../../data/demo";
import { TestProviders } from "../../test/TestProviders";
import { articleNotesApi } from "./api";
import { articles } from "../content/api";
import { ReadingNotesPage } from "../../pages/ReadingNotesPage";
import { PostEditor, ReadingPostPage } from "./ReadingPosts";
import { readingPosts, type PostFilter, type ReadingPost } from "./posts-api";

const saved: ReadingPost = { id: "post-1", kind: "BOOK", sourceId: demoBooks[0].id, sourceTitle: demoBooks[0].title, userId: "user-owner", authorName: "林", title: "书页之后", markdown: "## 思考\n\n- 延伸阅读\n\n| 要点 | 记录 |\n| --- | --- |\n| 一 | 二 |", excerpt: "阅读后的思考", visibility: "PRIVATE", revision: 2, createdAt: "2026-10-22T03:00:00Z", updatedAt: "2026-10-22T03:00:00Z" };

beforeEach(() => {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false }));
  vi.spyOn(readingPosts, "list").mockResolvedValue({ items: [saved], nextCursor: null });
  vi.spyOn(readingPosts, "get").mockResolvedValue(saved);
  vi.spyOn(readingPosts, "create").mockResolvedValue(saved);
  vi.spyOn(readingPosts, "update").mockResolvedValue({ ...saved, revision: 3 });
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [demoBooks[0]] });
  vi.spyOn(articles, "list").mockResolvedValue([]);
  vi.spyOn(articleNotesApi, "list").mockResolvedValue([]);
  vi.spyOn(api, "listAnnotations").mockResolvedValue([]);
  vi.spyOn(api, "listAnnotationBooks").mockResolvedValue({ items: [] });
  vi.spyOn(api, "getBook").mockResolvedValue(demoBooks[0]);
});
afterEach(() => vi.restoreAllMocks());

describe("reading posts", () => {
  it.each<PostFilter>(["BOOK", "ARTICLE", "ALL"])("loads only the requested %s collection and retains independent detail URLs", async kind => {
    render(<TestProviders initialPath={`/annotations/${kind.toLowerCase()}?view=posts`}><ReadingNotesPage kind={kind} /></TestProviders>);
    expect(screen.getByRole("heading", { name: "读书录", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("书页之后")).toBeInTheDocument();
    expect(screen.getAllByRole("link").some(link => link.getAttribute("href") === "/annotations/posts/book/post-1")).toBe(true);
    expect(readingPosts.list).toHaveBeenCalledWith(kind, undefined);
    expect(screen.queryByRole("button", { name: "阅读批注" })).not.toBeInTheDocument();
    if (kind === "ALL") expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    else expect(screen.getByRole("tab", { name: "随笔", selected: true })).toBeInTheDocument();

  });

  it("does not show a source-note return action on the posts tab when a stale selection parameter remains", async () => {
    render(<TestProviders initialPath={`/annotations/books?view=posts&bookId=${saved.sourceId}`}><ReadingNotesPage kind="BOOK" /></TestProviders>);

    expect(await screen.findByText(saved.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回笔记" })).not.toBeInTheDocument();
  });

  it("creates a private book post with Markdown preview, without writing to annotations", async () => {
    const onSaved = vi.fn();
    render(<TestProviders><PostEditor initialKind="BOOK" onClose={vi.fn()} onSaved={onSaved} /></TestProviders>);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "关联书籍" })).toBeEnabled());
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "关联书籍" }));
    fireEvent.click(await screen.findByText(demoBooks[0].title));
    fireEvent.change(screen.getByRole("textbox", { name: "标题" }), { target: { value: "我的随笔" } });
    fireEvent.change(screen.getByRole("textbox", { name: "随笔正文" }), { target: { value: saved.markdown } });
    fireEvent.click(screen.getByRole("button", { name: "预览" }));
    const preview = screen.getByRole("region", { name: "随笔预览" });
    expect(preview).toHaveClass("bk-markdown-prose");
    expect(preview.querySelector("table")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "保存随笔" }));
    await waitFor(() => expect(readingPosts.create).toHaveBeenCalledWith(expect.objectContaining({ kind: "BOOK", sourceId: demoBooks[0].id, title: "我的随笔", markdown: saved.markdown, visibility: "PRIVATE" })));
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("keeps the source and unsaved Markdown while switching fullscreen and preview", async () => {
    render(<TestProviders><PostEditor initialKind="ARTICLE" initialSourceId="article-1" sourceTitle="来源文章" onClose={vi.fn()} onSaved={vi.fn()} /></TestProviders>);
    expect(screen.getByText("来源：文章 · 来源文章")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "关联书籍" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "标题" }), { target: { value: "文章读后感" } });
    fireEvent.change(screen.getByRole("textbox", { name: "随笔正文" }), { target: { value: "## 沉浸编写\n\n正文内容" } });
    fireEvent.click(screen.getByRole("button", { name: "全屏" }));
    expect(screen.getByRole("button", { name: "退出全屏", pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "预览" }));
    expect(screen.getByRole("heading", { name: "沉浸编写" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "退出全屏" }));
    expect(screen.getByRole("textbox", { name: "随笔正文" })).toHaveValue("## 沉浸编写\n\n正文内容");
    fireEvent.click(screen.getByRole("button", { name: "保存随笔" }));
    await waitFor(() => expect(readingPosts.create).toHaveBeenCalledWith(expect.objectContaining({ kind: "ARTICLE", sourceId: "article-1", title: "文章读后感" })));
  });

  it("keeps an edited draft intact after a revision conflict", async () => {
    vi.mocked(readingPosts.update).mockRejectedValue(new Error("随笔已在其他页面更新"));
    render(<TestProviders><PostEditor saved={saved} initialKind="BOOK" onClose={vi.fn()} onSaved={vi.fn()} /></TestProviders>);
    fireEvent.change(screen.getByRole("textbox", { name: "随笔正文" }), { target: { value: "尚未保存的新想法" } });
    fireEvent.click(screen.getByRole("button", { name: "保存随笔" }));
    expect(await screen.findByText("随笔已在其他页面更新")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "随笔正文" })).toHaveValue("尚未保存的新想法");
    expect(readingPosts.update).toHaveBeenCalledWith(saved, expect.objectContaining({ markdown: "尚未保存的新想法" }));
    expect(api.listBooks).not.toHaveBeenCalled();
  });

  it("renders a standalone Markdown detail and hides edit for another author's shared post", async () => {
    vi.mocked(readingPosts.get).mockResolvedValue({ ...saved, userId: "another-reader", visibility: "LIBRARY" });
    render(<TestProviders initialPath="/annotations/posts/book/post-1"><Routes><Route path="/annotations/posts/:kind/:postId" element={<ReadingPostPage />} /></Routes></TestProviders>);
    expect(await screen.findByRole("heading", { name: saved.title, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "随笔正文" }).querySelector("table")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /^编辑$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: saved.sourceTitle })).toHaveAttribute("href", `/library/books/${saved.sourceId}`);
    expect(screen.getAllByRole("link", { name: "返回笔记" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "返回笔记" })).toHaveAttribute("href", "/annotations/books?view=posts");
  });

  it("keeps the page-level return during loading and sends failures to the notes overview", async () => {
    let resolvePost!: (post: ReadingPost) => void;
    vi.mocked(readingPosts.get).mockReturnValueOnce(new Promise<ReadingPost>(resolve => { resolvePost = resolve; }));
    const loadingView = render(<TestProviders initialPath="/annotations/posts/book/post-1"><Routes><Route path="/annotations/posts/:kind/:postId" element={<ReadingPostPage />} /></Routes></TestProviders>);
    expect(screen.getByRole("link", { name: "返回笔记" })).toHaveAttribute("href", "/annotations/books?view=posts");
    resolvePost(saved);
    expect(await screen.findByRole("heading", { name: saved.title, level: 1 })).toBeInTheDocument();
    loadingView.unmount();

    vi.mocked(readingPosts.get).mockRejectedValueOnce(new Error("offline"));
    render(<TestProviders initialPath="/annotations/posts/book/post-1"><Routes><Route path="/annotations/posts/:kind/:postId" element={<ReadingPostPage />} /></Routes></TestProviders>);
    expect(await screen.findByRole("heading", { name: "无法读取随笔" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "返回笔记" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "返回笔记" })).toHaveAttribute("href", "/annotations");
  });
});
