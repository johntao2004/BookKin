import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { BookMetadataDraft, BookUpload } from "../domain/types";
import { useBookUploadMetadataAutosave } from "./useBookUploadMetadataAutosave";

const upload: BookUpload = {
  id: "autosave-upload", libraryRootId: "root", libraryRootName: "主书库", originalFilename: "source.pdf",
  format: "PDF", declaredSizeBytes: 100, receivedBytes: 100, status: "READY_FOR_REVIEW",
  encrypted: false, drmProtected: false, digitallySigned: false, metadataCandidates: [], similarBookIds: [],
  expiresAt: "", createdAt: "", updatedAt: "",
  draftMetadata: { title: "缓存标题", authors: ["作者"], translators: [], tags: [], targetPath: "作者/缓存标题.pdf", sources: {} },
};
const withTitle = (title: string): BookMetadataDraft => ({ ...upload.draftMetadata!, title });
const detailKey = ["book-upload", upload.id] as const;
const listKey = ["book-uploads", "member-1"] as const;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData<BookUpload>(detailKey, upload);
  client.setQueryData<BookUpload[]>(listKey, [upload]);
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const rendered = renderHook(() => useBookUploadMetadataAutosave(upload.id, true), { wrapper });
  return { client, ...rendered };
}

afterEach(() => vi.restoreAllMocks());

it("updates upload caches and invalidates the list after the latest save succeeds", async () => {
  const saved = { ...upload, updatedAt: "saved", draftMetadata: withTitle("已保存标题") };
  const update = vi.spyOn(api, "updateBookUploadMetadata").mockResolvedValue(saved);
  const { client, result } = setup();

  act(() => result.current.schedule(withTitle("已保存标题")));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1), { timeout: 2500 });
  await waitFor(() => expect(result.current.state).toBe("saved"));

  expect(client.getQueryData<BookUpload>(detailKey)?.draftMetadata?.title).toBe("已保存标题");
  expect(client.getQueryData<BookUpload[]>(listKey)?.[0]?.draftMetadata?.title).toBe("已保存标题");
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
});

it("does not publish an older successful response while a newer version is pending", async () => {
  let resolveOld!: (value: BookUpload) => void;
  let resolveLatest!: (value: BookUpload) => void;
  const oldResponse = new Promise<BookUpload>(resolve => { resolveOld = resolve; });
  const latestResponse = new Promise<BookUpload>(resolve => { resolveLatest = resolve; });
  const update = vi.spyOn(api, "updateBookUploadMetadata").mockImplementation((_id, draft) =>
    draft.title === "旧版本" ? oldResponse : latestResponse,
  );
  const { client, result } = setup();

  act(() => result.current.schedule(withTitle("旧版本")));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1), { timeout: 2500 });
  act(() => result.current.schedule(withTitle("最新版本")));
  resolveOld({ ...upload, draftMetadata: withTitle("旧版本") });
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));

  expect(client.getQueryData<BookUpload>(detailKey)?.draftMetadata?.title).toBe("缓存标题");
  expect(client.getQueryData<BookUpload[]>(listKey)?.[0]?.draftMetadata?.title).toBe("缓存标题");
  expect(client.getQueryState(listKey)?.isInvalidated ?? false).toBe(false);

  resolveLatest({ ...upload, draftMetadata: withTitle("最新版本") });
  await waitFor(() => expect(result.current.state).toBe("saved"));
  expect(client.getQueryData<BookUpload>(detailKey)?.draftMetadata?.title).toBe("最新版本");
  expect(client.getQueryData<BookUpload[]>(listKey)?.[0]?.draftMetadata?.title).toBe("最新版本");
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
});
