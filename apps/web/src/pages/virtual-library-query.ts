import type { InfiniteData } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Book, BookPage } from "../domain/types";

// Share the catalog invalidation and optimistic metadata-update contract.
export const VIRTUAL_LIBRARY_BOOKS_QUERY_KEY = ["books", "virtual-library"] as const;
export const VIRTUAL_LIBRARY_BOOKS_STALE_TIME = 0;
export const VIRTUAL_LIBRARY_BOOKS_REFRESH_INTERVAL = 15_000;

/** Publish only a complete snapshot: a failed later page must not remove shelf books. */
export async function fetchVirtualLibraryBooks(signal?: AbortSignal): Promise<InfiniteData<BookPage>> {
  const books = new Map<string, Book>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    signal?.throwIfAborted();
    const page = await api.listBooks({ limit: 100, sort: "title", cursor, signal });
    signal?.throwIfAborted();
    for (const book of page.items) books.set(book.id, book);
    cursor = page.nextCursor || undefined;
    if (cursor && cursors.has(cursor)) throw new Error("藏书分页异常，请重试同步");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  // Keep the same shape as the 2D catalog so shared cache edits remain safe.
  return { pages: [{ items: [...books.values()] }], pageParams: [undefined] };
}
