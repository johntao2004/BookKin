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

  it("uses the shared Source Han Sans preset for all built-in reading", () => {
    expect(PRESET_READER_FONTS).toHaveLength(1);
    expect(PRESET_READER_FONTS[0]).toMatchObject({ id: "source-han-sans-sc", familyName: "Source Han Sans SC", kind: "SANS" });
    expect(readerFontFamily(PRESET_READER_FONTS[0])).toContain("Source Han Sans SC");
  });

  it.each(["noto-serif-sc", "source-han-serif-sc", "noto-sans-sc", "alibaba-puhuiti"])("migrates the legacy built-in font %s", (fontId) => {
    localStorage.setItem("reader", JSON.stringify({ ...DEFAULT_READER_SETTINGS, fontId }));
    expect(readReaderSettings("reader", PRESET_READER_FONTS).fontId).toBe("source-han-sans-sc");
  });

  it("preserves an uploaded serif font and falls back to the shared Sans family", () => {
    const family = readerFontFamily({ familyName: "My Custom Serif", kind: "SERIF", source: "CUSTOM" });
    expect(family).toBe('"My Custom Serif", Source Han Sans SC, sans-serif');
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
