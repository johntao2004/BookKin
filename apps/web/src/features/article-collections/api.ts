// 文章合集只保存文章引用与顺序，不复制文章正文。
// Article collections store references and ordering without copying article bodies.
import { request } from "../../api/client";
import type { ArticleSummary } from "../content/api";

export type ArticleCollectionVisibility = "PRIVATE" | "MEMBERS";

export interface ArticleCollectionSummary {
  id: string;
  title: string;
  description: string;
  visibility: ArticleCollectionVisibility;
  ownerDisplayName: string;
  ownedByViewer: boolean;
  editable: boolean;
  articleCount: number;
  previewArticles: ArticleSummary[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleCollectionDetail extends ArticleCollectionSummary {
  articles: ArticleSummary[];
}

export interface ArticleCollectionDraft {
  title: string;
  description: string;
  visibility: ArticleCollectionVisibility;
}

const basePath = "/article-collections";
const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const articleCollections = {
  list: (options: { q?: string; signal?: AbortSignal } = {}) => {
    const params = new URLSearchParams();
    if (options.q?.trim()) params.set("q", options.q.trim());
    const suffix = params.size ? `?${params.toString()}` : "";
    return request<{ items: ArticleCollectionSummary[] }>(`${basePath}${suffix}`, { signal: options.signal });
  },
  get: (id: string) => request<ArticleCollectionDetail>(`${basePath}/${encodeURIComponent(id)}`),
  create: (draft: ArticleCollectionDraft) => request<ArticleCollectionDetail>(basePath, json(draft)),
  update: (id: string, draft: ArticleCollectionDraft, revision: number) => request<ArticleCollectionDetail>(
    `${basePath}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ ...draft, revision }) },
  ),
  remove: (id: string, revision: number) => request<void>(`${basePath}/${encodeURIComponent(id)}?revision=${revision}`, { method: "DELETE" }),
  addArticles: (id: string, articleIds: string[], revision: number) => request<ArticleCollectionDetail>(
    `${basePath}/${encodeURIComponent(id)}/articles`, { method: "POST", body: JSON.stringify({ articleIds, revision }) },
  ),
  removeArticle: (id: string, articleId: string, revision: number) => request<ArticleCollectionDetail>(
    `${basePath}/${encodeURIComponent(id)}/articles/${encodeURIComponent(articleId)}?revision=${revision}`, { method: "DELETE" },
  ),
  reorder: (id: string, articleIds: string[], revision: number) => request<ArticleCollectionDetail>(
    `${basePath}/${encodeURIComponent(id)}/order`, { method: "PUT", body: JSON.stringify({ articleIds, revision }) },
  ),
};

export function isArticleCollectionRevisionConflict(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const error = reason as { status?: number; code?: string };
  return error.code === "REVISION_CONFLICT" || error.code === "COLLECTION_ORDER_CHANGED" || error.code === "CONFLICT" || (!error.code && error.status === 409);
}

export function articleCollectionError(reason: unknown, fallback = "操作失败，请重试。") {
  return reason instanceof Error ? reason.message : fallback;
}

