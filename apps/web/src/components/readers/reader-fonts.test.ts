import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULT_READER_SETTINGS, PRESET_READER_FONTS, readReaderSettings, readerFontFamily } from "./reader-fonts";

describe("reader settings", () => {
  beforeEach(() => localStorage.clear());

  it("falls back when a stored font is no longer enabled", () => {
    localStorage.setItem("reader", JSON.stringify({ fontId: "stale-font", fontSize: 26, theme: "NIGHT" }));
    expect(readReaderSettings("reader", PRESET_READER_FONTS)).toEqual({ ...DEFAULT_READER_SETTINGS, fontSize: 26, theme: "NIGHT" });
  });

  it("keeps serif and sans families distinguishable", () => {
    expect(readerFontFamily(PRESET_READER_FONTS[0])).toContain("Noto Serif SC");
    expect(readerFontFamily(PRESET_READER_FONTS[1])).toContain("Noto Sans SC");
  });

  it("keeps a custom font id until the enabled font list is loaded", () => {
    localStorage.setItem("reader", JSON.stringify({ fontId: "custom-family", fontSize: 20, theme: "PAPER" }));
    expect(readReaderSettings("reader").fontId).toBe("custom-family");
  });

  it("persists an explicit choice to disable page-turn effects", () => {
    localStorage.setItem("reader", JSON.stringify({
      ...DEFAULT_READER_SETTINGS,
      pageTurnEnabled: false,
    }));

    expect(readReaderSettings("reader").pageTurnEnabled).toBe(false);
  });
});
