import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { IndependentReaderSource } from "../components/readers/independent-reader-source";
import { articles, type Article } from "../features/content/api";
import { buildArticleEpub } from "../features/content/article-document";
import { TestProviders } from "../test/TestProviders";
import { ArticleReaderPage, createArticleAnnotationLocatorResolver } from "./ArticleReaderPage";

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


describe("article selection locator normalization", () => {
  it("maps a paragraph CFI only when its quote occurs once in the generated paragraph", () => {
    const locator = "epubcfi(/6/2!/4/2/6[p-2],/2/2/2/1:0,/38/2/2/1:1)";
    const unique = createArticleAnnotationLocatorResolver({
      html: "<p>前文</p><p id=\"p-2\">你好，唯一原文。</p>",
    });
    const repeated = createArticleAnnotationLocatorResolver({
      html: "<p id=\"p-2\">nihao 和 nihao</p>",
    });
    const generatedId = createArticleAnnotationLocatorResolver({
      html: "<p>前文</p><p>生成段落 ID</p>",
    });

    expect(unique(locator, "唯一原文")).toBe("article.xhtml#p-2");
    expect(repeated(locator, "nihao")).toBe(locator);
    expect(generatedId(locator, "生成段落 ID")).toBe("article.xhtml#p-2");
    expect(unique("epubcfi(/6/2!/4/2/6[p-9],/2/2/2/1:0,/38/2/2/1:1)", "唯一原文"))
      .toBe("epubcfi(/6/2!/4/2/6[p-9],/2/2/2/1:0,/38/2/2/1:1)");
  });
});

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

  it("upgrades a matching article highlight to a note without adding a duplicate record", async () => {
    reading.mockResolvedValueOnce({
      state: JSON.stringify({
        locator: "",
        progress: 0,
        seconds: 0,
        annotations: [{
          id: "existing-highlight",
          type: "HIGHLIGHT",
          quote: "同一原文",
          note: "",
          locator: "epubcfi(/6/8!/4/2)",
          style: "UNDERLINE",
          color: "CORAL",
          createdAt: "2026-10-20T00:00:00.000Z",
        }],
      }),
      revision: 12,
    });
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());

    let saved: Awaited<ReturnType<IndependentReaderSource["createAnnotation"]>> | undefined;
    await act(async () => {
      saved = await currentSource().createAnnotation({
        type: "NOTE",
        quote: " 同一原文 ",
        note: "补充思考",
        locator: "epubcfi(/6/8!/4/2)",
        style: "BOLD",
        color: "TEAL",
      });
    });

    expect(saved).toMatchObject({ id: "existing-highlight", type: "NOTE", note: "补充思考" });
    expect(currentSource().annotations).toHaveLength(1);
    expect(saveReading.mock.calls.at(-1)?.[1].annotations).toEqual([
      expect.objectContaining({ id: "existing-highlight", type: "NOTE", note: "补充思考", style: "BOLD", color: "TEAL" }),
    ]);
  });

  it("keeps existing note content and type when highlighting its passage", async () => {
    reading.mockResolvedValueOnce({
      state: JSON.stringify({
        annotations: [{
          id: "existing-note",
          type: "NOTE",
          quote: "同一原文",
          note: "不可覆盖的笔记",
          locator: "epubcfi(/6/8!/4/2)",
          style: "HIGHLIGHT",
          color: "YELLOW",
          createdAt: "2026-10-20T00:00:00.000Z",
        }],
      }),
      revision: 12,
    });
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());

    let saved: Awaited<ReturnType<IndependentReaderSource["createAnnotation"]>> | undefined;
    await act(async () => {
      saved = await currentSource().createAnnotation({
        type: "HIGHLIGHT",
        quote: "同一原文",
        note: "",
        locator: "epubcfi(/6/8!/4/2)",
        style: "UNDERLINE",
        color: "TEAL",
      });
    });

    expect(saved).toMatchObject({ id: "existing-note", type: "NOTE", note: "不可覆盖的笔记", style: "UNDERLINE", color: "TEAL" });
    expect(currentSource().annotations).toHaveLength(1);
    expect(saveReading.mock.calls.at(-1)?.[1].annotations).toEqual([
      expect.objectContaining({ id: "existing-note", type: "NOTE", note: "不可覆盖的笔记" }),
    ]);
  });

  it("normalizes legacy paragraph CFIs and saves an edited history as one note", async () => {
    vi.mocked(articles.get).mockResolvedValueOnce({
      ...article,
      html: '<p id="p-2">这是一段独一无二的原文</p>',
    });
    reading.mockResolvedValueOnce({
      state: JSON.stringify({
        locator: "",
        progress: 0.1,
        seconds: 9,
        annotations: [
          {
            id: "legacy-highlight",
            type: "HIGHLIGHT",
            quote: "这是一段独一无二的原文",
            note: "",
            locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/1:0,/38/2/1:1)",
            style: "HIGHLIGHT",
            createdAt: "2026-10-20T00:00:00.000Z",
          },
          {
            id: "legacy-note-one",
            type: "NOTE",
            quote: "这是一段独一无二的原文",
            note: "nihao",
            locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/1:0,/38/2/1:2)",
            style: "HIGHLIGHT",
            createdAt: "2026-10-21T00:00:00.000Z",
          },
          {
            id: "legacy-note-two",
            type: "NOTE",
            quote: "这是一段独一无二的原文",
            note: "666666",
            locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/2/1:0,/38/2/2/1:1)",
            style: "BOLD",
            createdAt: "2026-10-22T00:00:00.000Z",
          },
        ],
      }),
      revision: 14,
    });
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());

    expect(currentSource().annotations.map((item) => item.locator)).toEqual([
      "article.xhtml#p-2",
      "article.xhtml#p-2",
      "article.xhtml#p-2",
    ]);
    const editedNote = "nihao\n\n666666\n\n已合并编辑";
    let saved: Awaited<ReturnType<IndependentReaderSource["createAnnotation"]>> | undefined;
    await act(async () => {
      saved = await currentSource().createAnnotation({
        type: "NOTE",
        quote: "这是一段独一无二的原文",
        note: editedNote,
        locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/2/1:0,/38/2/2/1:1)",
        style: "BOLD",
        color: "TEAL",
      });
    });

    expect(saved).toMatchObject({ id: "legacy-note-two", type: "NOTE", note: editedNote, locator: "article.xhtml#p-2" });
    expect(currentSource().annotations).toHaveLength(1);
    expect(saveReading.mock.calls.at(-1)?.[1].annotations).toEqual([
      expect.objectContaining({
        id: "legacy-note-two",
        type: "NOTE",
        note: editedNote,
        locator: "article.xhtml#p-2",
      }),
    ]);
  });

  it("restores only the affected annotation group after failure and keeps newer position", async () => {
    let rejectSave: ((error: Error) => void) | undefined;
    saveReading.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
      rejectSave = reject;
    }));
    vi.mocked(articles.get).mockResolvedValueOnce({
      ...article,
      html: '<p id="p-2">原文</p><p id="p-3">别处</p>',
    });
    reading.mockResolvedValueOnce({
      state: JSON.stringify({
        locator: "p-3",
        progress: 0.2,
        seconds: 15,
        annotations: [
          {
            id: "existing-highlight",
            type: "HIGHLIGHT",
            quote: "原文",
            note: "",
            locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/1:0,/38/2/1:1)",
            style: "UNDERLINE",
            createdAt: "2026-10-20T00:00:00.000Z",
          },
          {
            id: "existing-note-one",
            type: "NOTE",
            quote: "原文",
            note: "旧笔记一",
            locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/1:0,/38/2/1:2)",
            style: "HIGHLIGHT",
            createdAt: "2026-10-20T00:00:00.000Z",
          },
          {
            id: "existing-note-two",
            type: "NOTE",
            quote: "原文",
            note: "旧笔记二",
            locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/2/1:0,/38/2/2/1:1)",
            style: "BOLD",
            createdAt: "2026-10-21T00:00:00.000Z",
          },
          {
            id: "other-note",
            type: "NOTE",
            quote: "别处",
            note: "其它记录",
            locator: "article.xhtml#p-3",
            style: "HIGHLIGHT",
            createdAt: "2026-10-20T00:00:00.000Z",
          },
        ],
      }),
      revision: 12,
    });
    renderReader();
    await waitFor(() => expect(readerMock.source).not.toBeNull());

    let createPromise: ReturnType<IndependentReaderSource["createAnnotation"]> | undefined;
    act(() => {
      createPromise = currentSource().createAnnotation({
        type: "NOTE",
        quote: "原文",
        note: "旧笔记一\n\n旧笔记二\n\n保存失败的新笔记",
        locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/2/1:0,/38/2/2/1:1)",
        style: "BOLD",
        color: "TEAL",
      });
    });
    act(() => currentSource().onPosition("epubcfi(/6/8!/4/8)", 0.85));
    await act(async () => {
      rejectSave?.(new Error("保存失败"));
      await expect(createPromise).rejects.toThrow("保存失败");
    });

    expect(currentSource().progress).toBe(0.85);
    expect(currentSource().annotations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "existing-highlight", type: "HIGHLIGHT", note: "" }),
      expect.objectContaining({ id: "existing-note-one", type: "NOTE", note: "旧笔记一" }),
      expect.objectContaining({ id: "existing-note-two", type: "NOTE", note: "旧笔记二" }),
      expect.objectContaining({ id: "other-note", note: "其它记录" }),
    ]));
    expect(currentSource().annotations).toHaveLength(4);
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
    expect(source).not.toHaveProperty("extraActions");
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
