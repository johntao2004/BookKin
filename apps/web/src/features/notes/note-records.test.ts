import { describe, expect, it } from "vitest";
import { collectNotes, notesExport, noteSourceHref } from "./note-records";

describe("private note presentation and exports", () => {
  it("keeps identical IDs in different stores independent and excludes bookmarks/blank entries", () => {
    const notes = collectNotes([
      { id: "same", bookId: "book-1", bookTitle: "书籍", type: "NOTE", quote: "书籍摘录", note: "书籍想法", style: "HIGHLIGHT", locator: "epubcfi(/6/2!/4)", createdAt: "2026-10-22" },
      { id: "bookmark", bookId: "book-1", type: "BOOKMARK", quote: "书签", style: "HIGHLIGHT", createdAt: "2026-10-22" },
    ], [{ articleId: "article-1", title: "文章", author: "作者", annotations: [
      { id: "same", type: "NOTE", quote: "文章摘录", note: "文章想法", locator: "p-2&offset=3", createdAt: "2026-10-22" },
      { id: "empty", type: "NOTE", quote: " ", note: "", locator: "p-1", createdAt: "2026-10-22" },
    ] }]);
    expect(notes).toHaveLength(2);
    expect(notes.map(note => `${note.kind}:${note.id}`)).toEqual(["BOOK:same", "ARTICLE:same"]);
    expect(noteSourceHref(notes[0])).toBe("/reader/book-1?locator=epubcfi(%2F6%2F2!%2F4)");
    expect(noteSourceHref(notes[1])).toBe("/articles/article-1?locator=p-2%26offset%3D3");
  });
  it("exports complete multiline Unicode notes and escapes spreadsheet formulas, quotes and commas", () => {
    const text = '长篇笔记，包含"引号"\n下一行'.repeat(1500);
    const notes = collectNotes([{ id: "long", bookId: "b", bookTitle: "=HYPERLINK()", type: "NOTE", quote: "原文\n第二行", note: text, style: "HIGHLIGHT", createdAt: "2026-10-22" }], []);
    expect(notesExport(notes, "md")).toContain(text);
    expect(notesExport(notes, "md")).toContain("> 原文\n> 第二行");
    const csv = notesExport(notes, "csv");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK()"');
    expect(csv).toContain(text.replaceAll('"', '""'));
  });
});
