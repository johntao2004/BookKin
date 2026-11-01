import { describe, expect, it } from "vitest";
import { groupAnnotations, sameAnnotationSelection, upsertArticleAnnotation } from "./annotation-groups";

function annotation(
  id: string,
  type: "HIGHLIGHT" | "NOTE" | "BOOKMARK" = "HIGHLIGHT",
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    type,
    quote: "同一段文字",
    locator: "epubcfi(/6/2!/4/2)",
    note: "",
    createdAt: "2026-10-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("groupAnnotations", () => {
  it("groups only matching located passages and exposes distinct notes and IDs", () => {
    const items = [
      annotation("highlight", "HIGHLIGHT", { quote: "  原文  ", note: "第一条" }),
      annotation("note-old", "NOTE", { quote: "原文", note: "第一条", createdAt: "2026-10-21T00:00:00.000Z" }),
      annotation("note-new", "NOTE", { quote: "原文", note: "第二条", createdAt: "2026-10-22T00:00:00.000Z" }),
      annotation("different-locator", "NOTE", { quote: "原文", locator: "epubcfi(/6/2!/4/4)", note: "另一处" }),
      annotation("different-quote", "NOTE", { quote: "相同？不", note: "不同原文" }),
    ];

    expect(groupAnnotations(items)).toEqual([
      { annotation: items[2], ids: ["highlight", "note-old", "note-new"], notes: ["第一条", "第二条"] },
      { annotation: items[3], ids: ["different-locator"], notes: ["另一处"] },
      { annotation: items[4], ids: ["different-quote"], notes: ["不同原文"] },
    ]);
  });

  it("keeps bookmarks, missing locators, and empty quotes separate", () => {
    const items = [
      annotation("one", "HIGHLIGHT", { locator: "" }),
      annotation("two", "NOTE", { locator: "" }),
      annotation("three", "HIGHLIGHT", { locator: "   " }),
      annotation("four", "NOTE", { quote: "  " }),
      annotation("bookmark-a", "BOOKMARK"),
      annotation("bookmark-b", "BOOKMARK"),
    ];

    expect(groupAnnotations(items).map((group) => group.ids)).toEqual([
      ["one"], ["two"], ["three"], ["four"], ["bookmark-a"], ["bookmark-b"],
    ]);
  });

  it("keeps book IDs in the grouping key and preserves first-seen order", () => {
    const items = [
      annotation("first", "HIGHLIGHT", { bookId: "book-a" }),
      annotation("second", "NOTE", { bookId: "book-b", note: "另一内容" }),
      annotation("third", "NOTE", { bookId: "book-a", note: "补充" }),
      annotation("fourth", "HIGHLIGHT", { note: "同内容" }),
      annotation("fifth", "NOTE", { note: "无 bookId" }),
    ];

    expect(groupAnnotations(items).map((group) => group.ids)).toEqual([
      ["first", "third"], ["second"], ["fourth", "fifth"],
    ]);
  });

  it("prefers NOTE records, then the most recently updated record of that type", () => {
    const items = [
      annotation("highlight", "HIGHLIGHT", { createdAt: "2026-10-24T00:00:00.000Z" }),
      annotation("note-old", "NOTE", { createdAt: "2026-10-20T00:00:00.000Z" }),
      annotation("note-updated", "NOTE", { createdAt: "2026-10-19T00:00:00.000Z", updatedAt: "2026-10-25T00:00:00.000Z" }),
    ];

    expect(groupAnnotations(items)[0].annotation.id).toBe("note-updated");
  });

  it("groups EPUB ranges by common path and start while ignoring end-offset drift", () => {
    const quote = "书页上的同一句话";
    const items = [
      annotation("highlight", "HIGHLIGHT", {
        quote,
        locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/1:0,/38/2/1:1)",
      }),
      annotation("note", "NOTE", {
        quote,
        locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/1:0,/38/2/1:2)",
        note: "这是同一选区的笔记",
      }),
      annotation("different-start", "NOTE", {
        quote,
        locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/2:0,/38/2/1:2)",
        note: "相同句子的另一处",
      }),
    ];

    expect(groupAnnotations(items).map((group) => group.ids)).toEqual([
      ["highlight", "note"], ["different-start"],
    ]);
  });

  it("parses EPUB range delimiters outside assertions and escaped commas", () => {
    const items = [
      annotation("first", "HIGHLIGHT", {
        quote: "包含断言逗号",
        locator: "epubcfi(/6/2[chapter^,one]!/4/2,/2/2/1:0,/38/2/1:1)",
      }),
      annotation("second", "NOTE", {
        quote: "包含断言逗号",
        locator: "epubcfi(/6/2[chapter^,one]!/4/2,/2/2/1:0,/38/2/1:2)",
        note: "仍是同组选区",
      }),
    ];

    expect(groupAnnotations(items)[0].ids).toEqual(["first", "second"]);
  });

  it("exposes the same selection identity contract for reader prefill", () => {
    const highlight = annotation("highlight", "HIGHLIGHT", {
      quote: "原文",
      locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/1:0,/38/2/1:1)",
      bookId: "article-one",
    });
    const noteSelection = {
      quote: " 原文 ",
      locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/1:0,/38/2/1:2)",
      bookId: "article-one",
    };

    expect(sameAnnotationSelection(highlight, noteSelection)).toBe(true);
    expect(sameAnnotationSelection(highlight, { ...noteSelection, bookId: "article-two" })).toBe(false);
    expect(sameAnnotationSelection(highlight, { ...noteSelection, locator: " " })).toBe(false);
  });
});

describe("upsertArticleAnnotation", () => {
  it("upgrades an existing highlight in place when creating its first note", () => {
    const highlight = annotation("existing", "HIGHLIGHT", { note: "", style: "UNDERLINE" });
    const incoming = annotation("new", "NOTE", { note: "新笔记", style: "BOLD" });
    const result = upsertArticleAnnotation([highlight], incoming);

    expect(result.annotation).toMatchObject({ id: "existing", type: "NOTE", note: "新笔记", style: "BOLD" });
    expect(result.annotations).toHaveLength(1);
    expect(result.groupIds).toEqual(["existing"]);
  });

  it("keeps an existing note and its type when another highlight is applied", () => {
    const note = annotation("saved-note", "NOTE", { note: "不能丢", style: "HIGHLIGHT" });
    const incoming = annotation("new-highlight", "HIGHLIGHT", { note: "", color: "TEAL" });
    const result = upsertArticleAnnotation([note], incoming);

    expect(result.annotation).toMatchObject({ id: "saved-note", type: "NOTE", note: "不能丢", color: "TEAL" });
    expect(result.annotations).toHaveLength(1);
    expect(result.groupIds).toEqual(["saved-note"]);
  });

  it("updates one representative and cleans a historical group after its note is edited", () => {
    const items = [
      annotation("highlight-with-text", "HIGHLIGHT", { note: "既有高亮备注" }),
      annotation("note-old", "NOTE", { note: "第一条", createdAt: "2026-10-21T00:00:00.000Z" }),
      annotation("note-new", "NOTE", { note: "第二条", createdAt: "2026-10-22T00:00:00.000Z" }),
    ];
    const incoming = annotation("new-note", "NOTE", { note: "既有高亮备注\n\n第一条\n\n第二条\n\n编辑后的文字" });
    const result = upsertArticleAnnotation(items, incoming);

    expect(result.annotations).toHaveLength(1);
    expect(result.annotation).toMatchObject({
      id: "note-new",
      type: "NOTE",
      note: "既有高亮备注\n\n第一条\n\n第二条\n\n编辑后的文字",
    });
    expect(result.affectedIds).toEqual(["highlight-with-text", "note-old", "note-new"]);
    expect(result.groupIds).toEqual(["highlight-with-text", "note-old", "note-new"]);
  });

  it("uses EPUB range equivalence when upserting annotation types", () => {
    const highlight = annotation("existing", "HIGHLIGHT", {
      quote: "原文",
      locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/1:0,/38/2/1:1)",
    });
    const note = annotation("new", "NOTE", {
      quote: " 原文 ",
      locator: "epubcfi(/6/2!/4/2/6[p-2],/2/2/1:0,/38/2/1:2)",
      note: "对应的笔记",
    });

    const result = upsertArticleAnnotation([highlight], note);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotation).toMatchObject({ id: "existing", type: "NOTE", note: "对应的笔记" });
  });

  it("does not merge matching quotes at different locators or merge bookmarks", () => {
    const existing = annotation("existing", "HIGHLIGHT");
    const elsewhere = annotation("new", "NOTE", { locator: "epubcfi(/6/2!/4/4)", note: "另处" });
    const result = upsertArticleAnnotation([existing], elsewhere);
    const bookmark = annotation("bookmark", "BOOKMARK");

    expect(result.annotations).toHaveLength(2);
    expect(upsertArticleAnnotation(result.annotations, bookmark).annotations).toHaveLength(3);
  });
});
