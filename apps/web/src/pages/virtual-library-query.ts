import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Book, BookPage } from "../domain/types";

// Share the catalog invalidation and optimistic metadata-update contract.
export const VIRTUAL_LIBRARY_BOOKS_QUERY_KEY = ["books", "virtual-library"] as const;
export const VIRTUAL_LIBRARY_BOOKS_STALE_TIME = 0;
export const VIRTUAL_LIBRARY_BOOKS_REFRESH_INTERVAL = 15_000;

interface VirtualLibrarySnapshot extends InfiniteData<BookPage> {
  catalogRevision?: string;
}

/** Poll a small revision first; fetch every page only after visible catalog data changes. */
export async function refreshVirtualLibraryBooks(queryClient: QueryClient, signal?: AbortSignal): Promise<VirtualLibrarySnapshot> {
  const before = await api.catalogRevision(signal);
  const revision = `${before.userId}:${before.revision}:${before.readingUpdatedAt ?? ""}`;
  const previous = queryClient.getQueryData<VirtualLibrarySnapshot>(VIRTUAL_LIBRARY_BOOKS_QUERY_KEY);
  if (previous?.catalogRevision === revision) return previous;

  const snapshot = await fetchVirtualLibraryBooks(signal);
  const after = await api.catalogRevision(signal);
  const confirmed = `${after.userId}:${after.revision}:${after.readingUpdatedAt ?? ""}`;
  if (confirmed !== revision) throw new Error("藏书在同步期间发生变化，请重试");
  return { ...snapshot, catalogRevision: revision };
}

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
