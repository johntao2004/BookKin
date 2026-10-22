import { describe, expect, it } from "vitest";
import { bookmarkIsVisible, bookmarkTocIndex, compareBookmarkLocators } from "./reader-bookmarks";

const toc = [
  { href: "article.xhtml#one", label: "第一点", depth: 0, locator: "epubcfi(/6/2!/4/2/2)" },
  { href: "article.xhtml#two", label: "第二点", depth: 0, locator: "epubcfi(/6/2!/4/2/10)" },
  { href: "next.xhtml", label: "下一章", depth: 0, locator: "epubcfi(/6/4!/4)" },
];

describe("private reader bookmark positions", () => {
  it("places marks after the correct heading inside the same article, using numeric CFI ordering", () => {
    expect(bookmarkTocIndex("epubcfi(/6/2!/4/2/4/1:20)", toc)).toBe(0);
    expect(bookmarkTocIndex("epubcfi(/6/2!/4/2/12/1:0)", toc)).toBe(1);
    expect(bookmarkTocIndex("epubcfi(/6/4!/4/2/1:0)", toc)).toBe(2);
    expect(bookmarkTocIndex("article.xhtml#two", toc)).toBe(1);
    expect(bookmarkTocIndex("unknown", toc)).toBe(-1);
  });

  it("recognizes a saved CFI anywhere on the visible page without matching another page", () => {
    expect(bookmarkIsVisible("epubcfi(/6/2!/4/2/4/1:20)", "epubcfi(/6/2!/4/2/4/1:0)", "epubcfi(/6/2!/4/2/8/1:0)")).toBe(true);
    expect(bookmarkIsVisible("epubcfi(/6/2!/4/2/12/1:0)", "epubcfi(/6/2!/4/2/4/1:0)", "epubcfi(/6/2!/4/2/8/1:0)")).toBe(false);
    expect(bookmarkIsVisible("epubcfi(/6/2!/4/2/4/1:20)", "")).toBe(false);
  });

  it("preserves PDF source pages and virtual offsets, including older page-only bookmarks", () => {
    expect(compareBookmarkLocators("pdf:page=2", "pdf:page=2&offset=0")).toBe(0);
    expect(bookmarkIsVisible("pdf:page=2&offset=1", "pdf:page=2&offset=0")).toBe(false);
    expect(bookmarkTocIndex("pdf:page=7&offset=3", [
      { href: "pdf:page=1", label: "第一章", depth: 0 },
      { href: "pdf:page=5", label: "第二章", depth: 0 },
    ])).toBe(1);
  });
});
