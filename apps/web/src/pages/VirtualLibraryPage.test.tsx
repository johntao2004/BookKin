import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import {
  VirtualLibraryExperience as VirtualLibraryPage,
  virtualLibraryBookPreviewViewportWidth,
  virtualLibraryCompactPreviewMultiplier,
  virtualLibraryDevicePixelRatio,
  virtualLibraryPinchZoom,
  virtualLibraryUsesCompactViewport,
} from "./VirtualLibraryExperience";
import {
  BOOK_INSPECTION_LAYOUT,
  VIRTUAL_LIBRARY_SCENE_MODEL_VERSION,
} from "./virtual-library-scene";

describe("VirtualLibraryPage responsive scene sizing", () => {
  it("keeps a focused compact book readable and within both viewport dimensions", () => {
    for (const [width, height] of [[320, 504], [390, 780], [844, 326]]) {
      const bookHeight = 0.6;
      const bookWidth = 0.4;
      const depth = 2;
      const fov = 110;
      const multiplier = virtualLibraryCompactPreviewMultiplier({ width, height, bookWidth, bookHeight, depth, fov, zoom: 1 });
      const visibleWorldHeight = 2 * depth * Math.tan(fov * Math.PI / 360);
      const projectedHeight = bookHeight * multiplier / visibleWorldHeight * height;
      const projectedWidth = projectedHeight * bookWidth / bookHeight;
      expect(projectedHeight).toBeLessThanOrEqual(height / 3 + 0.01);
      expect(projectedWidth).toBeLessThanOrEqual(width / 3 + 0.01);
      expect(Math.max(projectedHeight / height, projectedWidth / width)).toBeCloseTo(1 / 3);
    }
  });
  it("bounds the WebGL backing store on high-density desktop displays", () => {
    const samples = [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1024, 768],
      [1440, 1000],
      [1920, 1080],
      [3840, 2160],
      [5120, 2880],
    ] as const;

    const ratios = samples.map(([width, height]) => virtualLibraryDevicePixelRatio(2, width, height));
    expect(ratios.slice(0, 6)).toEqual([1.5, 1.5, 1.5, 1.5, 1.5, 1.5]);
    expect(ratios[6]).toBeCloseTo(1);
    expect(ratios[7]).toBeCloseTo(0.75);
    expect(ratios.every(ratio => ratio > 0 && ratio <= 1.5)).toBe(true);
  });

  it("uses the compact scene layout on phones and short landscape viewports", () => {
    expect(virtualLibraryUsesCompactViewport(320, 568)).toBe(true);
    expect(virtualLibraryUsesCompactViewport(390, 844)).toBe(true);
    expect(virtualLibraryUsesCompactViewport(844, 390)).toBe(true);
    expect(virtualLibraryUsesCompactViewport(768, 1024)).toBe(false);
    expect(virtualLibraryUsesCompactViewport(1024, 768)).toBe(false);
    expect(virtualLibraryBookPreviewViewportWidth(844, 390))
      .toBe(BOOK_INSPECTION_LAYOUT.mobileBreakpoint);
    expect(virtualLibraryBookPreviewViewportWidth(390, 844)).toBe(390);
    expect(virtualLibraryBookPreviewViewportWidth(1440, 900)).toBe(1440);
  });

  it("maps two-finger spread and pinch distances onto bounded zoom", () => {
    expect(virtualLibraryPinchZoom(1, 100, 120, 0.8, 1.3)).toBeCloseTo(1.2);
    expect(virtualLibraryPinchZoom(1, 100, 50, 0.8, 1.3)).toBeCloseTo(0.8);
    expect(virtualLibraryPinchZoom(1, 100, 200, 0.8, 1.3)).toBeCloseTo(1.3);
    expect(virtualLibraryPinchZoom(1, 0, 200, 0.8, 1.3)).toBe(1);
  });
});

describe("VirtualLibraryPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({
      id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the private catalog into a standalone 3D library experience", async () => {
    render(<TestProviders initialPath="/virtual-library"><VirtualLibraryPage /></TestProviders>);

    expect(screen.getByRole("region", { name: "虚拟 3D 图书馆" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回书库" })).toHaveAttribute("href", "/library/all");
    expect(screen.queryByRole("heading", { name: "虚拟图书馆" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ 本藏书已入架 · 点击书架展开$/)).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "操作提示" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "我的藏书" })).not.toBeInTheDocument();
    for (const name of ["前往二楼楼梯", "服务楼梯上楼", "Fagel 室", "西端储藏室"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Henry Jones 室" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "沿长厅前行" })).not.toBeInTheDocument();
    expect(screen.getByText("W/A/S/D 移动 · Shift 上升 · Ctrl 下降。拖动环顾，滚轮前后移动，双指捏合缩放。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "馆长办公室" })).not.toBeInTheDocument();
    expect(screen.queryByText("360° 环视")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "向左" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "正前" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "向右" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("场景缩放控制")).not.toBeInTheDocument();
    expect(screen.queryByText("悬停查看书架框选 · 点击正面聚焦 · 滚轮缩放场景")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("图书管理员性别")).not.toBeInTheDocument();
    expect(screen.getByLabelText("可 360 度环视的虚拟图书馆 3D 场景")).toHaveAttribute(
      "data-scene-model",
      VIRTUAL_LIBRARY_SCENE_MODEL_VERSION,
    );
    const canvas = screen.getByLabelText("可 360 度环视的虚拟图书馆 3D 场景");
    expect(canvas).toHaveAttribute("data-scene-zoom", "1.00");
    expect(canvas).toHaveAttribute("data-active-room", "hall");
    fireEvent.click(screen.getByRole("button", { name: "关闭操作提示" }));
    expect(screen.queryByRole("complementary", { name: "操作提示" })).not.toBeInTheDocument();
    expect(canvas).toBeInTheDocument();
  });

  it("keeps the scene UI available when WebGL is unavailable", async () => {
    render(<TestProviders initialPath="/virtual-library"><VirtualLibraryPage /></TestProviders>);

    const canvas = screen.getByLabelText("可 360 度环视的虚拟图书馆 3D 场景");
    expect(canvas).toBeInTheDocument();
    await waitFor(() => expect(Number(canvas.getAttribute("data-book-model-count"))).toBeGreaterThan(0));
  });

  it("offers an in-place retry when the catalog connection fails", async () => {
    const listBooks = vi.spyOn(api, "listBooks").mockRejectedValueOnce(new Error("offline"));
    render(<TestProviders initialPath="/virtual-library"><VirtualLibraryPage /></TestProviders>);

    expect(await screen.findByText("藏书数据暂时未连接，书架无法展开。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载藏书" }));

    await waitFor(() => expect(listBooks).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(Number(screen.getByLabelText("可 360 度环视的虚拟图书馆 3D 场景").getAttribute("data-book-model-count"))).toBeGreaterThan(0);
    });
  });
});
