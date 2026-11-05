// 验证减少动态效果、关闭开关和非移动视口时立即翻页，不启动动画。
// Checks reduced motion, disabled effects and non-mobile viewports turn pages immediately without animation.
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PAGE_TURN_MOBILE_QUERY, usePageTurnTransition } from "./use-page-turn-transition";

describe("usePageTurnTransition", () => {
  afterEach(() => vi.restoreAllMocks());

  it("changes pages immediately when reduced motion is requested", async () => {
    const target = document.createElement("div");
    const animate = vi.fn();
    Object.defineProperty(target, "animate", { configurable: true, value: animate });
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const changePage = vi.fn();
    const { result } = renderHook(() => usePageTurnTransition({ current: target }));

    await act(async () => {
      await result.current.turnPage("NEXT", changePage);
    });

    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(changePage).toHaveBeenCalledOnce();
    expect(animate).not.toHaveBeenCalled();
    expect(result.current.turning).toBe(false);
  });

  it("changes pages immediately when page-turn effects are disabled", async () => {
    const target = document.createElement("div");
    const animate = vi.fn();
    Object.defineProperty(target, "animate", { configurable: true, value: animate });
    const changePage = vi.fn();
    const { result } = renderHook(() => usePageTurnTransition({ current: target }, false));

    await act(async () => {
      await result.current.turnPage("NEXT", changePage);
    });

    expect(changePage).toHaveBeenCalledOnce();
    expect(animate).not.toHaveBeenCalled();
    expect(result.current.turning).toBe(false);
  });

  it("changes pages immediately outside the mobile viewport", async () => {
    const target = document.createElement("div");
    const animate = vi.fn();
    Object.defineProperty(target, "animate", { configurable: true, value: animate });
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
    const changePage = vi.fn();
    const { result } = renderHook(() => usePageTurnTransition({ current: target }));

    await act(async () => {
      await result.current.turnPage("NEXT", changePage);
    });

    expect(window.matchMedia).toHaveBeenCalledWith(PAGE_TURN_MOBILE_QUERY);
    expect(changePage).toHaveBeenCalledOnce();
    expect(animate).not.toHaveBeenCalled();
    expect(result.current.turning).toBe(false);
  });

  it("uses the animated fallback without cloning a large reflowed page", async () => {
    const target = document.createElement("div");
    const animations: Array<{ cancel: ReturnType<typeof vi.fn> }> = [];
    Object.defineProperty(target, "animate", {
      configurable: true,
      value: vi.fn(() => {
        const animation = { finished: Promise.resolve(), cancel: vi.fn() };
        animations.push(animation);
        return animation;
      }),
    });
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === PAGE_TURN_MOBILE_QUERY,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    const changePage = vi.fn();
    const { result } = renderHook(() => usePageTurnTransition(
      { current: target },
      true,
      { snapshot: false },
    ));

    await act(async () => {
      await result.current.turnPage("NEXT", changePage);
    });

    expect(changePage).toHaveBeenCalledOnce();
    expect(target.animate).toHaveBeenCalledTimes(2);
    expect(animations.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true);
    expect(result.current.turning).toBe(false);
  });
});
