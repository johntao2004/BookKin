import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIndependentReading } from "./useIndependentReading";
import type { ReadingState } from "./api";

const initial: ReadingState = { locator: "p-1", progress: 0, seconds: 0, annotations: [] };
afterEach(cleanup);

describe("independent reading saves", () => {
  it("clears a previous save warning after a successful retry", async () => {
    const save = vi.fn<(_: ReadingState) => Promise<void>>()
      .mockRejectedValueOnce(new Error("另一页面已更新阅读记录"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useIndependentReading(initial, save));
    act(() => result.current.change((state) => ({ ...state, locator: "p-2", progress: 0.2 })));
    await act(async () => { await expect(result.current.flush()).rejects.toThrow("另一页面"); });
    expect(result.current.error).toContain("另一页面");
    await act(async () => { await result.current.flush(); });
    expect(result.current.error).toBe("");
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ locator: "p-2", progress: 0.2 }));
    await act(async () => { await result.current.flush(); });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("serializes a tab's saves and sends the newest position after an in-flight save", async () => {
    let finish!: () => void;
    const save = vi.fn<(_: ReadingState) => Promise<void>>()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useIndependentReading(initial, save));
    act(() => result.current.change((state) => ({ ...state, locator: "p-2" })));
    let first!: Promise<void>;
    act(() => { first = result.current.flush(); });
    act(() => result.current.change((state) => ({ ...state, locator: "p-3" })));
    let second!: Promise<void>;
    act(() => { second = result.current.flush(); });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await Promise.all([first, second]); });
    expect(save.mock.calls.map(([state]) => state.locator)).toEqual(["p-2", "p-3"]);
  });
});
