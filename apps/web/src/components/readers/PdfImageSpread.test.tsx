import { render, screen, waitFor } from "@testing-library/react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { vi } from "vitest";
import { PdfImageSpread, pdfImageSpreadLayout } from "./PdfImageSpread";

describe("pdfImageSpreadLayout", () => {
  it("fits a touching spread to height without equal-width slots", () => {
    expect(pdfImageSpreadLayout([{ width: 600, height: 800 }, { width: 400, height: 800 }], 1400, 1000))
      .toEqual({ width: 1250, height: 1000, scale: 1.25 });
  });
  it("fits the complete spread to width, including differently sized pages", () => {
    expect(pdfImageSpreadLayout([{ width: 600, height: 800 }, { width: 800, height: 600 }], 700, 800))
      .toEqual({ width: 700, height: 400, scale: 0.5 });
  });
  it("lets a single page fill the viewport beyond the old 2x limit", () => {
    expect(pdfImageSpreadLayout([{ width: 200, height: 300 }], 1000, 1200))
      .toEqual({ width: 800, height: 1200, scale: 4 });
  });
  it("waits for a measured viewport without overflowing", () => {
    expect(pdfImageSpreadLayout([{ width: 600, height: 800 }], 0, 0))
      .toEqual({ width: 0, height: 0, scale: 0 });
  });
});

it("centers two adjacent pages as a group and expands the final single page", async () => {
  const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1400 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 1000 });
  const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  const page = (width: number, height: number) => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: width * scale, height: height * scale }),
    render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
  }) as unknown as PDFPageProxy;
  const pages = [page(600, 800), page(400, 800), page(600, 800)];
  const document = { numPages: 3, getPage: vi.fn(async (number: number) => pages[number - 1]) } as unknown as PDFDocumentProxy;
  try {
    const view = render(<PdfImageSpread document={document} pageNumber={1} spread muted="gray" />);
    const first = await screen.findByRole("img", { name: "PDF 第 1 页图片" });
    const second = await screen.findByRole("img", { name: "PDF 第 2 页图片" });
    expect(first.parentElement).toHaveStyle({ width: "750px", height: "1000px" });
    expect(second.parentElement).toHaveStyle({ width: "500px", height: "1000px" });
    expect(first.parentElement?.parentElement).toHaveStyle({ width: "1250px", height: "1000px" });
    expect(first).not.toHaveStyle({ borderRadius: "12px" });
    await waitFor(() => expect(screen.queryByText("正在加载第 1 页图片…")).not.toBeInTheDocument());
    view.rerender(<PdfImageSpread document={document} pageNumber={3} spread muted="gray" />);
    expect((await screen.findByRole("img", { name: "PDF 第 3 页图片" })).parentElement).toHaveStyle({ width: "750px", height: "1000px" });
    expect(screen.queryByRole("img", { name: "PDF 第 4 页图片" })).not.toBeInTheDocument();
    view.rerender(<PdfImageSpread document={document} pageNumber={1} spread={false} muted="gray" />);
    expect(await screen.findByRole("img", { name: "PDF 第 1 页图片" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "PDF 第 2 页图片" })).not.toBeInTheDocument();
  } finally {
    context.mockRestore();
    if (widthDescriptor) Object.defineProperty(HTMLElement.prototype, "clientWidth", widthDescriptor);
    if (heightDescriptor) Object.defineProperty(HTMLElement.prototype, "clientHeight", heightDescriptor);
  }
});
