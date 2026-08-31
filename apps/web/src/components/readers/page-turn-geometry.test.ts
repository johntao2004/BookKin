import { describe, expect, it } from "vitest";
import { pageCurlPath, pageCurlPointForColumn } from "./page-turn-geometry";

describe("pageCurlPath", () => {
  it("starts flat from the spine and finishes flat on the opposite side", () => {
    const start = pageCurlPath({ progress: 0, direction: "NEXT", width: 2, segments: 4 });
    const end = pageCurlPath({ progress: 1, direction: "NEXT", width: 2, segments: 4 });

    expect(start.map((point) => point.x)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(start.every((point) => Math.abs(point.z) < 1e-10)).toBe(true);
    expect(end.map((point) => point.x)).toEqual([-1, -1.5, -2, -2.5, -3]);
    expect(end.every((point) => Math.abs(point.z) < 1e-10)).toBe(true);
  });

  it("forms a continuous lifted curve instead of a rigid hinge at mid-turn", () => {
    const middle = pageCurlPath({ progress: 0.5, direction: "NEXT", width: 2, segments: 8 });
    const segmentWidths = middle.slice(1).map((point, index) => point.x - middle[index].x);
    const segmentLengths = middle.slice(1).map((point, index) => Math.hypot(
      point.x - middle[index].x,
      point.z - middle[index].z,
    ));

    expect(Math.max(...middle.map((point) => point.z))).toBeGreaterThan(0.35);
    expect(new Set(segmentWidths.map((value) => value.toFixed(4))).size).toBeGreaterThan(3);
    segmentLengths.forEach((length) => expect(length).toBeCloseTo(0.25, 8));
  });

  it("keeps most text-bearing paper flat while a localized fold crosses the page", () => {
    const middle = pageCurlPath({ progress: 0.5, direction: "NEXT", width: 2, segments: 16 });
    const segmentWidths = middle.slice(1).map((point, index) => point.x - middle[index].x);
    const edgeOnSegments = segmentWidths.filter((width) => Math.abs(width) < 0.08);

    expect(segmentWidths.slice(0, 4).every((width) => width > 0.1)).toBe(true);
    expect(segmentWidths.slice(-4).every((width) => width < -0.1)).toBe(true);
    expect(edgeOnSegments.length).toBeLessThan(4);
  });

  it("lets the lower corner lead the page body without tearing the sheet", () => {
    const upper = pageCurlPath({ progress: 0.5, direction: "NEXT", width: 2, segments: 16, rowPosition: 1 });
    const middle = pageCurlPath({ progress: 0.5, direction: "NEXT", width: 2, segments: 16, rowPosition: 0.5 });
    const lower = pageCurlPath({ progress: 0.5, direction: "NEXT", width: 2, segments: 16, rowPosition: 0 });

    expect(lower.at(-1)?.x).toBeLessThan(middle.at(-1)?.x ?? 0);
    expect(middle.at(-1)?.x).toBeLessThan(upper.at(-1)?.x ?? 0);
  });

  it("mirrors the geometry for previous-page turns", () => {
    const next = pageCurlPath({ progress: 0.42, direction: "NEXT", width: 2, segments: 8, rowPosition: 0.2 });
    const previous = pageCurlPath({ progress: 0.42, direction: "PREVIOUS", width: 2, segments: 8, rowPosition: 0.2 });

    previous.forEach((point, index) => {
      expect(point.x).toBeCloseTo(-next[index].x, 8);
      expect(point.z).toBeCloseTo(next[index].z, 8);
    });
  });

  it("keeps the previous-page texture upright before folding it to the right", () => {
    const start = pageCurlPath({ progress: 0, direction: "PREVIOUS", width: 2, segments: 4 });
    const end = pageCurlPath({ progress: 1, direction: "PREVIOUS", width: 2, segments: 4 });

    expect(start.map((_, column) => pageCurlPointForColumn(start, column, "PREVIOUS").x))
      .toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(end.map((_, column) => pageCurlPointForColumn(end, column, "PREVIOUS").x))
      .toEqual([3, 2.5, 2, 1.5, 1]);
  });
});
