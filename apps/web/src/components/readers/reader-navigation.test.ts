import { describe, expect, it } from "vitest";
import { isEditableReaderTarget, isReaderSwipe, READER_SWIPE_THRESHOLD } from "./reader-navigation";

describe("reader navigation", () => {
  it("recognizes horizontal gestures at the touch target threshold", () => {
    expect(isReaderSwipe(200, 200 - READER_SWIPE_THRESHOLD)).toBe(true);
    expect(isReaderSwipe(200, 200 - READER_SWIPE_THRESHOLD + 1)).toBe(false);
    expect(isReaderSwipe(null, 100)).toBe(false);
  });

  it("does not hijack editable controls", () => {
    const input = document.createElement("input");
    const article = document.createElement("article");
    expect(isEditableReaderTarget(input)).toBe(true);
    expect(isEditableReaderTarget(article)).toBe(false);
  });
});
