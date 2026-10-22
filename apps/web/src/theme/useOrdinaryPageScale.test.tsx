// 覆盖宽屏缩放、尺寸变化与退出恢复，阅读和沉浸页面禁用时保持原始比例。
// Covers wide-screen scaling, resize and cleanup while disabled reader/immersive surfaces remain unscaled.
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useOrdinaryPageScale } from "./useOrdinaryPageScale";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("gently enlarges wide viewports, responds to resize, and restores the root on exit", () => {
  vi.stubGlobal("innerWidth", 3840);
  vi.stubGlobal("innerHeight", 2160);
  const { rerender, unmount } = renderHook(({ enabled }) => useOrdinaryPageScale(enabled), { initialProps: { enabled: true } });
  const root = document.documentElement;
  expect(root.style.zoom).toBe("1.25");
  expect(root.style.getPropertyValue("--app-viewport-height")).toBe("1728px");
  act(() => { vi.stubGlobal("innerWidth", 5120); window.dispatchEvent(new Event("resize")); });
  expect(Number(root.style.zoom)).toBeCloseTo(1.4167, 3);
  act(() => { vi.stubGlobal("innerWidth", 1440); window.dispatchEvent(new Event("resize")); });
  expect(root.style.zoom).toBe("1");
  rerender({ enabled: false });
  expect(root.style.zoom).toBe("");
  expect(root.style.getPropertyValue("--app-viewport-width")).toBe("1440px");
  expect(root.style.getPropertyValue("--app-viewport-height")).toBe("2160px");
  unmount();
  expect(root.style.getPropertyValue("--app-viewport-width")).toBe("");
  expect(root.style.getPropertyValue("--app-viewport-height")).toBe("");
  expect(root.style.getPropertyValue("--app-page-width")).toBe("");
});

it("leaves reader and immersive surfaces unscaled when disabled", () => {
  vi.stubGlobal("innerWidth", 5120);
  vi.stubGlobal("innerHeight", 2880);
  const { unmount } = renderHook(() => useOrdinaryPageScale(false));
  expect(document.documentElement.style.zoom).toBe("");
  expect(document.documentElement.style.getPropertyValue("--app-viewport-width")).toBe("5120px");
  expect(document.documentElement.style.getPropertyValue("--app-viewport-height")).toBe("2880px");
  act(() => {
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    window.dispatchEvent(new Event("resize"));
  });
  expect(document.documentElement.style.zoom).toBe("");
  expect(document.documentElement.style.getPropertyValue("--app-viewport-width")).toBe("390px");
  expect(document.documentElement.style.getPropertyValue("--app-viewport-height")).toBe("844px");
  unmount();
});

it("keeps the background scrollbar lane reserved when resizing with a drawer open", () => {
  const root = document.documentElement;
  vi.stubGlobal("innerWidth", 1118);
  let measuredWidth = 1103;
  vi.spyOn(root, "getBoundingClientRect").mockImplementation(() => ({ width: measuredWidth }) as DOMRect);
  const { rerender, unmount } = renderHook(({ enabled }) => useOrdinaryPageScale(enabled), { initialProps: { enabled: false } });
  expect(root.style.getPropertyValue("--app-page-width")).toBe("1103px");

  const drawer = document.createElement("div");
  drawer.className = "ant-drawer-open";
  document.body.append(drawer);
  measuredWidth = 1440;
  act(() => {
    vi.stubGlobal("innerWidth", 1440);
    window.dispatchEvent(new Event("resize"));
  });
  expect(root.style.getPropertyValue("--app-page-width")).toBe("1425px");
  expect(root.style.getPropertyValue("--app-viewport-width")).toBe("1440px");

  drawer.remove();
  measuredWidth = 3825;
  act(() => {
    vi.stubGlobal("innerWidth", 3840);
    window.dispatchEvent(new Event("resize"));
  });
  expect(root.style.getPropertyValue("--app-page-width")).toBe("3825px");
  expect(root.style.zoom).toBe("");
  rerender({ enabled: true });
  expect(root.style.zoom).toBe("1.25");
  expect(root.style.getPropertyValue("--app-page-width")).toBe("3060px");
  unmount();
});
