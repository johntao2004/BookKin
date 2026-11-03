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
const readerBindings = vi.hoisted(() => ({ onSelect: undefined as ((selection: ReaderSelection) => void) | undefined }));

vi.mock("../components/readers/EpubDocumentReader", () => ({
  default: (props: { annotations?: { id: string }[]; onAnnotationActivate?: (id: string) => void; onAnnotationDismiss?: () => void; contentUrl?: string; flow?: string; readOnly?: boolean; target?: string; onNavigation: (items: TocItem[]) => void; onSelect: (selection: ReaderSelection) => void; onPosition: (locator: string, progress: number) => void }) => { readerBindings.onSelect = props.onSelect; return <section aria-label="共享正文" data-annotation-count={props.annotations?.length} data-content-url={props.contentUrl} data-flow={props.flow} data-read-only={String(props.readOnly)} data-target={props.target} data-target-revision={(props as { targetRevision?: number }).targetRevision}>
    {props.annotations?.map(item => <button key={item.id} onClick={() => props.onAnnotationActivate?.(item.id)}>点击正文批注 {item.id}</button>)}
    <button onClick={() => props.onAnnotationDismiss?.()}>点击正文空白</button>
    <button onClick={() => props.onNavigation([
      { href: "article.xhtml#first", label: "第一点", depth: 0, locator: "epubcfi(/6/2!/4/2)" },
      { href: "article.xhtml#second", label: "第二点", depth: 0, locator: "epubcfi(/6/2!/4/8)" },
    ])}>加载目录</button>
    <button onClick={() => props.onPosition("epubcfi(/6/2!/4/10)", 0.9)}>翻到末页</button>
    <button onClick={() => props.onSelect({ quote: "文章中的一句话", locator: "epubcfi(/6/2!/4/2:0,/1:0,/1:8)", x: 140, y: 200, placement: "ABOVE" })}>选择文章文字</button>
    <button onClick={() => props.onPosition("epubcfi(/6/2!/4/2)", 0.5)}>翻到下一页</button>
  </section>; },
}));

function independentSource(): IndependentReaderSource {
  return {
    id: "article-shared", title: "文章阅读", author: "作者", format: "EPUB", contentUrl: "blob:article",
    annotationPermission: "articles.annotate",
    flow: "scrolled-doc", label: "文章", backLabel: "返回文钞馆", progress: 0.1, annotations: [], onBack: vi.fn(), onPosition: vi.fn(),
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

  it("keeps article reading and note composition free of AI while retaining normal note saves", async () => {
    const source = independentSource();
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "选择文章文字" }));
    fireEvent.click(screen.getByRole("button", { name: "高亮＋笔记" }));
    const note = "沿着同一条路线观察，能给下一次散步留下可以比较的线索。";
    fireEvent.change(screen.getByRole("textbox", { name: "写下这段文字带来的想法" }), { target: { value: note } });
    expect(screen.queryByRole("button", { name: "AI 整理笔记" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "AI 助读" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "AI 编辑辅助" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("AI 生成结果")).not.toBeInTheDocument();
    expect(source.createAnnotation).not.toHaveBeenCalled();
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

  it("toggles plain highlight tools and targets notes without saving", async () => {
    const source = independentSource();
    source.annotations = [
      { id: "plain", bookId: source.id, type: "HIGHLIGHT", style: "HIGHLIGHT", quote: "纯高亮", locator: "article.xhtml#p-1", createdAt: "2026-10-28" },
      { id: "first", bookId: source.id, type: "NOTE", style: "HIGHLIGHT", quote: "第一处", note: "第一条笔记", locator: "article.xhtml#p-2", createdAt: "2026-10-28" },
      { id: "target", bookId: source.id, type: "NOTE", style: "HIGHLIGHT", quote: "第二处", note: "目标笔记", locator: "article.xhtml#p-3", createdAt: "2026-10-28" },
    ];
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "点击正文批注 plain" }));
    expect(screen.queryByRole("heading", { name: "阅文札记" })).not.toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "批注工具" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "点击正文批注 plain" }));
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "批注工具" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "点击正文批注 plain" }));
    fireEvent.click(screen.getByRole("button", { name: "点击正文空白" }));
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "批注工具" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "点击正文批注 target" }));
    expect(await screen.findByRole("heading", { name: "阅文札记" })).toBeInTheDocument();
    const current = screen.getByRole("group", { name: "当前笔记" });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveTextContent("目标笔记");
    expect(current).not.toHaveTextContent("第一条笔记");
    expect(source.createAnnotation).not.toHaveBeenCalled();
    expect(source.deleteAnnotation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "点击正文批注 target" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "阅文札记" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "点击正文批注 first" }));
    await waitFor(() => expect(screen.getByRole("group", { name: "当前笔记" })).toHaveTextContent("第一条笔记"));
  });

  it("combines a highlight and all notes at the same article range into one entry and removes its members", async () => {
    const source = independentSource();
    const common = { bookId: source.id, style: "HIGHLIGHT" as const, color: "YELLOW" as const, quote: "只展示一次的原文", locator: "epubcfi(/6/2!/4/2:0,/1:0,/1:8)", createdAt: "2026-10-20T00:00:00Z" };
    source.annotations = [
      { ...common, id: "highlight", type: "HIGHLIGHT" },
      { ...common, id: "first-note", type: "NOTE", note: "第一条想法", locator: "epubcfi(/6/2!/4/2:0,/1:0,/1:9)" },
      { ...common, id: "second-note", type: "NOTE", note: "第二条想法" },
    ];
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    expect(await screen.findByRole("region", { name: "共享正文" })).toHaveAttribute("data-annotation-count", "1");
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "阅文札记" }));
    expect(screen.queryByText(/仅你可见/)).not.toBeInTheDocument();
    expect(screen.getAllByText("“只展示一次的原文”")).toHaveLength(1);
    expect(screen.getByText("高亮笔记")).toBeInTheDocument();
    expect(screen.getByText(/第一条想法\s+第二条想法/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "返回原文" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "删除批注" }));
    await waitFor(() => expect(source.deleteAnnotation).toHaveBeenCalledTimes(3));
    expect(vi.mocked(source.deleteAnnotation).mock.calls.map(([id]) => id)).toEqual(["highlight", "first-note", "second-note"]);
  });

  it("prefills the existing note for a normalized article selection and saves an edit", async () => {
    const source = independentSource();
    source.resolveAnnotationLocator = vi.fn(() => "article.xhtml#p-1");
    source.annotations = [{ id: "existing", bookId: source.id, type: "NOTE", style: "HIGHLIGHT", color: "GREEN", quote: "文章中的一句话", locator: "article.xhtml#p-1", note: "已有笔记", createdAt: "2026-10-20T00:00:00Z" }];
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "选择文章文字" }));
    fireEvent.click(screen.getByRole("button", { name: "高亮＋笔记" }));
    expect(await screen.findByRole("dialog", { name: "编辑笔记" })).toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: "写下这段文字带来的想法" });
    expect(field).toHaveValue("已有笔记");
    expect(screen.getByRole("button", { name: "选择绿色荧光笔" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(field, { target: { value: "更新后的笔记" } });
    fireEvent.click(screen.getByRole("button", { name: "保存笔记" }));
    await waitFor(() => expect(source.createAnnotation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: "NOTE", locator: "article.xhtml#p-1", note: "更新后的笔记", color: "GREEN" })));
  });

  it("keeps reader selection callbacks stable while using the latest saved note", async () => {
    const source = independentSource();
    const view = render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    await screen.findByRole("region", { name: "共享正文" });
    const initialSelect = readerBindings.onSelect;
    const updated = { ...source, progress: 0.5, annotations: [{ id: "updated", bookId: source.id, type: "NOTE" as const, style: "HIGHLIGHT" as const, quote: "文章中的一句话", locator: "epubcfi(/6/2!/4/2:0,/1:0,/1:8)", note: "最新笔记", createdAt: "2026-10-20T00:00:00Z" }] };
    view.rerender(<TestProviders><ReaderWorkspace source={updated} /></TestProviders>);
    expect(readerBindings.onSelect).toBe(initialSelect);
    fireEvent.click(screen.getByRole("button", { name: "选择文章文字" }));
    fireEvent.click(screen.getByRole("button", { name: "高亮＋笔记" }));
    expect(screen.getByRole("textbox", { name: "写下这段文字带来的想法" })).toHaveValue("最新笔记");
  });

  it("shows only current-content notes and edits them directly from the drawer", async () => {
    const source = independentSource();
    source.annotations = [
      { id: "mine", bookId: source.id, type: "NOTE", style: "HIGHLIGHT", quote: "当前文章原文", locator: "article.xhtml#p-1", note: "当前笔记", createdAt: "2026-10-20T00:00:00Z" },
      { id: "other", bookId: "other-article", type: "NOTE", style: "HIGHLIGHT", quote: "其它文章原文", locator: "article.xhtml#p-1", note: "其它笔记", createdAt: "2026-10-20T00:00:00Z" },
    ];
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    await screen.findByRole("region", { name: "共享正文" });
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "阅文札记" }));
    expect(await screen.findByText("当前笔记")).toBeInTheDocument();
    expect(screen.queryByText("其它笔记")).not.toBeInTheDocument();
    for (const label of ["保存记录", "写随笔", "加入选集"]) expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "查看原始来源" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑笔记" }));
    expect(await screen.findByRole("dialog", { name: "编辑笔记" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "写下这段文字带来的想法" })).toHaveValue("当前笔记");
    fireEvent.click(screen.getByRole("button", { name: /^取消$/ }));
    expect(source.createAnnotation).not.toHaveBeenCalled();
  });


  it("hides navigation without a source TOC and keeps saved bookmarks independently reachable", async () => {
    const source = independentSource();
    const view = render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    await screen.findByRole("region", { name: "共享正文" });
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    expect(screen.queryByRole("menuitem", { name: "目录" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "书签" })).not.toBeInTheDocument();
    view.unmount();
    source.annotations = [{ id: "bookmark-no-toc", bookId: source.id, type: "BOOKMARK", style: "HIGHLIGHT", quote: "", note: "", locator: "epubcfi(/6/2!/4/2)", createdAt: "2026-10-23T00:00:00Z" }];
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    await screen.findByRole("region", { name: "共享正文" });
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "书签" }));
    expect(await screen.findByRole("navigation", { name: "书签" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "目录" })).not.toBeInTheDocument();
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

  it("keeps article information and private note actions out of the guest notes drawer", async () => {
    sessionStorage.removeItem("bookkin-demo-session");
    const source = independentSource();
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "选择文章文字" }));
    expect(screen.queryByRole("toolbar", { name: "批注工具" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    expect(screen.queryByRole("menuitem", { name: "添加书签" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "阅文札记" }));
    expect(screen.queryByRole("link", { name: "查看原始来源" })).not.toBeInTheDocument();
    expect(source.createAnnotation).not.toHaveBeenCalled();
  });

  it("gates independent article annotations with articles.annotate rather than reader.annotate", async () => {
    const source = independentSource();
    source.annotationPermission = "articles.annotate";
    const originalPermissions = await import("../auth/permissions");
    vi.spyOn(originalPermissions, "usePermissions").mockReturnValue({ can: (code: string) => code === "reader.annotate" } as unknown as ReturnType<typeof originalPermissions.usePermissions>);
    render(<TestProviders><ReaderWorkspace source={source} /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "选择文章文字" }));
    expect(screen.queryByRole("toolbar", { name: "批注工具" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));
    expect(screen.queryByRole("menuitem", { name: "添加书签" })).not.toBeInTheDocument();
    expect(source.createAnnotation).not.toHaveBeenCalled();
  });
});
