import { describe, expect, it } from "vitest";
import {
  pageCurlTextureLayout,
  pageTextureFacingOpacity,
  pageTextureMotionOpacity,
} from "./page-turn-curl";

describe("pageCurlTextureLayout", () => {
  it("turns the right page onto the left side for the next spread", () => {
    expect(pageCurlTextureLayout("NEXT", true)).toEqual({
      turning: { start: 0.5, width: 0.5 },
      back: { start: 0, width: 0.5 },
      static: { start: 0, width: 0.5 },
    });
  });

  it("turns the left page onto the right side for the previous spread", () => {
    expect(pageCurlTextureLayout("PREVIOUS", true)).toEqual({
      turning: { start: 0, width: 0.5 },
      back: { start: 0.5, width: 0.5 },
      static: { start: 0.5, width: 0.5 },
    });
  });

  it("uses the complete snapshot for a single-page viewport", () => {
    expect(pageCurlTextureLayout("NEXT", false)).toEqual({
      turning: { start: 0, width: 1 },
      back: { start: 0, width: 1 },
    });
  });
});

describe("pageTextureFacingOpacity", () => {
  it("hides compressed glyphs near the paper edge while keeping flat text opaque", () => {
    expect(pageTextureFacingOpacity(0)).toBe(0);
    expect(pageTextureFacingOpacity(0.12)).toBe(0);
    expect(pageTextureFacingOpacity(0.3)).toBeCloseTo(0.5, 5);
    expect(pageTextureFacingOpacity(0.48)).toBe(1);
    expect(pageTextureFacingOpacity(1)).toBe(1);
    expect(pageTextureFacingOpacity(-1)).toBe(1);
  });
});

describe("pageTextureMotionOpacity", () => {
  it("softens moving ink most at mid-turn and restores it on both flat pages", () => {
    expect(pageTextureMotionOpacity(0)).toBe(1);
    expect(pageTextureMotionOpacity(0.5)).toBe(0.12);
    expect(pageTextureMotionOpacity(1)).toBe(1);
    expect(pageTextureMotionOpacity(0.25)).toBeCloseTo(pageTextureMotionOpacity(0.75), 8);
    expect(pageTextureMotionOpacity(0.25)).toBeGreaterThan(0.12);
    expect(pageTextureMotionOpacity(0.25)).toBeLessThan(1);
  });
});
