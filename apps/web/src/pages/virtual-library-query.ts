import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Book, BookPage } from "../domain/types";
import type { MingLibraryCatalogBook } from "./ming-library-catalog";

// 共用目录缓存失效和元数据乐观更新约定。
// Share the catalog invalidation and optimistic metadata-update contract.
export const VIRTUAL_LIBRARY_BOOKS_QUERY_KEY = ["books", "virtual-library"] as const;
export const virtualLibraryBooksQueryKey = (userId?: string) => userId ? [...VIRTUAL_LIBRARY_BOOKS_QUERY_KEY, userId] as const : VIRTUAL_LIBRARY_BOOKS_QUERY_KEY;
export const VIRTUAL_LIBRARY_BOOKS_STALE_TIME = 0;
export const VIRTUAL_LIBRARY_BOOKS_REFRESH_INTERVAL = 15_000;

interface VirtualLibrarySnapshot extends InfiniteData<BookPage> {
  catalogRevision?: string;
}

// 先轮询小型修订信息，可见目录变化后才重新抓取全部页面。
/** Poll a small revision first; fetch every page only after visible catalog data changes. */
export async function refreshVirtualLibraryBooks(queryClient: QueryClient, signal?: AbortSignal, userId?: string): Promise<VirtualLibrarySnapshot> {
  const before = await api.catalogRevision(signal);
  const revision = `${before.userId}:${before.revision}:${before.readingUpdatedAt ?? ""}`;
  const previous = queryClient.getQueryData<VirtualLibrarySnapshot>(virtualLibraryBooksQueryKey(userId));
  if (previous?.catalogRevision === revision) return previous;

  const snapshot = await fetchVirtualLibraryBooks(signal);
  const after = await api.catalogRevision(signal);
  const confirmed = `${after.userId}:${after.revision}:${after.readingUpdatedAt ?? ""}`;
  if (confirmed !== revision) throw new Error("藏书在同步期间发生变化，请重试");
  return { ...snapshot, catalogRevision: revision };
}

// 仅发布完整快照，后续分页失败不能移除已有书架书籍。
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
  // 与二维目录保持相同数据形状，确保共享缓存编辑安全。
  // Keep the same shape as the 2D catalog so shared cache edits remain safe.
  return { pages: [{ items: [...books.values()] }], pageParams: [undefined] };
}


// Anonymous shelves consume only the server-filtered public catalog and never share a private catalog cache.
export const PUBLIC_VIRTUAL_LIBRARY_BOOKS_QUERY_KEY = ["display-books", "virtual-library"] as const;
export async function fetchPublicVirtualLibraryBooks(signal?: AbortSignal): Promise<InfiniteData<{ items: MingLibraryCatalogBook[] }>> {
  const books = new Map<string, MingLibraryCatalogBook>();
  const cursors = new Set<string>();
  let revision: number | undefined;
  let cursor: string | undefined;
  do {
    signal?.throwIfAborted();
    const page = await api.listDisplayBooks({ limit: 100, sort: "title", cursor, signal });
    signal?.throwIfAborted();
    if (revision !== undefined && page.revision !== revision) throw new Error("公开藏书在同步期间发生变化，请重试");
    revision = page.revision;
    for (const book of page.items) if (book.available && book.format) books.set(book.id, {
      id: book.id, title: book.title, author: book.author, description: book.description ?? "",
      format: book.format, coverUrl: book.coverUrl, status: "AVAILABLE",
    });
    cursor = page.nextCursor || undefined;
    if (cursor && cursors.has(cursor)) throw new Error("公开藏书分页异常，请重试同步");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return { pages: [{ items: [...books.values()] }], pageParams: [undefined] };
}
