// 覆盖宽屏缩放、尺寸变化与退出恢复，阅读和沉浸页面禁用时保持原始比例。
// Covers wide-screen scaling, resize and cleanup while disabled reader/immersive surfaces remain unscaled.
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useOrdinaryPageScale } from "./useOrdinaryPageScale";

afterEach(() => vi.unstubAllGlobals());

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
  expect(root.style.getPropertyValue("--app-viewport-height")).toBe("");
  unmount();
});

it("leaves reader and immersive surfaces unscaled when disabled", () => {
  vi.stubGlobal("innerWidth", 5120);
  const { unmount } = renderHook(() => useOrdinaryPageScale(false));
  expect(document.documentElement.style.zoom).toBe("");
  unmount();
});
