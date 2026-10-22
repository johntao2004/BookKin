// 文章阅读笔记使用独立只读接口，避免与普通书籍或受限书库批注混用。
// Article reading notes use their own read-only endpoint, separate from book and vault annotations.
import { api, request } from "../../api/client";
import type { Annotation } from "../../domain/types";
import type { Entry } from "../content/api";

export interface ArticleNoteGroup {
  articleId: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  annotations: Entry[];
}

export const articleNotesApi = {
  list: () => request<ArticleNoteGroup[]>("/articles/notes"),
};

/** The unscoped annotations API caps at 500. Read paged source IDs, then full private per-book notes. */
export async function listCompleteBookNotes(): Promise<Annotation[]> {
  const result: Annotation[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.listAnnotationBooks({ cursor, limit: 36 });
    for (let offset = 0; offset < page.items.length; offset += 4) {
      const batch = await Promise.all(page.items.slice(offset, offset + 4).map(book => api.listAnnotations(book.bookId)));
      result.push(...batch.flat());
    }
    cursor = page.nextCursor;
  } while (cursor);
  return result;
}
