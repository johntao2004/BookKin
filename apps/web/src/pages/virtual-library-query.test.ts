// 验证修订号与完整分页快照，失败、重复游标或取消时保留旧目录而不丢书或无限循环。
// Checks revision/complete-pagination snapshots, preserving prior catalog data on failure, repeated cursors or cancellation.
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Book } from "../domain/types";
import { fetchVirtualLibraryBooks, refreshVirtualLibraryBooks, VIRTUAL_LIBRARY_BOOKS_QUERY_KEY, fetchPublicVirtualLibraryBooks, PUBLIC_VIRTUAL_LIBRARY_BOOKS_QUERY_KEY, virtualLibraryBooksQueryKey } from "./virtual-library-query";

const book = (id: string, title = id): Book => ({
  id, title, author: "作者", description: "", format: "EPUB", coverUrl: `/covers/${id}.jpg`,
  progress: 0, addedAt: "2026-09-14", libraryRoot: "main", relativePath: `${id}.epub`,
  fingerprint: id, status: "AVAILABLE", tags: [],
});

afterEach(() => vi.restoreAllMocks());

it("checks the revision without refetching pages until the catalog changes", async () => {
  const client = new QueryClient();
  let revision = 1;
  const version = vi.spyOn(api, "catalogRevision").mockImplementation(async () => ({ userId: "reader", revision }));
  const list = vi.spyOn(api, "listBooks").mockResolvedValueOnce({ items: [book("a")] })
    .mockResolvedValueOnce({ items: [book("a"), book("b")] });

  const first = await refreshVirtualLibraryBooks(client);
  client.setQueryData(VIRTUAL_LIBRARY_BOOKS_QUERY_KEY, first);
  expect(await refreshVirtualLibraryBooks(client)).toBe(first);
  expect(list).toHaveBeenCalledTimes(1);
  revision = 2;
  const second = await refreshVirtualLibraryBooks(client);
  expect(second.pages[0].items.map((item) => item.id)).toEqual(["a", "b"]);
  expect(list).toHaveBeenCalledTimes(2);
  expect(version).toHaveBeenCalledTimes(5);
  client.clear();
});

it("keeps the prior snapshot if the revision changes during pagination", async () => {
  const client = new QueryClient();
  let revision = 1;
  vi.spyOn(api, "catalogRevision").mockImplementation(async () => ({ userId: "reader", revision }));
  vi.spyOn(api, "listBooks").mockImplementation(async () => {
    revision = 2;
    return { items: [book("new")] };
  });
  await expect(refreshVirtualLibraryBooks(client)).rejects.toThrow("藏书在同步期间发生变化");
  expect(client.getQueryData(VIRTUAL_LIBRARY_BOOKS_QUERY_KEY)).toBeUndefined();
  client.clear();
});

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


it("builds anonymous shelves only from complete public pages without private data or cache reuse", async () => {
  const privateList = vi.spyOn(api, "listBooks");
  const privateRevision = vi.spyOn(api, "catalogRevision");
  vi.spyOn(api, "listDisplayBooks").mockResolvedValueOnce({ items: [{ id: "public", title: "公开书", author: "作者", coverUrl: "/public.jpg", available: true, format: "PDF", sortOrder: 1 }], nextCursor: "next", revision: 2 })
    .mockResolvedValueOnce({ items: [{ id: "unavailable", title: "不可读", author: "作者", coverUrl: "", available: false, format: "PDF", sortOrder: 2 }], revision: 2 });
  const result = await fetchPublicVirtualLibraryBooks();
  expect(result.pages[0].items).toEqual([{ id: "public", title: "公开书", author: "作者", description: "", coverUrl: "/public.jpg", format: "PDF", status: "AVAILABLE" }]);
  expect(privateList).not.toHaveBeenCalled(); expect(privateRevision).not.toHaveBeenCalled();
  expect(PUBLIC_VIRTUAL_LIBRARY_BOOKS_QUERY_KEY).not.toEqual(VIRTUAL_LIBRARY_BOOKS_QUERY_KEY);
});

it("rejects a public snapshot if publication changes during pagination", async () => {
  vi.spyOn(api, "listDisplayBooks").mockResolvedValueOnce({ items: [], nextCursor: "next", revision: 1 }).mockResolvedValueOnce({ items: [], revision: 2 });
  await expect(fetchPublicVirtualLibraryBooks()).rejects.toThrow("公开藏书在同步期间发生变化");
});


it("isolates signed-in catalog snapshots by user while preserving books-prefix invalidation", async () => {
  const client = new QueryClient();
  vi.spyOn(api, "catalogRevision").mockResolvedValue({ userId: "user-b", revision: 1 });
  const list = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [book("b")] });
  client.setQueryData(virtualLibraryBooksQueryKey("user-a"), { pages: [{ items: [book("a")] }], pageParams: [undefined], catalogRevision: "user-b:1:" });
  const snapshot = await refreshVirtualLibraryBooks(client, undefined, "user-b");
  expect(snapshot.pages[0].items.map(item => item.id)).toEqual(["b"]);
  expect(list).toHaveBeenCalledOnce();
  expect(virtualLibraryBooksQueryKey("user-b").slice(0, 2)).toEqual(VIRTUAL_LIBRARY_BOOKS_QUERY_KEY);
  client.clear();
});
