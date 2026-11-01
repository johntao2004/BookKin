import type { Annotation } from "../../domain/types";
import { groupAnnotations } from "../../domain/annotation-groups";
import type { ArticleNoteGroup } from "./api";
import type { PostKind } from "./posts-api";

export interface NoteRecord {
  id: string; kind: PostKind; sourceId: string; sourceTitle: string; author: string;
  quote: string; note: string; locator: string; createdAt: string; updatedAt: string;
  style?: string; color?: string;
}
export function collectNotes(books: Annotation[], articles: ArticleNoteGroup[]): NoteRecord[] {
  return [
    ...groupBookAnnotations(books).flatMap(({ annotations, groups }) => groups.flatMap(group => {
      const annotation = group.annotation;
      if (annotation.type === "BOOKMARK" || !(annotation.quote?.trim() || group.notes.some(note => note.trim()))) return [];
      const dates = groupDates(group.ids, annotations, annotation.createdAt);
      return [{
        id: annotation.id, kind: "BOOK" as const, sourceId: annotation.bookId, sourceTitle: annotation.bookTitle || "书籍", author: annotation.bookAuthor || "",
        quote: annotation.quote || "", note: group.notes.join("\n\n"), locator: annotation.locator || "", style: annotation.style, color: annotation.color,
        ...dates,
      }];
    })),
    ...articles.flatMap(article => {
      const annotations = article.annotations.filter(item => item.type !== "BOOKMARK");
      const byId = new Map(annotations.map(item => [item.id, item]));
      return groupAnnotations(annotations).flatMap(group => {
        const annotation = group.annotation;
        if (!(annotation.quote?.trim() || group.notes.some(note => note.trim()))) return [];
        const dates = groupDates(group.ids, byId, annotation.createdAt);
        return [{
          id: annotation.id, kind: "ARTICLE" as const, sourceId: article.articleId, sourceTitle: article.title, author: article.author,
          quote: annotation.quote || "", note: group.notes.join("\n\n"), locator: annotation.locator || "", style: annotation.style, color: annotation.color,
          ...dates,
        }];
      });
    }),
  ];
}

function groupBookAnnotations(books: Annotation[]) {
  const byBook = new Map<string, Annotation[]>();
  for (const annotation of books) {
    const items = byBook.get(annotation.bookId) ?? [];
    items.push(annotation);
    byBook.set(annotation.bookId, items);
  }
  return [...byBook.values()].map(annotations => ({
    annotations: new Map(annotations.map(annotation => [annotation.id, annotation])),
    groups: groupAnnotations(annotations.filter(annotation => annotation.type !== "BOOKMARK")),
  }));
}

function groupDates<T extends { id: string; createdAt: string; updatedAt?: string }>(ids: string[], annotations: Map<string, T>, fallback: string) {
  const members = ids.map(id => annotations.get(id)).filter((item): item is T => Boolean(item));
  return {
    createdAt: members.reduce((earliest, item) => item.createdAt < earliest ? item.createdAt : earliest, fallback),
    updatedAt: members.reduce((latest, item) => {
      const updatedAt = item.updatedAt || item.createdAt;
      return updatedAt > latest ? updatedAt : latest;
    }, fallback),
  };
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
