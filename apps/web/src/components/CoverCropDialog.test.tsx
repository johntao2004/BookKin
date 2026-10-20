// 覆盖四角缩放、图片边界和 800×1200 导出，并确认取消不生成也不上传封面。
// Covers corner resizing, image bounds and 800×1200 export, with cancellation producing no upload.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { coverCropRect, resizeCoverCrop, useCoverCrop } from "./CoverCropDialog";

describe("cover crop", () => {
  afterEach(() => vi.restoreAllMocks());
  it.each([[1600, 900], [600, 1800], [800, 1200]])("keeps a 2:3 crop inside %s × %s at every edge and zoom", (width, height) => {
    for (const zoom of [1, 1.5, 3]) for (const x of [0, 50, 100]) for (const y of [0, 50, 100]) {
      const rect = coverCropRect(width, height, zoom, x, y);
      expect(rect.width / rect.height).toBeCloseTo(2 / 3);
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(height);
    }
  });
  it("resizes each corner within image bounds while anchoring its opposite corner", () => {
    const original = { x: 300, y: 150, width: 200, height: 300 };
    for (const corner of ["nw", "ne", "sw", "se"] as const) for (const delta of [-10000, -50, 50, 10000]) {
      const result = resizeCoverCrop(original, corner, delta, delta, 1000, 800);
      expect(result.width / result.height).toBeCloseTo(2 / 3);
      expect(result.x).toBeGreaterThanOrEqual(0); expect(result.y).toBeGreaterThanOrEqual(0);
      expect(result.x + result.width).toBeLessThanOrEqual(1000.000001);
      expect(result.y + result.height).toBeLessThanOrEqual(800.000001);
      expect(corner.endsWith("e") ? result.x : result.x + result.width).toBeCloseTo(corner.endsWith("e") ? original.x : original.x + original.width);
      expect(corner.startsWith("s") ? result.y : result.y + result.height).toBeCloseTo(corner.startsWith("s") ? original.y : original.y + original.height);
    }
  });
  it("exports exactly the confirmed frame as an 800 × 1200 JPEG", async () => {
    const completed = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:crop-source");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const bitmap = { width: 1600, height: 900, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback) { callback(new Blob(["jpeg"], { type: "image/jpeg" })); });
    function Harness() { const { requestCrop, cropDialog } = useCoverCrop(); return <>{cropDialog}<button onClick={() => void requestCrop(new File(["image"], "cover.png", { type: "image/png" })).then(completed)}>选择</button></>; }
    render(<TestProviders><Harness /></TestProviders>);
    fireEvent.click(screen.getByText("选择"));
    const image = await screen.findByAltText("封面裁剪预览");
    Object.defineProperties(image, { naturalWidth: { value: 1600 }, naturalHeight: { value: 900 } });
    fireEvent.load(image);
    fireEvent.click(screen.getByText("确认裁剪"));
    await vi.waitFor(() => expect(completed).toHaveBeenCalledWith(expect.any(Blob)));
    expect(draw).toHaveBeenCalledWith(bitmap, 500, 0, 600, 900, 0, 0, 800, 1200);
    expect(bitmap.close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
  it("cancels without producing or uploading a cover", async () => {
    const completed = vi.fn();
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:crop-source");
    function Harness() { const { requestCrop, cropDialog } = useCoverCrop(); return <>{cropDialog}<button onClick={() => void requestCrop(new File(["image"], "cover.png", { type: "image/png" })).then(completed)}>选择</button></>; }
    render(<TestProviders><Harness /></TestProviders>);
    fireEvent.click(screen.getByText("选择"));
    const image = await screen.findByAltText("封面裁剪预览");
    Object.defineProperties(image, { naturalWidth: { value: 1600 }, naturalHeight: { value: 900 } });
    fireEvent.load(image);
    expect(screen.getByLabelText("2:3 封面裁剪框")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByText(/拖动图片或调整滑块/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("取消裁剪"));
    await vi.waitFor(() => expect(completed).toHaveBeenCalledWith(null));
    expect(revoke).toHaveBeenCalledWith("blob:crop-source");
  });
});
