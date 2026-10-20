// 验证字体失效回退、延迟加载与翻页开关持久化，避免未完成字体查询就丢失用户选择。
// Checks disabled-font fallback, delayed font loading and persisted page-turn choice without dropping a selection prematurely.
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
