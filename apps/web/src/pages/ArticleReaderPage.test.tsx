import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { IndependentReaderSource } from "../components/readers/independent-reader-source";
import { articles, type Article } from "../features/content/api";
import { buildArticleEpub } from "../features/content/article-document";
import { TestProviders } from "../test/TestProviders";
import { ArticleReaderPage } from "./ArticleReaderPage";

const readerMock = vi.hoisted(() => ({ source: null as unknown }));
vi.mock("./ReaderPage", () => ({
  ReaderWorkspace: ({ source }: { source: IndependentReaderSource }) => {
    readerMock.source = source;
    return null;
  },
}));
vi.mock("../features/content/article-document", () => ({
  buildArticleEpub: vi.fn(async () => new Blob(["epub"])),
  articleReaderTarget: vi.fn((locator?: string) =>
    locator && /^p-\d+$/.test(locator) ? `article.xhtml#${locator}` : undefined,
  ),
}));

const article: Article = {
  id: "article-one",
  title: "秋日书信",
  author: "林",
  source_url: "https://example.com/article",
  published_at: "2026-10-20",
  visibility: "PUBLIC",
  tags: "随笔",
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
  html: "<p id=\"p-1\">正文</p>",
};

function ArticleRoute({ path = "/articles/article-one" }: { path?: string }) {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate("/articles/article-two")}>切换文章</button>
      <Routes>
        <Route path="/articles/:articleId" element={<ArticleReaderPage />} />
        <Route path="/articles" element={<output data-testid="article-index">文钞馆</output>} />
      </Routes>
      <output data-testid="route-path">{path}</output>
    </>
  );
}

function renderReader(path?: string) {
  return render(
    <TestProviders initialPath={path ?? "/articles/article-one"}>
      <ArticleRoute path={path} />
    </TestProviders>,
  );
}

function currentSource() {
  return readerMock.source as IndependentReaderSource;
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

describe("ArticleReaderPage shared reader integration", () => {
  let reading: ReturnType<typeof vi.spyOn>;
  let saveReading: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    readerMock.source = null;
    sessionStorage.setItem(
      "bookkin-demo-session",
      JSON.stringify({
        id: "user-owner",
        username: "owner",
        displayName: "林",
        role: "OWNER",
        mustChangePassword: false,
      }),
    );
    vi.spyOn(articles, "get").mockImplementation(async (id) => ({
      ...article,
      id,
      title: id === "article-two" ? "第二篇文章" : article.title,
    }));
    reading = vi.spyOn(articles, "reading").mockResolvedValue({
      state: JSON.stringify({
        locator: "p-5",
        progress: 0.25,
        seconds: 42,
        annotations: [
          {
            id: "legacy-entry",
            type: "HIGHLIGHT",
            quote: "旧划线",
            note: "保留样式",
            locator: "p-3",
            style: "UNDERLINE",
            color: "CORAL",
            createdAt: "2026-10-19T00:00:00Z",
          },
          {
            id: "cfi-entry",
            type: "NOTE",
            quote: "CFI 笔记",
            note: "原定位保留",
            locator: "epubcfi(/6/4!/4/2)",
            style: "BOLD",
            color: "TEAL",
            createdAt: "2026-10-18T00:00:00Z",
          },
        ],
      }),
      revision: 7,
    });
    saveReading = vi.spyOn(articles, "saveReading").mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    sessionStorage.removeItem("bookkin-demo-session");
  });

  it("maps stored article locators and preserves annotation style and color", async () => {
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    const source = currentSource();
    expect(source.format).toBe("EPUB");
    expect(source.flow).toBe("scrolled-doc");
    expect(source.contentUrl).toMatch(/^blob:/);
    expect(source.progress).toBe(0.25);
    expect(source.initialLocator).toBe("article.xhtml#p-5");
    expect(source.annotations.map((entry) => [entry.locator, entry.style, entry.color])).toEqual([
      ["article.xhtml#p-3", "UNDERLINE", "CORAL"],
      ["epubcfi(/6/4!/4/2)", "BOLD", "TEAL"],
    ]);
    expect(reading).toHaveBeenCalledWith("article-one");
    expect(buildArticleEpub).toHaveBeenCalledWith(article);
  });

  it("uses a fixed URL locator and maps it to the generated EPUB target", async () => {
    renderReader("/articles/article-one?locator=p-8");
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    const source = currentSource();
    expect(source.initialLocator).toBe("article.xhtml#p-8");
    expect(currentSource().initialLocator).toBe("article.xhtml#p-8");
  });

  it("merges missing reading fields with defaults before saving article notes", async () => {
    reading.mockResolvedValueOnce({ state: JSON.stringify({ progress: 0.4 }), revision: 8 });
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    expect(currentSource().progress).toBe(0.4);
    expect(currentSource().annotations).toEqual([]);
    await act(async () => {
      await currentSource().createAnnotation({
        type: "NOTE",
        quote: "补充记录",
        note: "使用默认字段",
        locator: "epubcfi(/6/6!/4/2)",
        style: "HIGHLIGHT",
        color: "YELLOW",
      });
    });
    expect(saveReading).toHaveBeenCalledWith(
      "article-one",
      expect.objectContaining({ progress: 0.4, seconds: 0, locator: "", annotations: expect.any(Array) }),
      8,
    );
  });

  it("recovers from malformed reading-state JSON and exposes a warning", async () => {
    reading.mockResolvedValueOnce({ state: "{invalid", revision: 3 });
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    expect(currentSource().progress).toBe(0);
    expect(currentSource().annotations).toEqual([]);
    expect(currentSource().error).toContain("暂不能保存");
    act(() => currentSource().onPosition("article.xhtml#p-9", 0.9));
    await act(async () => currentSource().onBack());
    expect(saveReading).not.toHaveBeenCalled();
  });

  it("pauses writes when parsed reading-state fields have invalid types", async () => {
    reading.mockResolvedValueOnce({
      state: JSON.stringify({ locator: 12, progress: "0.7", seconds: -1, annotations: [] }),
      revision: 4,
    });
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    expect(currentSource().progress).toBe(0);
    expect(currentSource().error).toContain("暂不能保存");
    await expect(
      currentSource().createAnnotation({
        type: "NOTE",
        quote: "不可保存",
        note: "状态无效",
        locator: "article.xhtml#p-1",
        style: "HIGHLIGHT",
        color: "YELLOW",
      }),
    ).rejects.toThrow("暂不能保存批注");
    expect(saveReading).not.toHaveBeenCalled();
  });

  it("rolls back a failed optimistic annotation and clears the error after retry", async () => {
    saveReading.mockRejectedValueOnce(new Error("文章状态暂时冲突"));
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    let failed: unknown;
    await act(async () => {
      try {
        await currentSource().createAnnotation({
          type: "NOTE",
          quote: "新笔记",
          note: "首次保存失败",
          locator: "epubcfi(/6/10!/4/2)",
          style: "HIGHLIGHT",
          color: "YELLOW",
        });
      } catch (error) {
        failed = error;
      }
    });
    expect(failed).toBeInstanceOf(Error);
    expect(currentSource().annotations).toHaveLength(2);
    expect(currentSource().annotations.some((entry) => entry.quote === "新笔记")).toBe(false);
    expect(currentSource().error).toContain("文章状态暂时冲突");

    await act(async () => {
      await currentSource().createAnnotation({
        type: "NOTE",
        quote: "新笔记",
        note: "重试成功",
        locator: "epubcfi(/6/10!/4/2)",
        style: "HIGHLIGHT",
        color: "YELLOW",
      });
    });
    expect(currentSource().annotations.filter((entry) => entry.quote === "新笔记")).toHaveLength(1);
    expect(currentSource().error).toBeUndefined();
    expect(saveReading).toHaveBeenCalledTimes(2);
  });

  it("keeps article state isolated and flushes annotation changes immediately", async () => {
    const getBook = vi.spyOn(api, "getBook");
    const getDisplayBook = vi.spyOn(api, "getDisplayBook");
    const getPosition = vi.spyOn(api, "getReadingPosition");
    const savePosition = vi.spyOn(api, "saveReadingPosition");
    const recordTime = vi.spyOn(api, "recordReadingTime");
    const listAnnotations = vi.spyOn(api, "listAnnotations");
    const createBookAnnotation = vi.spyOn(api, "createAnnotation");
    const deleteBookAnnotation = vi.spyOn(api, "deleteAnnotation");
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    const source = currentSource();
    const stablePositionCallback = source.onPosition;
    act(() => source.onPosition("epubcfi(/6/8!/4/2)", 0.6));
    await waitFor(() => expect(currentSource().progress).toBe(0.6));
    expect(currentSource().onPosition).toBe(stablePositionCallback);

    let created: Awaited<ReturnType<typeof source.createAnnotation>> | undefined;
    await act(async () => {
      created = await currentSource().createAnnotation({
        type: "HIGHLIGHT",
        quote: "新批注",
        note: "即刻保存",
        locator: "epubcfi(/6/8!/4/2)",
        style: "UNDERLINE",
        color: "GOLD",
      });
    });
    expect(created).toMatchObject({
      bookId: "article-one",
      locator: "epubcfi(/6/8!/4/2)",
      style: "UNDERLINE",
      color: "GOLD",
    });
    expect(saveReading).toHaveBeenCalledTimes(1);
    expect(saveReading).toHaveBeenCalledWith(
      "article-one",
      expect.objectContaining({
        locator: "epubcfi(/6/8!/4/2)",
        progress: 0.6,
        annotations: expect.arrayContaining([
          expect.objectContaining({ style: "UNDERLINE", color: "GOLD", quote: "新批注" }),
        ]),
      }),
      7,
    );
    expect(getBook).not.toHaveBeenCalled();
    expect(getDisplayBook).not.toHaveBeenCalled();
    expect(getPosition).not.toHaveBeenCalled();
    expect(savePosition).not.toHaveBeenCalled();
    expect(recordTime).not.toHaveBeenCalled();
    expect(listAnnotations).not.toHaveBeenCalled();
    expect(createBookAnnotation).not.toHaveBeenCalled();
    expect(deleteBookAnnotation).not.toHaveBeenCalled();
  });

  it("persists multiple article bookmarks and restores them when reopening", async () => {
    const view = renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    const firstLocator = "epubcfi(/6/2!/4/2/1:25)";
    const secondLocator = "epubcfi(/6/2!/4/10/1:0)";
    for (const locator of [firstLocator, secondLocator]) {
      await act(async () => { await currentSource().createAnnotation({ type: "BOOKMARK", locator, quote: "", note: "", style: "HIGHLIGHT", color: "GOLD" }); });
    }
    const savedState = saveReading.mock.calls.at(-1)?.[1];
    expect(savedState.annotations.filter((entry: { type: string }) => entry.type === "BOOKMARK")).toHaveLength(2);
    view.unmount();
    reading.mockResolvedValueOnce({ state: JSON.stringify(savedState), revision: 9 });
    readerMock.source = null;
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    expect(currentSource().annotations.filter(entry => entry.type === "BOOKMARK").map(entry => entry.locator)).toEqual([firstLocator, secondLocator]);
  });

  it("restores an article bookmark when its removal fails to save", async () => {
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    let bookmark: Awaited<ReturnType<IndependentReaderSource["createAnnotation"]>>;
    await act(async () => { bookmark = await currentSource().createAnnotation({ type: "BOOKMARK", locator: "epubcfi(/6/2!/4/2/1:25)", quote: "", note: "", style: "HIGHLIGHT", color: "GOLD" }); });
    saveReading.mockRejectedValueOnce(new Error("书签保存冲突"));
    await act(async () => { await expect(currentSource().deleteAnnotation(bookmark!.id)).rejects.toThrow("书签保存冲突"); });
    expect(currentSource().annotations.some(entry => entry.id === bookmark!.id)).toBe(true);
    expect(currentSource().error).toContain("书签保存冲突");
  });

  it("does not read or save article state for an anonymous reader", async () => {
    sessionStorage.removeItem("bookkin-demo-session");
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    expect(reading).not.toHaveBeenCalled();
    expect(saveReading).not.toHaveBeenCalled();
    const source = currentSource();
    const extraActions = source.extraActions as ReactElement<{ children?: ReactNode }>;
    expect(isValidElement(extraActions)).toBe(true);
    expect(nodeText(extraActions.props.children)).not.toContain("保存阅读记录");
    await expect(
      source.createAnnotation({
        type: "NOTE",
        quote: "匿名笔记",
        note: "不应写入",
        locator: "p-1",
        style: "HIGHLIGHT",
        color: "YELLOW",
      }),
    ).rejects.toThrow("登录后可以保存文章批注");
  });

  it("revokes a generated EPUB URL when switching articles and when unmounted", async () => {
    const createUrl = vi.fn(() => `blob:article-${Math.random()}`);
    const revokeUrl = vi.fn();
    const oldCreate = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const oldRevoke = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeUrl });
    try {
      const view = renderReader();
      await waitFor(() => expect(readerMock.source).not.toBeNull());
      const firstUrl = currentSource().contentUrl;
      act(() => screen.getByRole("button", { name: "切换文章" }).click());
      await waitFor(() => expect(currentSource().title).toBe("第二篇文章"));
      expect(revokeUrl).toHaveBeenCalledWith(firstUrl);
      const secondUrl = currentSource().contentUrl;
      view.unmount();
      expect(revokeUrl).toHaveBeenCalledWith(secondUrl);
    } finally {
      if (oldCreate) Object.defineProperty(URL, "createObjectURL", oldCreate);
      else delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      if (oldRevoke) Object.defineProperty(URL, "revokeObjectURL", oldRevoke);
      else delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    }
  });

  it("shows EPUB generation errors and keeps the article open when return-save fails", async () => {
    vi.mocked(buildArticleEpub).mockRejectedValueOnce(new Error("EPUB 生成失败"));
    const view = renderReader();
    expect(await screen.findByRole("alert")).toHaveTextContent("EPUB 生成失败");
    view.unmount();

    vi.mocked(buildArticleEpub).mockResolvedValue(new Blob(["epub"]));
    saveReading.mockRejectedValueOnce(new Error("阅读记录冲突"));
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());
    const source = currentSource();
    act(() => source.onPosition("article.xhtml#p-9", 0.9));
    act(() => source.onBack());
    await waitFor(() => expect(currentSource().error).toContain("阅读记录冲突"));
    expect(screen.queryByTestId("article-index")).not.toBeInTheDocument();
  });
});
