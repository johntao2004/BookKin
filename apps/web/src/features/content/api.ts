// 文章阅读状态按最后提交生效；revision 保留兼容旧客户端，不再作为并发写入锁。
// Article reading state is last-write-wins; revision is retained for wire compatibility, not conflict detection.
import { request } from "../../api/client";
import type { AnnotationColor, AnnotationStyle } from "../../domain/types";
export interface ArticleSummary {
  id: string;
  title: string;
  author: string;
  source_url: string;
  published_at: string;
  visibility: "PUBLIC" | "PRIVATE";
  tags: string;
  cover_url?: string | null;
  excerpt?: string;
  created_at: string;
  updated_at: string;
}
export interface Article extends ArticleSummary {
  html: string;
}
export interface Draft {
  title: string;
  author: string;
  sourceUrl: string;
  publishedAt: string;
  visibility: "PUBLIC" | "PRIVATE";
  tags: string;
  html: string;
  coverUrl?: string;
}
export interface ReadingState {
  locator: string;
  progress: number;
  seconds: number;
  annotations: Entry[];
}
export interface Entry {
  id: string;
  type: "NOTE" | "HIGHLIGHT" | "BOOKMARK";
  quote: string;
  note: string;
  locator: string;
  createdAt: string;
  style?: AnnotationStyle;
  color?: AnnotationColor;
}
export const emptyReading = (): ReadingState => ({
  locator: "",
  progress: 0,
  seconds: 0,
  annotations: [],
});
export const articles = {
  list: () => request<ArticleSummary[]>("/articles"),
  get: (id: string) => request<Article>(`/articles/${id}`),
  fetch: (url: string) =>
    request<Draft>("/articles/fetch", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  prepare: (html: string, sourceUrl: string) =>
    request<{ html: string }>("/articles/prepare", {
      method: "POST",
      body: JSON.stringify({ html, sourceUrl }),
    }),
  save: (draft: Draft, id?: string) =>
    request<Article>(`/articles${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(draft),
    }),
  remove: (id: string) =>
    request<void>(`/articles/${id}`, { method: "DELETE" }),
  reading: (id: string) =>
    request<{ state: string; revision: number }>(`/articles/${id}/reading`),
  saveReading: (id: string, state: ReadingState, revision: number) =>
    request<void>(`/articles/${id}/reading`, {
      method: "PUT",
      body: JSON.stringify({ state: JSON.stringify(state), revision }),
    }),
  generate: (id: string) =>
    request<void>(`/articles/${id}/knowledge`, { method: "POST" }),
  knowledge: () =>
    request<{ id: string; title: string; points: string }[]>(
      "/articles/knowledge",
    ),
};
