import { request } from "../../api/client";

export interface BookReview {
  id: string;
  bookId: string;
  userId: string;
  authorName: string;
  title: string;
  markdown: string;
  visibility: "PRIVATE" | "LIBRARY";
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export type ReviewDraft = Pick<BookReview, "title" | "markdown" | "visibility">;

/** Long-form reviews have their own storage; never write to private annotations. */
export const bookReviews = {
  list: (bookId: string) => request<BookReview[]>(`/books/${bookId}/reviews`),
  create: (bookId: string, draft: ReviewDraft) => request<BookReview>(`/books/${bookId}/reviews`, { method: "POST", body: JSON.stringify(draft) }),
  update: (id: string, draft: ReviewDraft, revision: number) => request<BookReview>(`/book-reviews/${id}`, { method: "PUT", body: JSON.stringify({ ...draft, revision }) }),
};
