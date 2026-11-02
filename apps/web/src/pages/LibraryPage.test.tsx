import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { api } from "../api/client";
import type { Book, BookUpload } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { LibraryPage } from "./LibraryPage";
import * as permissionHooks from "../auth/permissions";
function RouteSearch() { const location = useLocation(); return <output data-testid="route-search">{location.search}</output>; }
function UploadDestination() { const location = useLocation(); return <output data-testid="upload-destination">{JSON.stringify({ pathname: location.pathname, state: location.state })}</output>; }
function makeUpload(overrides: Partial<BookUpload> = {}): BookUpload {
  return {
    id: "draft-1", libraryRootId: "root", libraryRootName: "书籍书库", originalFilename: "draft.pdf",
    format: "PDF", declaredSizeBytes: 1024, receivedBytes: 1024, status: "READY_FOR_REVIEW", encrypted: false,
    drmProtected: false, digitallySigned: false, metadataCandidates: [], similarBookIds: [], expiresAt: "2026-10-28T00:00:00Z",
    createdAt: "2026-10-27T00:00:00Z", updatedAt: "2026-10-27T00:00:00Z",
    draftMetadata: { title: "草稿书", authors: ["作者"], translators: [], tags: [], targetPath: "", sources: {} },
    ...overrides,
  };
}
function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-1", title: "普通藏书", author: "作者", description: "", format: "PDF", coverUrl: "", progress: 0,
    addedAt: "2026-10-27T00:00:00Z", libraryRoot: "书籍书库", relativePath: "book.pdf", fingerprint: "sha256:test",
    status: "AVAILABLE", tags: [], ...overrides,
  };
}

beforeEach(() => {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false }));
  vi.spyOn(api, "listBookUploads").mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it("keeps the catalog independent of overview data and removes the visibility switch", async () => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  const stats = vi.spyOn(api, "getWeeklyReadingStats");
  const annotations = vi.spyOn(api, "listAnnotations");
  render(<TestProviders initialPath="/library"><LibraryPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "藏书楼", level: 1 })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "全部藏书", level: 2 })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "上传书籍" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "书库概览" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /[显隐][示藏]概览/ })).not.toBeInTheDocument();
  expect(stats).not.toHaveBeenCalled();
  expect(annotations).not.toHaveBeenCalled();
});

it("keeps the library page available without querying books when query permission is off", async () => {
  const listBooks = vi.spyOn(api, "listBooks");
  const usePermissions = permissionHooks.usePermissions;
  vi.spyOn(permissionHooks, "usePermissions").mockImplementation(() => {
    const permissions = usePermissions();
    return { ...permissions, can: code => code !== "library.query" && permissions.can(code) };
  });
  render(<TestProviders initialPath="/library"><LibraryPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "全部藏书" })).toBeInTheDocument();
  expect(await screen.findByText(/当前角色没有查询书籍目录的权限/)).toBeInTheDocument();
  expect(listBooks).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "上传书籍" })).toBeInTheDocument();
});

it("switches private/public scopes while retaining catalog filters", async () => {
  const privateBooks = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  const publicBooks = vi.spyOn(api, "listDisplayBooks").mockResolvedValue({ items: [], revision: 1 });
  render(<TestProviders initialPath="/library?format=PDF&q=river&sort=title"><><LibraryPage /><RouteSearch /></></TestProviders>);
  fireEvent.mouseDown(await screen.findByRole("combobox", { name: "馆藏范围" }));
  fireEvent.click(await screen.findByText("公开藏书", { exact: true }));
  expect(await screen.findByRole("heading", { name: "公开藏书" })).toBeInTheDocument();
  await waitFor(() => expect(publicBooks).toHaveBeenCalledWith(expect.objectContaining({ q: "river", format: "PDF", sort: "title" })));
  expect(screen.queryByRole("button", { name: "上传书籍" })).not.toBeInTheDocument();
  expect(screen.getByTestId("route-search")).toHaveTextContent("scope=public");
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "馆藏范围" }));
  fireEvent.click(await screen.findByText("全部藏书", { exact: true }));
  expect(await screen.findByRole("heading", { name: "全部藏书" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "上传书籍" })).toBeInTheDocument();
  expect(privateBooks).toHaveBeenCalledWith(expect.objectContaining({ q: "river", format: "PDF", sort: "title" }));
  expect(screen.getByTestId("route-search")).not.toHaveTextContent("scope=public");
});

it.each(["/library/all", "/library/all?sort=title"])("does not show reset for an unfiltered empty catalog %s", async initialPath => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  render(<TestProviders initialPath={initialPath}><LibraryPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "暂无书籍" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "清除筛选" })).not.toBeInTheDocument();
});
it.each(["/library?format=PDF", "/library?q=not-found"])("can reset an empty filtered catalog %s", async initialPath => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  render(<TestProviders initialPath={initialPath}><LibraryPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "未找到匹配的书籍" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "清除筛选" })).toBeInTheDocument();
});
it("clears search and format while preserving sort and other URL parameters", async () => {
  const listBooks = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  render(<TestProviders initialPath="/library?format=PDF&q=not-found&sort=title&view=compact"><><LibraryPage /><RouteSearch /></></TestProviders>);
  fireEvent.click(await screen.findByRole("button", { name: "清除筛选" }));
  await waitFor(() => {
    const params = new URLSearchParams(screen.getByTestId("route-search").textContent ?? "");
    expect(params.has("q")).toBe(false); expect(params.has("format")).toBe(false);
    expect(params.get("sort")).toBe("title"); expect(params.get("view")).toBe("compact");
  });
  await waitFor(() => expect(listBooks).toHaveBeenLastCalledWith(expect.objectContaining({ q: undefined, format: undefined, sort: "title" })));
});
it("filters the gallery from URL search without mounting overview modules", async () => {
  render(<TestProviders initialPath="/library?q=夜航"><LibraryPage /></TestProviders>);
  expect(await screen.findByText("夜航记")).toBeInTheDocument();
  expect(screen.getByText("找到 1 本已入库藏书")).toBeInTheDocument();
  expect(screen.queryByText("夏日植物学")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "批注回顾" })).not.toBeInTheDocument();
});
it("shows a working back-to-top action after scrolling", async () => {
  const originalScrollY = window.scrollY;
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  render(<TestProviders initialPath="/library"><LibraryPage /></TestProviders>);
  expect(screen.queryByRole("button", { name: "回到顶部" })).not.toBeInTheDocument();
  Object.defineProperty(window, "scrollY", { configurable: true, value: 600 }); fireEvent.scroll(window);
  fireEvent.click(await screen.findByRole("button", { name: "回到顶部" }));
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  Object.defineProperty(window, "scrollY", { configurable: true, value: originalScrollY });
});

it("shows only ready drafts that match keyword, format and subject, with review as the sole card action", async () => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  vi.spyOn(api, "listBookUploads").mockResolvedValue([
    makeUpload({ id: "matching-draft", originalFilename: "river.pdf", draftMetadata: { title: "河川观察", authors: ["林"], translators: [], tags: [], subjectCodes: ["RNKH2"], targetPath: "", sources: {} } }),
    makeUpload({ id: "wrong-format", format: "EPUB", draftMetadata: { title: "河川旧稿", authors: ["林"], translators: [], tags: [], subjectCodes: ["RNKH2"], targetPath: "", sources: {} } }),
    makeUpload({ id: "wrong-subject", draftMetadata: { title: "河川小说", authors: ["林"], translators: [], tags: [], subjectCodes: ["FB"], targetPath: "", sources: {} } }),
    makeUpload({ id: "still-processing", status: "INSPECTING", originalFilename: "河川待解析.pdf" }),
  ]);
  render(<TestProviders initialPath="/library?format=PDF&q=河川&subject=RNK"><LibraryPage /></TestProviders>);

  expect(await screen.findByRole("heading", { name: "待完善资料" })).toBeInTheDocument();
  expect(screen.getAllByText("河川观察").length).toBeGreaterThan(0);
  expect(screen.queryByText("河川旧稿")).not.toBeInTheDocument();
  expect(screen.queryByText("河川小说")).not.toBeInTheDocument();
  expect(screen.queryByText("河川待解析")).not.toBeInTheDocument();
  expect(screen.getByText("草稿", { exact: true })).toBeInTheDocument();
  expect(screen.queryByText("文件暂不可读")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "河川观察更多操作" }));
  expect(await screen.findByRole("menuitem", { name: "完善资料" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "开始阅读" })).not.toBeInTheDocument();
});

it("opens a draft review route with the current catalog filters in return state", async () => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  vi.spyOn(api, "listBookUploads").mockResolvedValue([makeUpload({ id: "return-draft", originalFilename: "river.pdf", draftMetadata: { title: "river draft", authors: ["作者"], translators: [], tags: [], targetPath: "", sources: {} } })]);
  render(<TestProviders initialPath="/library?format=PDF&q=river&sort=title"><Routes>
    <Route path="/library" element={<LibraryPage />} />
    <Route path="/library/uploads/:uploadId" element={<UploadDestination />} />
  </Routes></TestProviders>);

  fireEvent.click(await screen.findByRole("button", { name: "river draft更多操作" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "完善资料" }));
  expect(await screen.findByTestId("upload-destination")).toHaveTextContent('"pathname":"/library/uploads/return-draft"');
  expect(screen.getByTestId("upload-destination")).toHaveTextContent('"bookReturnTo":"/library?format=PDF&q=river&sort=title"');
});

it("does not mix unclassified upload drafts into a custom category filter", async () => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  vi.spyOn(api, "listCategories").mockResolvedValue({ items: [] } as any);
  vi.spyOn(api, "listBookUploads").mockResolvedValue([makeUpload()]);
  render(<TestProviders initialPath="/library?category=category-literature"><LibraryPage /></TestProviders>);

  expect(await screen.findByRole("heading", { name: "未找到匹配的已入库书籍" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "待完善资料" })).not.toBeInTheDocument();
  expect(screen.queryByText("草稿书")).not.toBeInTheDocument();
});

it("keeps the ordinary empty state precise when drafts exist", async () => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  vi.spyOn(api, "listBookUploads").mockResolvedValue([makeUpload()]);
  render(<TestProviders initialPath="/library"><LibraryPage /></TestProviders>);

  expect(await screen.findByRole("heading", { name: "暂无已入库书籍" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "待完善资料" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "暂无书籍" })).not.toBeInTheDocument();
});

it("keeps ordinary books visible and exposes a retry when draft loading fails", async () => {
  const listUploads = vi.spyOn(api, "listBookUploads").mockRejectedValueOnce(new Error("offline")).mockResolvedValue([makeUpload()]);
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [makeBook()] });
  render(<TestProviders initialPath="/library"><LibraryPage /></TestProviders>);

  const draftFailure = await screen.findByRole("alert");
  expect(draftFailure).toHaveTextContent(/草稿暂时无法读取/);
  expect(draftFailure).toHaveTextContent("重试");
  expect(screen.getAllByText("普通藏书").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  expect(await screen.findByRole("heading", { name: "待完善资料" })).toBeInTheDocument();
  expect(screen.getAllByText("普通藏书").length).toBeGreaterThan(0);
  expect(listUploads).toHaveBeenCalledTimes(2);
});

it("polls uploads while processing and stops once they are ready for review", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const listUploads = vi.spyOn(api, "listBookUploads")
    .mockResolvedValueOnce([makeUpload({ status: "INSPECTING" })])
    .mockResolvedValue([makeUpload()]);
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  render(<TestProviders initialPath="/library"><LibraryPage /></TestProviders>);

  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(listUploads).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
  expect(listUploads).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
  expect(listUploads).toHaveBeenCalledTimes(2);
});

it("does not request upload drafts for a member without upload permission", async () => {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "user-member", username: "member", displayName: "读者", role: "MEMBER", mustChangePassword: false }));
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  const listUploads = vi.spyOn(api, "listBookUploads");
  render(<TestProviders initialPath="/library"><LibraryPage /></TestProviders>);

  expect(await screen.findByRole("heading", { name: "全部藏书" })).toBeInTheDocument();
  expect(listUploads).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "上传书籍" })).not.toBeInTheDocument();
});

it("does not request private upload drafts in public scope", async () => {
  vi.spyOn(api, "listDisplayBooks").mockResolvedValue({ items: [], revision: 1 });
  const listUploads = vi.spyOn(api, "listBookUploads");
  render(<TestProviders initialPath="/library?scope=public"><LibraryPage /></TestProviders>);

  expect(await screen.findByRole("heading", { name: "公开藏书" })).toBeInTheDocument();
  expect(listUploads).not.toHaveBeenCalled();
});

it("deletes a pending draft through its card menu and refreshes the list", async () => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  vi.mocked(api.listBookUploads).mockResolvedValue([makeUpload()]);
  const remove = vi.spyOn(api, "cancelBookUpload").mockImplementation(async () => {
    vi.mocked(api.listBookUploads).mockResolvedValue([]);
  });
  render(<TestProviders initialPath="/library"><LibraryPage /></TestProviders>);
  fireEvent.click(await screen.findByRole("button", { name: "草稿书更多操作" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "删除草稿" }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: /^删\s*除$/ }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith("draft-1"));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "待完善资料" })).not.toBeInTheDocument());
});
