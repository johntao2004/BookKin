import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Book } from "../domain/types";
import { fetchVirtualLibraryBooks, VIRTUAL_LIBRARY_BOOKS_QUERY_KEY } from "./virtual-library-query";

const book = (id: string, title = id): Book => ({
  id, title, author: "作者", description: "", format: "EPUB", coverUrl: `/covers/${id}.jpg`,
  progress: 0, addedAt: "2026-09-14", libraryRoot: "main", relativePath: `${id}.epub`,
  fingerprint: id, status: "AVAILABLE", tags: [],
});

afterEach(() => vi.restoreAllMocks());

it("loads every cursor page beyond the former 60-book limit and deduplicates IDs", async () => {
  const first = Array.from({length: 100}, (_, i) => book(String(i)));
  const list = vi.spyOn(api, "listBooks")
    .mockResolvedValueOnce({items: first, nextCursor: "next"})
    .mockResolvedValueOnce({items: [book("99", "最新标题"), book("100")]});
  const signal = new AbortController().signal;
  const result = await fetchVirtualLibraryBooks(signal);
  expect(result.pages[0].items).toHaveLength(101);
  expect(result.pages[0].items.find(b => b.id === "99")?.title).toBe("最新标题");
  expect(list).toHaveBeenLastCalledWith({limit: 100, sort: "title", cursor: "next", signal});
});

it("rejects incomplete snapshots and repeated cursors instead of dropping shelf books or looping", async () => {
  const list = vi.spyOn(api, "listBooks")
    .mockResolvedValueOnce({items: [book("a")], nextCursor: "next"})
    .mockRejectedValueOnce(new Error("offline"));
  await expect(fetchVirtualLibraryBooks()).rejects.toThrow("offline");
  list.mockResolvedValue({items: [], nextCursor: "next"});
  await expect(fetchVirtualLibraryBooks()).rejects.toThrow("藏书分页异常");
});

it("stops fetching after cancellation", async () => {
  const controller = new AbortController();
  const list = vi.spyOn(api, "listBooks").mockImplementationOnce(async () => {
    controller.abort();
    return {items: [book("a")], nextCursor: "next"};
  });
  await expect(fetchVirtualLibraryBooks(controller.signal)).rejects.toThrow();
  expect(list).toHaveBeenCalledTimes(1);
});

it("syncs added, edited and removed books on catalog invalidation, retaining data on failure", async () => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const list = vi.spyOn(api, "listBooks").mockResolvedValue({items: [book("a"), book("b")]});
  const observer = new QueryObserver(client, {queryKey: VIRTUAL_LIBRARY_BOOKS_QUERY_KEY, queryFn: () => fetchVirtualLibraryBooks()});
  const unsubscribe = observer.subscribe(() => undefined);
  try {
    await observer.refetch();
    list.mockResolvedValue({items: [{...book("a", "更新标题"), coverUrl: "/new-cover.jpg"}, book("c")]});
    await client.invalidateQueries({queryKey: ["books"]});
    const synced = observer.getCurrentResult().data!;
    expect(synced.pages[0].items.map(b => b.id)).toEqual(["a", "c"]);
    expect(synced.pages[0].items[0]).toMatchObject({title: "更新标题", coverUrl: "/new-cover.jpg"});
    await client.invalidateQueries({queryKey: ["books"]});
    expect(observer.getCurrentResult().data).toBe(synced); // unchanged polling must not rebuild 3D
    list.mockRejectedValue(new Error("offline"));
    await client.invalidateQueries({queryKey: ["books"]});
    expect(observer.getCurrentResult().data).toBe(synced);
    list.mockResolvedValue({items: []});
    await client.invalidateQueries({queryKey: ["books"]});
    expect(observer.getCurrentResult().data?.pages[0].items).toEqual([]);
  } finally { unsubscribe(); client.clear(); }
});
