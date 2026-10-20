// 验证像素倍率有界且无效输入有安全回退，兼顾高清文字和画布内存上限。
// Checks bounded pixel ratio and invalid-input fallbacks for sharp text within canvas memory limits.
import { describe, expect, it } from "vitest";
import { pageTurnPixelRatio } from "./page-turn-rendering";

describe("pageTurnPixelRatio", () => {
  it("keeps Retina page text sharp without allowing unbounded canvas sizes", () => {
    expect(pageTurnPixelRatio(1)).toBe(1);
    expect(pageTurnPixelRatio(1.5)).toBe(1.5);
    expect(pageTurnPixelRatio(2)).toBe(2);
    expect(pageTurnPixelRatio(3)).toBe(2);
  });

  it("falls back to a safe scale for invalid values", () => {
    expect(pageTurnPixelRatio(Number.NaN)).toBe(1);
  });
});
