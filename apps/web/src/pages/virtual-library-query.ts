import { api } from "../api/client";

export const VIRTUAL_LIBRARY_BOOKS_QUERY_KEY = ["virtual-library-books"] as const;
export const VIRTUAL_LIBRARY_BOOKS_STALE_TIME = 60_000;

export function fetchVirtualLibraryBooks(signal?: AbortSignal) {
  return api.listBooks({ limit: 60, sort: "recent", signal });
}
