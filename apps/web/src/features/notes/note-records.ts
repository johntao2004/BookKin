import type { Annotation } from "../../domain/types";
import type { ArticleNoteGroup } from "./api";
import type { PostKind } from "./posts-api";

export interface NoteRecord {
  id: string; kind: PostKind; sourceId: string; sourceTitle: string; author: string;
  quote: string; note: string; locator: string; createdAt: string; updatedAt: string;
  style?: string; color?: string;
}
export function collectNotes(books: Annotation[], articles: ArticleNoteGroup[]): NoteRecord[] {
  return [
    ...books.filter(item => item.type !== "BOOKMARK" && (item.quote?.trim() || item.note?.trim())).map(item => ({
      id: item.id, kind: "BOOK" as const, sourceId: item.bookId, sourceTitle: item.bookTitle || "书籍", author: item.bookAuthor || "",
      quote: item.quote || "", note: item.note || "", locator: item.locator || "", style: item.style, color: item.color,
      createdAt: item.createdAt, updatedAt: item.updatedAt || item.createdAt,
    })),
    ...articles.flatMap(article => article.annotations.filter(item => item.type !== "BOOKMARK" && (item.quote?.trim() || item.note?.trim())).map(item => ({
      id: item.id, kind: "ARTICLE" as const, sourceId: article.articleId, sourceTitle: article.title, author: article.author,
      quote: item.quote, note: item.note, locator: item.locator, style: item.style, color: item.color,
      createdAt: item.createdAt, updatedAt: item.createdAt,
    }))),
  ];
}
export const noteSourceHref = (note: NoteRecord) => `${note.kind === "BOOK" ? "/reader" : "/articles"}/${encodeURIComponent(note.sourceId)}${note.locator ? `?locator=${encodeURIComponent(note.locator)}` : ""}`;
const csvCell = (value: string) => `"${(/^[\s]*[=+@-]/u.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
export function notesExport(notes: NoteRecord[], format: "md" | "csv") {
  if (format === "csv") return "\uFEFF" + [["来源类型", "来源", "作者", "摘录", "笔记", "记录时间", "原文位置"], ...notes.map(note => [note.kind === "BOOK" ? "书籍" : "文章", note.sourceTitle, note.author, note.quote, note.note, note.createdAt, noteSourceHref(note)])].map(row => row.map(csvCell).join(",")).join("\r\n");
  return "# 阅读笔记\n\n" + notes.map(note => `## ${note.sourceTitle}\n\n${note.kind === "BOOK" ? "书籍" : "文章"} · ${note.createdAt}\n\n${note.quote ? `> ${note.quote.replaceAll("\n", "\n> ")}\n\n` : ""}${note.note}\n\n[返回原文](${noteSourceHref(note)})`).join("\n\n---\n\n");
}
export function downloadNotes(notes: NoteRecord[], format: "md" | "csv") {
  const url = URL.createObjectURL(new Blob([notesExport(notes, format)], { type: format === "csv" ? "text/csv;charset=utf-8" : "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = `阅读笔记-${new Date().toISOString().slice(0, 10)}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
