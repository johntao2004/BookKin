// 覆盖重排页裁切、单双页布局及跨原始页回退；上一页尚未测量时应返回等待状态。
// Covers reflow clipping, single/spread layout and cross-original-page back navigation, returning a pending state when the previous page is not measured.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDocument } from "pdfjs-dist";
import { vi } from "vitest";
import type { Annotation } from "../../domain/types";
import { tokens } from "../../theme/generated-tokens";
import PdfDocumentReader, { PdfReadingClipFrame, previousPdfLocation } from "./PdfDocumentReader";

vi.mock("pdfjs-dist", () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {},
  TextLayer: class {},
}));

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "pdf-worker" }));

describe("PdfReadingClipFrame", () => {
  it("clips virtual PDF columns at the inner reading-page boundary", () => {
    const { container } = render(
      <PdfReadingClipFrame>
        <p>下一虚拟页</p>
      </PdfReadingClipFrame>,
    );

    const frame = container.querySelector(".pdf-reading-clip-frame");
    expect(frame).not.toBeNull();
    expect(frame).toHaveStyle({ height: "100%", minHeight: "0", width: "100%", overflow: "hidden" });
    expect(frame).toContainElement(screen.getByText("下一虚拟页"));
  });

  it("derives the PDF spread from the measured reading surface", async () => {
    const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return this.classList?.contains("reader-page-turn-surface") ? tokens.layout.breakpointTablet : 0;
      },
    });
    vi.mocked(getDocument).mockReturnValue({
      promise: new Promise(() => undefined),
      destroy: vi.fn(),
    } as unknown as ReturnType<typeof getDocument>);

    const { container } = render(
      <PdfDocumentReader
        bookId="book-pdf"
        annotations={[]}
        theme={{ background: "white", foreground: "black", muted: "gray" }}
        fontSize={19}
        fontFamily="serif"
        readOnly
        onSelect={vi.fn()}
        onPosition={vi.fn()}
      />,
    );

    const frame = container.querySelector(".pdf-reading-clip-frame");
    const readingSurface = container.querySelector(".reader-page-turn-surface");
    const pagination = screen.getByRole("navigation", { name: "PDF 翻页" });
    await waitFor(() => expect(readingSurface).toHaveAttribute("data-reader-spread", "true"));
    await waitFor(() => expect(frame?.parentElement).toHaveStyle({ width: "100%", maxWidth: "none" }));
    expect(readingSurface?.nextElementSibling).toBe(pagination);
    if (widthDescriptor) Object.defineProperty(HTMLElement.prototype, "clientWidth", widthDescriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  });

  it("jumps to PDF bookmarks after opening, including repeated requests to the same target", async () => {
    const onPosition = vi.fn();
    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.resolve({ numPages: 8, getPage: vi.fn(() => new Promise(() => undefined)) }),
      destroy: vi.fn(),
    } as unknown as ReturnType<typeof getDocument>);
    const props = { bookId: "pdf-bookmark", annotations: [], theme: { background: "white", foreground: "black", muted: "gray" }, fontSize: 19, fontFamily: "serif", readOnly: true, onSelect: vi.fn(), onPosition };
    const view = render(<PdfDocumentReader {...props} />);
    await waitFor(() => expect(onPosition).toHaveBeenCalledWith("pdf:page=1&offset=0", expect.any(Number)));
    view.rerender(<PdfDocumentReader {...props} target="pdf:page=5&offset=2" targetRevision={1} />);
    await waitFor(() => expect(onPosition).toHaveBeenLastCalledWith("pdf:page=5&offset=2", expect.any(Number)));
    view.rerender(<PdfDocumentReader {...props} target="pdf:page=2" targetRevision={2} />);
    await waitFor(() => expect(onPosition).toHaveBeenLastCalledWith("pdf:page=2&offset=0", expect.any(Number)));
    view.rerender(<PdfDocumentReader {...props} target="pdf:page=5&offset=2" targetRevision={3} />);
    await waitFor(() => expect(onPosition).toHaveBeenLastCalledWith("pdf:page=5&offset=2", expect.any(Number)));
  });

  it("resolves PDF outlines into chapter boundaries for bookmark markers", async () => {
    const onNavigation = vi.fn();
    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.resolve({ numPages: 8, getPage: vi.fn(() => new Promise(() => undefined)),
        getOutline: vi.fn().mockResolvedValue([{ title: "第一章", dest: "chapter-one", items: [{ title: "第一点", dest: [2], items: [] }] }]),
        getDestination: vi.fn().mockResolvedValue([{ num: 12, gen: 0 }]),
        getPageIndex: vi.fn().mockResolvedValue(1),
      }),
      destroy: vi.fn(),
    } as unknown as ReturnType<typeof getDocument>);
    render(<PdfDocumentReader bookId="pdf-outline" annotations={[]} theme={{ background: "white", foreground: "black", muted: "gray" }} fontSize={19} fontFamily="serif" readOnly onNavigation={onNavigation} onSelect={vi.fn()} onPosition={vi.fn()} />);
    await waitFor(() => expect(onNavigation).toHaveBeenCalledWith([
      { href: "pdf:page=2", locator: "pdf:page=2", label: "第一章", depth: 0 },
      { href: "pdf:page=3", locator: "pdf:page=3", label: "第一点", depth: 1 },
    ]));
  });

  it("uses the bottom navigation as the only generated PDF page label", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const page = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: "这是一段正文。", transform: [1, 0, 0, 12, 36, 720], width: 96, height: 12, hasEOL: true }],
      }),
    };
    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.resolve({ numPages: 8, getPage: vi.fn().mockResolvedValue(page) }),
      destroy: vi.fn(),
    } as unknown as ReturnType<typeof getDocument>);

    render(
      <PdfDocumentReader
        bookId="book-pdf"
        annotations={[]}
        theme={{ background: "white", foreground: "black", muted: "gray" }}
        fontSize={19}
        fontFamily="serif"
        readOnly
        onSelect={vi.fn()}
        onPosition={vi.fn()}
      />,
    );

    expect(await screen.findByText("这是一段正文。")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "PDF 翻页" })).toHaveTextContent("第 1 页 · 共 8 页");
    expect(screen.queryByText(/^第 1 页$/u)).not.toBeInTheDocument();
  });
});

describe("PdfDocumentReader annotation activation", () => {
  it("opens notes by click or keyboard, ignores selected text and plain highlights, and keeps the callback current", async () => {
    vi.mocked(getDocument).mockClear();
    const page = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: "点击笔记打开，普通高亮不打开。", transform: [1, 0, 0, 12, 36, 720], width: 240, height: 12, hasEOL: true }],
      }),
    };
    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.resolve({ numPages: 1, getPage: vi.fn().mockResolvedValue(page) }),
      destroy: vi.fn(),
    } as unknown as ReturnType<typeof getDocument>);
    const note: Annotation = {
      id: "pdf-note",
      bookId: "book-pdf",
      type: "NOTE",
      style: "HIGHLIGHT",
      color: "PINK",
      locator: "pdf:page=1&offset=0",
      quote: "点击笔记打开",
      note: "这段内容要再读一次。",
      createdAt: "2026-10-28T00:00:00Z",
    };
    const plainHighlight: Annotation = {
      id: "pdf-plain-highlight",
      bookId: "book-pdf",
      type: "HIGHLIGHT",
      style: "HIGHLIGHT",
      color: "YELLOW",
      locator: "pdf:page=1&offset=0",
      quote: "普通高亮不打开",
      createdAt: "2026-10-28T00:00:00Z",
    };
    const firstCallback = vi.fn();
    const latestCallback = vi.fn();
    const props = {
      bookId: "book-pdf",
      annotations: [note, plainHighlight],
      theme: { background: "white", foreground: "black", muted: "gray" },
      fontSize: 19,
      fontFamily: "serif",
      readOnly: true,
      onSelect: vi.fn(),
      onPosition: vi.fn(),
    };
    const view = render(<PdfDocumentReader {...props} onAnnotationActivate={firstCallback} />);
    const noteMark = (await screen.findAllByRole("button", { name: "编辑划线或笔记" })).find(mark => mark.dataset.annotationId === "pdf-note")!;
    expect(noteMark).toHaveAttribute("data-annotation-id", "pdf-note");
    const plainMark = view.container.querySelector<HTMLElement>('[data-annotation-id="pdf-plain-highlight"]');
    expect(plainMark).not.toBeNull();

    fireEvent.click(noteMark);
    fireEvent.keyDown(noteMark, { key: "Enter" });
    fireEvent.keyDown(noteMark, { key: " " });
    expect(firstCallback).toHaveBeenNthCalledWith(1, "pdf-note", expect.any(DOMRect));
    expect(firstCallback).toHaveBeenNthCalledWith(2, "pdf-note", expect.any(DOMRect));
    expect(firstCallback).toHaveBeenNthCalledWith(3, "pdf-note", expect.any(DOMRect));

    const range = document.createRange();
    range.selectNodeContents(noteMark);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent.click(noteMark);
    selection?.removeAllRanges();
    fireEvent.click(plainMark!);
    expect(firstCallback).toHaveBeenCalledTimes(4);

    view.rerender(<PdfDocumentReader {...props} onAnnotationActivate={latestCallback} />);
    fireEvent.click(view.container.querySelector('[data-annotation-id="pdf-note"]')!);
    expect(latestCallback).toHaveBeenCalledWith("pdf-note", expect.any(DOMRect));
    expect(firstCallback).toHaveBeenCalledTimes(4);
    expect(getDocument).toHaveBeenCalledTimes(1);
  });
});

describe("previousPdfLocation", () => {
  it("moves to the preceding virtual page inside one PDF page", () => {
    expect(previousPdfLocation({ pageNumber: 3, virtualPageIndex: 1, previousVirtualPageCount: 2 }))
      .toEqual({ pageNumber: 3, virtualPageIndex: 0, waitForPageCount: false });
  });

  it("returns to the final virtual page of the preceding PDF page", () => {
    expect(previousPdfLocation({ pageNumber: 3, virtualPageIndex: 0, previousVirtualPageCount: 2 }))
      .toEqual({ pageNumber: 2, virtualPageIndex: 1, waitForPageCount: false });
  });

  it("waits for pagination when the preceding PDF page has not been measured", () => {
    expect(previousPdfLocation({ pageNumber: 3, virtualPageIndex: 0 }))
      .toEqual({ pageNumber: 2, virtualPageIndex: 0, waitForPageCount: true });
  });
});

it("shows two scanned pages on wide screens and advances without skipping pages", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => tokens.layout.breakpointTablet });
  const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  const page = { getTextContent: async () => ({ items: [], styles: {} }), getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }), render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }) };
  vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve({ numPages: 5, getPage: async () => page }), destroy: vi.fn() } as unknown as ReturnType<typeof getDocument>);
  try {
    render(<PdfDocumentReader bookId="scan" annotations={[]} theme={{ background: "white", foreground: "black", muted: "gray" }} fontSize={19} fontFamily="sans-serif" pageTurnEnabled={false} readOnly onSelect={vi.fn()} onPosition={vi.fn()} />);
    expect(await screen.findByRole("img", { name: "PDF 第 1 页图片" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "PDF 第 2 页图片" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PDF 下一页" }));
    expect(await screen.findByRole("img", { name: "PDF 第 3 页图片" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "PDF 第 4 页图片" })).toBeInTheDocument();
  } finally {
    context.mockRestore();
    if (descriptor) Object.defineProperty(HTMLElement.prototype, "clientWidth", descriptor);
  }
});
