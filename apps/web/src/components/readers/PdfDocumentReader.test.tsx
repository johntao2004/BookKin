import { render, screen, waitFor } from "@testing-library/react";
import { getDocument } from "pdfjs-dist";
import { vi } from "vitest";
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
    expect(screen.getByRole("navigation", { name: "PDF 翻页" })).toHaveTextContent("第 1 页 · 1/1 · 共 8 页");
    expect(screen.queryByText(/^第 1 页$/u)).not.toBeInTheDocument();
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
