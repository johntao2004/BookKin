import { request } from "../../api/client";

export type PostKind = "BOOK" | "ARTICLE";
export type PostFilter = PostKind | "ALL";
export const postSections = { BOOK: "books", ARTICLE: "articles", ALL: "all" } as const;
export const postLabels = { BOOK: "书籍", ARTICLE: "文章", ALL: "读书笔记" } as const;
export interface ReadingPost {
  id: string;
  kind: PostKind;
  sourceId: string;
  sourceTitle: string;
  userId: string;
  authorName: string;
  title: string;
  markdown: string | null;
  excerpt: string;
  visibility: "PRIVATE" | "LIBRARY";
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface PostDraft {
  kind: PostKind;
  sourceId: string;
  title: string;
  markdown: string;
  visibility: ReadingPost["visibility"];
}
export interface PostPage { items: ReadingPost[]; nextCursor: string | null }
export const readingPosts = {
  list: (kind: PostFilter, cursor?: string) => request<PostPage>(`/reading-posts?${new URLSearchParams({ kind, ...(cursor ? { cursor } : {}) })}`),
  get: (kind: PostKind, id: string) => request<ReadingPost>(`/reading-posts/${kind}/${encodeURIComponent(id)}`),
  create: (draft: PostDraft) => request<ReadingPost>("/reading-posts", { method: "POST", body: JSON.stringify(draft) }),
  update: (post: ReadingPost, draft: PostDraft) => request<ReadingPost>(`/reading-posts/${post.kind}/${encodeURIComponent(post.id)}`, {
    method: "PUT", body: JSON.stringify({ title: draft.title, markdown: draft.markdown, visibility: draft.visibility, revision: post.revision }),
  }),
};
export const postHref = (post: Pick<ReadingPost, "kind" | "id">) => `/annotations/posts/${post.kind.toLowerCase()}/${post.id}`;
