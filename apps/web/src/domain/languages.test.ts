import { formatLanguages, languageOption, parseLanguages, serializeLanguages } from "./languages";

describe("language metadata", () => {
  it("normalizes BCP 47 and ISO aliases to one canonical language", () => {
    expect(parseLanguages("zh-CN / en-US；eng、zho, en")).toEqual(["zh", "en"]);
    expect(parseLanguages("he, iw, heb")).toEqual(["he"]);
    expect(parseLanguages("中文, English, French")).toEqual(["zh", "en", "fr"]);
    expect(parseLanguages("古希腊语, grc")).toEqual(["grc"]);
  });

  it("formats Chinese names while hiding unknown legacy values", () => {
    expect(formatLanguages("zh-CN,en-US,eng,zho")).toBe("中文、英文");
    expect(parseLanguages("x-legacy, zzy")).toEqual(["x-legacy", "zzy"]);
    expect(formatLanguages("x-legacy, zzy")).toBe("未识别语言、未识别语言");
    expect(formatLanguages("ang")).toBe("古英语");
  });

  it("keeps shared custom language labels while leaving unknown code-like values generic", () => {
    expect(languageOption("客家语").label).toBe("客家语");
    expect(formatLanguages("词库新增方言")).toBe("词库新增方言");
    expect(languageOption("x-hakka", "客家语").label).toBe("客家语");
    expect(languageOption("qzx").label).toBe("未识别语言");
  });

  it("serializes all selected values and rejects overflow instead of truncating", () => {
    expect(serializeLanguages(["zh-CN", "eng", "zho"])).toBe("zh,en");
    expect(serializeLanguages(["x".repeat(1024)])).toHaveLength(1024);
    expect(() => serializeLanguages(["x".repeat(1025)])).toThrow(RangeError);
  });
});
