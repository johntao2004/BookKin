import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ePub from "epubjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EpubDocumentReader from "./EpubDocumentReader";
import { TestProviders } from "../../test/TestProviders";
import { tokens } from "../../theme/generated-tokens";
import { useBookKinTheme } from "../../theme/BookKinThemeProvider";
import { bookKinThemeOptions } from "../../theme/theme";

vi.mock("epubjs", () => ({ default: vi.fn() }));

function createReaderMocks() {
  const contentsDocument = document.implementation.createHTMLDocument("EPUB contents");
  const callbacks: Record<string, unknown> = {};
  const rendition = {
    hooks: { content: { register: vi.fn() } },
    on: vi.fn((name: string, callback: unknown) => { callbacks[name] = callback; }),
    getContents: vi.fn(() => [{ document: contentsDocument, window }]),
    themes: { register: vi.fn(), select: vi.fn(), fontSize: vi.fn() },
    display: vi.fn(async () => undefined),
    prev: vi.fn(async () => undefined),
    next: vi.fn(async () => undefined),
    resize: vi.fn(),
    spread: vi.fn(),
    getRange: vi.fn(),
    destroy: vi.fn(),
  };
  const book = {
    renderTo: vi.fn((_host: HTMLElement, _options: Record<string, unknown>) => rendition),
    loaded: { navigation: Promise.resolve({ toc: [] }) },
    ready: Promise.resolve(),
    locations: {
      generate: vi.fn(async () => undefined),
      length: vi.fn(() => 0),
      percentageFromCfi: vi.fn(() => 0.42),
      cfiFromPercentage: vi.fn(() => "epubcfi(/6/2!/4/2)")
    },
    destroy: vi.fn(),
  };
  return { book, callbacks, contentsDocument, rendition };
}

function baseProps(onPosition = vi.fn()) {
  return {
    bookId: "book-1",
    annotations: [],
    theme: {
      background: tokens.color.semantic.surface,
      foreground: tokens.color.semantic.textPrimary,
      muted: tokens.color.semantic.textMuted,
    },
    fontSize: 19,
    fontFamily: "Georgia, serif",
    pageTurnEnabled: false,
    readOnly: true,
    onNavigation: vi.fn(),
    onSelect: vi.fn(),
    onPosition,
  };
}

function dispatchHorizontalSwipe(target: EventTarget, startX: number, endX: number) {
  const start = new Event("touchstart");
  Object.defineProperty(start, "changedTouches", { value: [{ clientX: startX }] });
  target.dispatchEvent(start);

  const end = new Event("touchend");
  Object.defineProperty(end, "changedTouches", { value: [{ clientX: endX }] });
  target.dispatchEvent(end);
}

describe("EpubDocumentReader flow", () => {
  let mocks: ReturnType<typeof createReaderMocks>;

  beforeEach(() => {
    mocks = createReaderMocks();
    vi.mocked(ePub).mockReset();
    vi.mocked(ePub).mockReturnValue(mocks.book as unknown as ReturnType<typeof ePub>);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
  });

  afterEach(() => {
    localStorage.removeItem("bookkin-site-theme");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves headings in one EPUB document to distinct bookmark boundaries without duplicate loads", async () => {
    mocks.contentsDocument.body.innerHTML = '<h2 id="one">第一点</h2><h2 id="two">第二点</h2>';
    const section = { href: "article.xhtml", document: mocks.contentsDocument, load: vi.fn(async () => mocks.contentsDocument.documentElement), cfiFromElement: vi.fn((element: Element) => `epubcfi(/6/2!/4/${element.id === "one" ? "2" : "4"})`) };
    Object.assign(mocks.book, { spine: { get: vi.fn(() => section) }, load: vi.fn() });
    mocks.book.loaded.navigation = Promise.resolve({ toc: [
      { href: "article.xhtml#one", label: "第一点" }, { href: "article.xhtml#two", label: "第二点" },
    ] }) as typeof mocks.book.loaded.navigation;
    const props = baseProps();
    const view = render(<TestProviders><EpubDocumentReader {...props} flow="scrolled-doc" /></TestProviders>);
    await waitFor(() => expect(props.onNavigation).toHaveBeenCalledWith([
      { href: "article.xhtml#one", label: "第一点", depth: 0, locator: "epubcfi(/6/2!/4/2)" },
      { href: "article.xhtml#two", label: "第二点", depth: 0, locator: "epubcfi(/6/2!/4/4)" },
    ]));
    expect(section.load).toHaveBeenCalledOnce();
    const target = "epubcfi(/6/2!/4/2/1:20)";
    view.rerender(<TestProviders><EpubDocumentReader {...props} flow="scrolled-doc" target={target} targetRevision={1} /></TestProviders>);
    await waitFor(() => expect(mocks.rendition.display).toHaveBeenLastCalledWith(target));
    const count = mocks.rendition.display.mock.calls.length;
    view.rerender(<TestProviders><EpubDocumentReader {...props} flow="scrolled-doc" target={target} targetRevision={2} /></TestProviders>);
    await waitFor(() => expect(mocks.rendition.display.mock.calls.length).toBeGreaterThan(count));
  });

  it("refreshes article colors immediately when the site theme changes without replacing its content", async () => {
    mocks.contentsDocument.body.innerHTML = '<p id="saved-paragraph">Existing reading locator</p>';
    const paragraph = mocks.contentsDocument.getElementById("saved-paragraph");
    const props = baseProps();
    function ThemeReader() {
      const { mode, setMode } = useBookKinTheme();
      return <>
        <button onClick={() => setMode(mode === "NIGHT" ? "PAPER" : "NIGHT")}>Change theme</button>
        <EpubDocumentReader {...props} theme={bookKinThemeOptions[mode].reader} flow="scrolled-doc" />
      </>;
    }
    render(<TestProviders><ThemeReader /></TestProviders>);
    await waitFor(() => expect(mocks.contentsDocument.querySelector("style[data-article-prose]")).not.toBeNull());
    const currentCss = () => mocks.contentsDocument.querySelector("style[data-article-prose]")?.textContent;
    expect(currentCss()).toContain(`--color-primary-soft: ${bookKinThemeOptions.PAPER.colors.primarySoft};`);
    fireEvent.click(screen.getByRole("button", { name: "Change theme" }));
    await waitFor(() => expect(currentCss()).toContain(`--color-primary-soft: ${bookKinThemeOptions.NIGHT.colors.primarySoft};`));
    fireEvent.click(screen.getByRole("button", { name: "Change theme" }));
    await waitFor(() => expect(currentCss()).toContain(`--color-primary-soft: ${bookKinThemeOptions.PAPER.colors.primarySoft};`));
    expect(mocks.contentsDocument.querySelectorAll("style[data-article-prose]")).toHaveLength(1);
    expect(mocks.contentsDocument.getElementById("saved-paragraph")).toBe(paragraph);
    expect(mocks.book.renderTo).toHaveBeenCalledOnce();
  });

  it("uses scrolled-doc without pagination controls or gesture turns, while reporting relocated CFIs", async () => {
    const onPosition = vi.fn();
    render(
      <TestProviders>
        <EpubDocumentReader {...baseProps(onPosition)} flow="scrolled-doc" contentLabel="文章" />
      </TestProviders>,
    );

    await waitFor(() => expect(mocks.book.renderTo).toHaveBeenCalled());
    expect(mocks.book.renderTo.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ flow: "scrolled-doc" }));
    await waitFor(() => expect(mocks.rendition.display).toHaveBeenCalled());
    expect(screen.queryByRole("navigation", { name: "文章 翻页" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "文章 上一页" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "文章 下一页" })).not.toBeInTheDocument();

    act(() => {
      (mocks.callbacks.relocated as (location: { start: { cfi: string; percentage: number } }) => void)({
        start: { cfi: "epubcfi(/6/4!/4/2:12)", percentage: 0.37 },
      });
    });
    expect(onPosition).toHaveBeenCalledWith("epubcfi(/6/4!/4/2:12)", 0.37);
    expect(mocks.rendition.hooks.content.register).toHaveBeenCalledOnce();
    expect(mocks.contentsDocument.body.classList.contains("bk-markdown-prose")).toBe(true);
    expect(mocks.contentsDocument.querySelector("style[data-article-prose]")).not.toBeNull();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    mocks.contentsDocument.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true }));
    dispatchHorizontalSwipe(mocks.contentsDocument, 260, 20);
    dispatchHorizontalSwipe(mocks.contentsDocument, 20, 260);
    expect(mocks.rendition.prev).not.toHaveBeenCalled();
    expect(mocks.rendition.next).not.toHaveBeenCalled();
  });

  it("keeps the ordinary EPUB flow paginated with previous and next controls", async () => {
    render(
      <TestProviders>
        <EpubDocumentReader {...baseProps()} />
      </TestProviders>,
    );

    await waitFor(() => expect(mocks.book.renderTo).toHaveBeenCalled());
    expect(mocks.book.renderTo.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ flow: "paginated" }));
    expect(mocks.contentsDocument.body.classList.contains("bk-markdown-prose")).toBe(false);

    await waitFor(() => expect(screen.getByRole("button", { name: "EPUB 上一页" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "EPUB 上一页" }));
    fireEvent.click(screen.getByRole("button", { name: "EPUB 下一页" }));
    expect(mocks.rendition.prev).toHaveBeenCalledOnce();
    expect(mocks.rendition.next).toHaveBeenCalledOnce();
  });
});
