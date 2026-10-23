import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { ReaderPage, ReaderWorkspace } from "./ReaderPage";
import type { IndependentReaderSource } from "../components/readers/independent-reader-source";
import { Route, Routes } from "react-router-dom";
import type { Annotation } from "../domain/types";
import type { ReaderSelection, TocItem } from "../components/readers/types";
import { TestProviders } from "../test/TestProviders";

vi.mock("../auth/permissions", () => ({ usePermissions: () => ({ can: () => true }) }));

vi.mock("../components/readers/EpubDocumentReader", () => ({
  default: (props: { contentUrl?: string; flow?: string; readOnly?: boolean; target?: string; onNavigation: (items: TocItem[]) => void; onSelect: (selection: ReaderSelection) => void; onPosition: (locator: string, progress: number) => void }) => <section aria-label="共享正文" data-content-url={props.contentUrl} data-flow={props.flow} data-read-only={String(props.readOnly)} data-target={props.target} data-target-revision={(props as { targetRevision?: number }).targetRevision}>
    <button onClick={() => props.onNavigation([
      { href: "article.xhtml#first", label: "第一点", depth: 0, locator: "epubcfi(/6/2!/4/2)" },
      { href: "article.xhtml#second", label: "第二点", depth: 0, locator: "epubcfi(/6/2!/4/8)" },
    ])}>加载目录</button>
    <button onClick={() => props.onPosition("epubcfi(/6/2!/4/10)", 0.9)}>翻到末页</button>
    <button onClick={() => props.onSelect({ quote: "文章中的一句话", locator: "epubcfi(/6/2!/4/2:0,/1:0,/1:8)", x: 140, y: 200, placement: "ABOVE" })}>选择文章文字</button>
    <button onClick={() => props.onPosition("epubcfi(/6/2!/4/2)", 0.5)}>翻到下一页</button>
  </section>,
}));

function independentSource(): IndependentReaderSource {
  return {
    id: "article-shared", title: "文章阅读", author: "作者", format: "EPUB", contentUrl: "blob:article",
    flow: "scrolled-doc", label: "文章", backLabel: "返回撷文斋", progress: 0.1, annotations: [], onBack: vi.fn(), onPosition: vi.fn(),
    createAnnotation: vi.fn(async draft => ({ ...draft, id: "new-entry", bookId: "article-shared", createdAt: "2026-10-20T00:00:00Z" })),
    deleteAnnotation: vi.fn(async () => undefined),
  };
}

describe("ReaderWorkspace independent source", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "owner", username: "owner", displayName: "主人", role: "OWNER", mustChangePassword: false }));
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens short-note AI only with consent and retains the draft until normal note save", async () => {
    const source = independentSource();
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "选择文章文字" }));
    fireEvent.click(screen.getByRole("button", { name: "高亮＋笔记" }));
    const note = "沿着同一条路线观察，能给下一次散步留下可以比较的线索。";
    fireEvent.change(screen.getByRole("textbox", { name: "写下这段文字带来的想法" }), { target: { value: note } });
    fireEvent.click(screen.getByRole("button", { name: "AI 整理笔记" }));
    expect(screen.getByRole("checkbox", { name: "我同意本次将上述内容发送给已配置的 AI 平台" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "生成建议" })).toBeDisabled();
    expect(source.createAnnotation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "关闭助手" }));
    expect(screen.getByRole("textbox", { name: "写下这段文字带来的想法" })).toHaveValue(note);
    fireEvent.click(screen.getByRole("button", { name: "保存笔记" }));
    await waitFor(() => expect(source.createAnnotation).toHaveBeenCalledWith(expect.objectContaining({ note, quote: "文章中的一句话" })));
  });

  it("uses the existing reader chrome and renderer without requesting book data", async () => {
    const book = vi.spyOn(api, "getBook");
    const display = vi.spyOn(api, "getDisplayBook");
    const annotations = vi.spyOn(api, "listAnnotations");
    const time = vi.spyOn(api, "recordReadingTime");
    const source = independentSource();
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    const content = await screen.findByRole("region", { name: "共享正文" });
    expect(content).toHaveAttribute("data-content-url", "blob:article");
    expect(content).toHaveAttribute("data-read-only", "true");
    expect(content).toHaveAttribute("data-flow", "scrolled-doc");
    fireEvent.click(screen.getByRole("button", { name: "阅读设置" }));
    expect(screen.queryByRole("switch", { name: "启用翻页效果" })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("navigation", { name: "阅读器顶部导航" }).closest("section")).toHaveAttribute("data-reader-format", "ARTICLE");
    expect(screen.queryByText("独立阅读札记")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "翻到下一页" }));
    expect(source.onPosition).toHaveBeenCalledWith("epubcfi(/6/2!/4/2)", 0.5);
    expect(book).not.toHaveBeenCalled();
    expect(display).not.toHaveBeenCalled();
    expect(annotations).not.toHaveBeenCalled();
    expect(time).not.toHaveBeenCalled();
  });

  it("sends selection styles and bookmarks to the independent persistence adapter", async () => {
    const normalAnnotation = vi.spyOn(api, "createAnnotation");
    const source = independentSource();
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "选择文章文字" }));
    fireEvent.click(await screen.findByRole("button", { name: "下划线" }));
    await waitFor(() => expect(source.createAnnotation).toHaveBeenCalledWith(expect.objectContaining({ type: "HIGHLIGHT", style: "UNDERLINE", quote: "文章中的一句话" })));
    fireEvent.click(screen.getByRole("button", { name: "翻到下一页" }));
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "添加书签" }));
    await waitFor(() => expect(source.createAnnotation).toHaveBeenCalledWith(expect.objectContaining({ type: "BOOKMARK", locator: "epubcfi(/6/2!/4/2)" })));
    expect(normalAnnotation).not.toHaveBeenCalled();
  });

  it("shows existing article notes in the shared drawer with jump and delete actions", async () => {
    const source = independentSource();
    source.annotations = [{ id: "saved-note", bookId: source.id, type: "NOTE", style: "HIGHLIGHT", color: "YELLOW", note: "保留的私人笔记", quote: "原文", locator: "article.xhtml#p-0", createdAt: "2026-10-20T00:00:00Z" }];
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    await screen.findByRole("region", { name: "共享正文" });
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "阅文札记" }));
    expect(await screen.findByText("保留的私人笔记")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除批注" }));
    await waitFor(() => expect(source.deleteAnnotation).toHaveBeenCalledWith("saved-note"));
    fireEvent.click(screen.getByRole("button", { name: "返回原文" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "共享正文" })).toHaveAttribute("data-target", "article.xhtml#p-0"));
  });


  it("restores chapter bookmark markers and jumps to the exact saved position on every click", async () => {
    const source = independentSource();
    const locator = "epubcfi(/6/2!/4/4/1:25)";
    source.annotations = [{ id: "bookmark-one", bookId: source.id, type: "BOOKMARK", style: "HIGHLIGHT", quote: "", note: "", locator, createdAt: "2026-10-23T00:00:00Z" }];
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "加载目录" }));
    const openToc = () => {
      fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "目录" }));
    };
    openToc();
    fireEvent.click(await screen.findByRole("button", { name: "跳转书签：第一点（1）" }));
    expect(screen.getByRole("region", { name: "共享正文" })).toHaveAttribute("data-target", locator);
    expect(screen.getByRole("region", { name: "共享正文" })).toHaveAttribute("data-target-revision", "1");
    fireEvent.click(screen.getByRole("button", { name: "翻到末页" }));
    openToc();
    fireEvent.click(await screen.findByRole("button", { name: "跳转书签：第一点（1）" }));
    expect(screen.getByRole("region", { name: "共享正文" })).toHaveAttribute("data-target-revision", "2");
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    expect(screen.getByRole("menuitem", { name: "添加书签" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "添加书签" }));
    await waitFor(() => expect(source.createAnnotation).toHaveBeenCalledWith(expect.objectContaining({ type: "BOOKMARK", locator: "epubcfi(/6/2!/4/10)" })));
    expect(source.deleteAnnotation).not.toHaveBeenCalled();
  });

  it("removes only the bookmark at the current location and retains failure feedback", async () => {
    const source = independentSource();
    source.annotations = [{ id: "bookmark-here", bookId: source.id, type: "BOOKMARK", style: "HIGHLIGHT", quote: "", note: "", locator: "epubcfi(/6/2!/4/2)", createdAt: "2026-10-23T00:00:00Z" }];
    vi.mocked(source.deleteAnnotation).mockRejectedValueOnce(new Error("书签删除失败，请重试"));
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "翻到下一页" }));
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移除书签" }));
    await waitFor(() => expect(source.deleteAnnotation).toHaveBeenCalledWith("bookmark-here"));
    expect(await screen.findByText("书签删除失败，请重试")).toBeInTheDocument();
    expect(source.createAnnotation).not.toHaveBeenCalled();
  });

  it("saves multiple book bookmarks immediately and restores their directory markers after reopening", async () => {
    const book = await api.getBook("book-1");
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    let saved: Annotation[] = [];
    vi.spyOn(api, "listAnnotations").mockImplementation(async () => [...saved].reverse());
    const create = vi.spyOn(api, "createAnnotation").mockImplementation(async draft => {
      const annotation = { ...draft, id: `saved-${saved.length}`, createdAt: "2026-10-23T00:00:00Z" };
      saved = [...saved, annotation];
      return annotation;
    });
    vi.spyOn(api, "getSession").mockResolvedValue({ id: "owner", username: "owner", displayName: "主人", role: "OWNER", mustChangePassword: false });
    vi.spyOn(api, "replayReadingProgress").mockResolvedValue(undefined);
    vi.spyOn(api, "listReaderFonts").mockResolvedValue([]);
    vi.spyOn(api, "recordReadingTime").mockResolvedValue({ weekStart: "2026-10-19", weekEnd: "2026-10-25", totalSeconds: 0, previousWeekSeconds: 0, days: [] });
    const originalDemo = api.isDemo;
    api.isDemo = false;
    const openToc = () => {
      fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "目录" }));
    };
    const addBookmark = () => {
      fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "添加书签" }));
    };
    const reader = <TestProviders initialPath="/reader/book-1"><Routes><Route path="/reader/:bookId" element={<ReaderPage />} /></Routes></TestProviders>;
    try {
      const view = render(reader);
      fireEvent.click(await screen.findByRole("button", { name: "加载目录" }));
      fireEvent.click(screen.getByRole("button", { name: "翻到下一页" }));
      addBookmark();
      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
      openToc();
      expect(await screen.findByRole("button", { name: "跳转书签：第一点（1）" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "关闭目录" }));
      fireEvent.click(screen.getByRole("button", { name: "翻到末页" }));
      addBookmark();
      await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
      expect(saved).toHaveLength(2);
      view.unmount();
      render(reader);
      fireEvent.click(await screen.findByRole("button", { name: "加载目录" }));
      openToc();
      expect(await screen.findByRole("button", { name: "跳转书签：第一点（2）" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "跳转书签：第二点（1）" }));
      expect(screen.getByRole("region", { name: "共享正文" })).toHaveAttribute("data-target", "epubcfi(/6/2!/4/10)");
    } finally { api.isDemo = originalDemo; }
  });

  it("keeps public source information available without exposing private actions to guests", async () => {
    sessionStorage.removeItem("bookkin-demo-session");
    const source = independentSource();
    source.extraActions = <a href="https://example.com/article">查看原始来源</a>;
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "选择文章文字" }));
    expect(screen.queryByRole("toolbar", { name: "批注工具" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    expect(screen.queryByRole("menuitem", { name: "添加书签" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "文章信息" }));
    expect(await screen.findByRole("link", { name: "查看原始来源" })).toHaveAttribute("href", "https://example.com/article");
    expect(source.createAnnotation).not.toHaveBeenCalled();
  });
});
