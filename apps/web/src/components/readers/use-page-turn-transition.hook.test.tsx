import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePageTurnTransition } from "./use-page-turn-transition";

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
});
