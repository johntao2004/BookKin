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
  it("merges one selection into one list record while keeping every distinct note and each source separate", () => {
    const notes = collectNotes([
      { id: "highlight", bookId: "book-1", bookTitle: "书籍一", type: "HIGHLIGHT", quote: " 同一段原文 ", locator: "l1", style: "HIGHLIGHT", createdAt: "2026-10-22T09:00:00Z" },
      { id: "note-a", bookId: "book-1", bookTitle: "书籍一", type: "NOTE", quote: "同一段原文", note: "第一条想法", locator: "l1", style: "HIGHLIGHT", createdAt: "2026-10-22T10:00:00Z" },
      { id: "note-b", bookId: "book-1", bookTitle: "书籍一", type: "NOTE", quote: "同一段原文", note: "第二条想法", locator: "l1", style: "HIGHLIGHT", createdAt: "2026-10-22T11:00:00Z" },
      { id: "other-book", bookId: "book-2", bookTitle: "书籍二", type: "NOTE", quote: "同一段原文", note: "另一书的想法", locator: "l1", style: "HIGHLIGHT", createdAt: "2026-10-22T12:00:00Z" },
      { id: "no-locator", bookId: "book-1", bookTitle: "书籍一", type: "NOTE", quote: "同一段原文", note: "没有位置不合并", style: "HIGHLIGHT", createdAt: "2026-10-22T13:00:00Z" },
    ], [
      { articleId: "article-1", title: "文章一", author: "作者", annotations: [
        { id: "article-highlight", type: "HIGHLIGHT", quote: "同一段原文", note: "", locator: "p-1", createdAt: "2026-10-22T09:00:00Z" },
        { id: "article-note", type: "NOTE", quote: "同一段原文", note: "文章想法甲", locator: "p-1", createdAt: "2026-10-22T10:00:00Z" },
        { id: "article-note-2", type: "NOTE", quote: "同一段原文", note: "文章想法乙", locator: "p-1", createdAt: "2026-10-22T11:00:00Z" },
      ] },
      { articleId: "article-2", title: "文章二", author: "作者", annotations: [
        { id: "other-article", type: "NOTE", quote: "同一段原文", note: "另一文章的想法", locator: "p-1", createdAt: "2026-10-22T12:00:00Z" },
      ] },
    ]);

    const bookSelection = notes.find(note => note.id === "note-b");
    expect(notes).toHaveLength(5);
    expect(bookSelection).toMatchObject({ quote: "同一段原文", note: "第一条想法\n\n第二条想法", locator: "l1", updatedAt: "2026-10-22T11:00:00Z" });
    expect(notes.filter(note => note.kind === "BOOK" && note.sourceId === "book-1" && note.locator === "l1")).toHaveLength(1);
    expect(notes.filter(note => note.kind === "ARTICLE" && note.locator === "p-1")).toHaveLength(2);
    expect(noteSourceHref(bookSelection!)).toBe("/reader/book-1?locator=l1");
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
