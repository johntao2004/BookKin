// 验证成功后进入详情或下一本；保存失败时保留编辑草稿和错误。
// Checks completion navigation and preserves the draft and error when persistence fails.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import type { BookMetadata, BookUpload } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { MetadataEditPage } from "./MetadataEditPage";

afterEach(() => vi.restoreAllMocks());

describe("unified metadata page", () => {
  it("opens the committed book details after confirming a single upload", async () => {
    const draft: BookUpload = {
      id: "review", libraryRootId: "root", libraryRootName: "书库", originalFilename: "draft.pdf",
      format: "PDF", declaredSizeBytes: 100, receivedBytes: 100, status: "READY_FOR_REVIEW",
      encrypted: false, drmProtected: false, digitallySigned: false, metadataCandidates: [], similarBookIds: [],
      createdAt: "", updatedAt: "", expiresAt: "", coverUrl: "/upload-cover.jpg",
      draftMetadata: { title: "尚未入库的书", authors: ["作者"], translators: [], tags: [], sources: {}, targetPath: "draft.pdf", publiclyVisible: false },
    };
    vi.spyOn(api, "getBookUpload").mockResolvedValue(draft);
    vi.spyOn(api, "updateBookUploadMetadata").mockResolvedValue(draft);
    const commit = vi.spyOn(api, "commitBookUpload").mockResolvedValue({ ...draft, status: "SUCCEEDED", committedBookId: "stored" });
    function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname} {JSON.stringify(location.state)}</output>; }
    render(<TestProviders initialPath="/library/uploads/review"><Location /><Routes>
      <Route path="/library/books/:bookId" element={<div>书籍详情</div>} />
      <Route path="/library/uploads/:uploadId" element={<MetadataEditPage />} />
    </Routes></TestProviders>);
    await screen.findByRole("textbox", { name: "书名" });
    expect(screen.getByRole("dialog", { name: "完善书籍信息" })).toHaveTextContent("此书为草稿，尚未确认入库。请完善资料后点击“确认入库”。");
    fireEvent.click(screen.getByRole("button", { name: "继续完善" }));
    fireEvent.click(screen.getByRole("button", { name: "确认入库" }));
    await waitFor(() => expect(commit).toHaveBeenCalledWith("review", false));
    expect(await screen.findByText("书籍详情")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent('/library/books/stored {"bookReturnTo":"/library/all"}');
    expect(screen.queryByRole("textbox", { name: "书名" })).not.toBeInTheDocument();
  });

  it("automatically advances through a batch and opens the last committed book", async () => {
    vi.spyOn(api, "getBookUpload").mockImplementation(async id => reviewDraft(id));
    vi.spyOn(api, "updateBookUploadMetadata").mockImplementation(async id => reviewDraft(id));
    const commit = vi.spyOn(api, "commitBookUpload").mockImplementation(async id => ({ ...reviewDraft(id), status: "SUCCEEDED", committedBookId: `${id}-book` }));
    function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname} {JSON.stringify(location.state)}</output>; }
    render(<TestProviders initialPath="/library/uploads/first?next=last"><Location /><Routes>
      <Route path="/library/books/:bookId" element={<div>书籍详情</div>} />
      <Route path="/library/uploads/:uploadId" element={<MetadataEditPage />} />
    </Routes></TestProviders>);
    for (const id of ["first", "last"]) {
      expect(await screen.findByDisplayValue(`草稿 ${id}`)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "继续完善" }));
      fireEvent.click(screen.getByRole("button", { name: "确认入库" }));
      if (id === "first") expect(await screen.findByDisplayValue("草稿 last")).toBeInTheDocument();
    }
    expect(await screen.findByText("书籍详情")).toBeInTheDocument();
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("location")).toHaveTextContent('/library/books/last-book {"bookReturnTo":"/library/all"}');
    expect(screen.queryByRole("textbox", { name: "书名" })).not.toBeInTheDocument();
  });

  it("reopening a completed upload skips completed queue entries to the next draft", async () => {
    vi.spyOn(api, "getBookUpload").mockImplementation(async id => {
      if (id === "completed") return { ...reviewDraft(id), status: "SUCCEEDED", committedBookId: "completed-book" };
      if (id === "already-done") return { ...reviewDraft(id), status: "SUCCEEDED", committedBookId: "already-done-book" };
      return reviewDraft(id);
    });
    render(<TestProviders initialPath="/library/uploads/completed?next=already-done,pending"><Routes>
      <Route path="/library/books/:bookId" element={<div>书籍详情</div>} />
      <Route path="/library/uploads/:uploadId" element={<MetadataEditPage />} />
    </Routes></TestProviders>);
    expect(await screen.findByDisplayValue("草稿 pending")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "书名" })).toBeEnabled();
    expect(screen.queryByText("书籍详情")).not.toBeInTheDocument();
  });

  it.each(["stored", "upload"])("uses the shared detail form and matching actions for %s metadata", async mode => {
    const book = { ...demoBooks[0], coverUrl: "/shared-cover.jpg" };
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    vi.spyOn(api, "getBookUpload").mockResolvedValue({
      id: "review", status: "READY_FOR_REVIEW", format: book.format, coverUrl: book.coverUrl,
      metadataCandidates: [], similarBookIds: [], declaredSizeBytes: 1600000,
      draftMetadata: { title: book.title, authors: [book.author], translators: [], tags: [], sources: {}, targetPath: "book.pdf", publiclyVisible: true },
    } as unknown as BookUpload);
    const path = mode === "stored" ? `/library/books/${book.id}/edit` : "/library/uploads/review";
    render(<TestProviders initialPath={path}><Routes>
      <Route path="/library/books/:bookId/edit" element={<MetadataEditPage />} />
      <Route path="/library/uploads/:uploadId" element={<MetadataEditPage />} />
    </Routes></TestProviders>);
    expect(await screen.findByDisplayValue(book.title)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "编辑书籍信息" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    if (mode === "upload") fireEvent.click(screen.getByRole("button", { name: "继续完善" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const returnButton = screen.getByRole("button", { name: "返回书库" });
    expect(returnButton.compareDocumentPosition(screen.getByRole("heading", { level: 1, name: "编辑书籍信息" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const cover = screen.getByRole("img", { name: /封面$/ });
    const title = screen.getByRole("textbox", { name: "书名" });
    expect(title.tagName).toBe("TEXTAREA");
    expect(Boolean(cover.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getByRole("button", { name: "更换封面" })).toBeInTheDocument();
    const authors = screen.getByRole("textbox", { name: "作者" });
    for (const name of ["副标题", "译者", "出版社", "出版日期", "ISBN", "语言", "系列", "系列序号", "标签", "学科分类", "公开展示"]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    expect(screen.getByRole("textbox", { name: "内容简介" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "作者介绍" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "内容简介" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "作者介绍" })).toBeInTheDocument();
    expect(screen.queryByLabelText("目录")).not.toBeInTheDocument();

    const primaryAction = screen.getByRole("button", { name: mode === "stored" ? "保存" : "确认入库" });
    expect(screen.getAllByRole("button", { name: mode === "stored" ? "保存" : "确认入库" })).toHaveLength(1);
    expect(Boolean(authors.compareDocumentPosition(primaryAction) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(screen.getByRole("textbox", { name: "作者介绍" }).compareDocumentPosition(primaryAction) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    if (mode === "stored") {
      expect(screen.getAllByRole("button", { name: "取消" })).toHaveLength(1);
      expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "确认入库" })).not.toBeInTheDocument();
    } else {
      expect(screen.getAllByRole("button", { name: "在线匹配" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "取消上传" })).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
    }
  });
});

function ReviewEntry() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/library/uploads/fresh?next=fresh-2,old", { state: { freshUploadIds: ["fresh", "fresh-2"], bookReturnTo: "/library/all?sort=title" } })}>本次上传校对</button>;
}

function reviewDraft(id: string): BookUpload {
  return {
    id, status: "READY_FOR_REVIEW", format: "PDF", metadataCandidates: [], similarBookIds: [],
    libraryRootId: "root", libraryRootName: "书库", originalFilename: `${id}.pdf`, declaredSizeBytes: 100, receivedBytes: 100,
    encrypted: false, drmProtected: false, digitallySigned: false, createdAt: "", updatedAt: "", expiresAt: "",
    draftMetadata: { title: `草稿 ${id}`, authors: ["作者"], translators: [], tags: [], sources: {}, targetPath: `${id}.pdf`, publiclyVisible: true },
  };
}

it("skips reminders for a new batch but reminds for old pending drafts in the same queue", async () => {
  vi.spyOn(api, "getBookUpload").mockImplementation(async id => reviewDraft(id));
  vi.spyOn(api, "updateBookUploadMetadata").mockImplementation(async id => reviewDraft(id));
  vi.spyOn(api, "commitBookUpload").mockImplementation(async id => ({ ...reviewDraft(id), status: "SUCCEEDED", committedBookId: `stored-${id}` }));
  function LocationState() { return <output data-testid="review-state">{JSON.stringify(useLocation().state)}</output>; }
  render(<TestProviders initialPath="/start"><LocationState /><Routes>
    <Route path="/start" element={<ReviewEntry />} />
    <Route path="/library/uploads/:uploadId" element={<MetadataEditPage />} />
  </Routes></TestProviders>);
  fireEvent.click(screen.getByRole("button", { name: "本次上传校对" }));
  for (const id of ["fresh", "fresh-2"]) {
    expect(await screen.findByDisplayValue(`草稿 ${id}`)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/此书为草稿/)).not.toBeInTheDocument();
    // The current entry's exemption is consumed, while the unvisited batch keeps its exemption.
    await waitFor(() => expect(JSON.parse(screen.getByTestId("review-state").textContent ?? "{}").freshUploadIds).not.toContain(id));
    fireEvent.click(screen.getByRole("button", { name: "确认入库" }));
    if (id === "fresh") expect(await screen.findByDisplayValue("草稿 fresh-2")).toBeInTheDocument();
  }
  expect(await screen.findByRole("dialog", { name: "完善书籍信息" })).toHaveTextContent("此书为草稿，尚未确认入库。请完善资料后点击“确认入库”。");
  expect(await screen.findByDisplayValue("草稿 old")).toBeInTheDocument();
  expect(screen.getByTestId("review-state")).toHaveTextContent('"bookReturnTo":"/library/all?sort=title"');
});

it("shows the reminder when an unconfirmed fresh upload is reopened and again on each later visit", async () => {
  vi.spyOn(api, "getBookUpload").mockImplementation(async id => reviewDraft(id));
  const commit = vi.spyOn(api, "commitBookUpload");
  const cancel = vi.spyOn(api, "cancelBookUpload");
  function Catalog() {
    const navigate = useNavigate();
    return <button onClick={() => navigate("/library/uploads/fresh")}>重新打开草稿</button>;
  }
  render(<TestProviders initialPath="/start"><Routes>
    <Route path="/start" element={<ReviewEntry />} />
    <Route path="/library/all" element={<Catalog />} />
    <Route path="/library/uploads/:uploadId" element={<MetadataEditPage />} />
  </Routes></TestProviders>);
  fireEvent.click(screen.getByRole("button", { name: "本次上传校对" }));
  expect(await screen.findByDisplayValue("草稿 fresh")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  for (let visit = 0; visit < 2; visit++) {
    fireEvent.click(screen.getByRole("button", { name: "返回书库" }));
    fireEvent.click(await screen.findByRole("button", { name: "重新打开草稿" }));
    expect(await screen.findByRole("dialog", { name: "完善书籍信息" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续完善" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "书名" })).toBeEnabled();
  }
  expect(commit).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
});

it("opens saved book details after metadata saves and preserves the catalog filters", async () => {
  const book = demoBooks[0];
  const metadata: BookMetadata = {
    id: book.id, title: book.title, authors: [book.author], translators: [], description: book.description,
    language: "zh-CN", publisher: "BookKin", publishedDate: "2026", isbn: "", series: "", tags: book.tags,
    subjectCodes: [], publiclyVisible: true, sources: {},
  };
  vi.spyOn(api, "getBook").mockResolvedValue(book);
  vi.spyOn(api, "getBookMetadata").mockResolvedValue(metadata);
  const save = vi.spyOn(api, "updateBookMetadata").mockResolvedValue({ metadata: { ...metadata, title: "保存后的书名" } });
  function EditEntry() {
    const navigate = useNavigate();
    return <button onClick={() => navigate(`/library/books/${book.id}/edit`, { state: { bookReturnTo: "/library/all?sort=title" } })}>编辑普通书籍</button>;
  }
  function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname} {JSON.stringify(location.state)}</output>; }
  render(<TestProviders initialPath="/start"><Location /><Routes>
    <Route path="/start" element={<EditEntry />} />
    <Route path="/library/books/:bookId/edit" element={<MetadataEditPage />} />
    <Route path="/library/books/:bookId" element={<div>书籍详情</div>} />
  </Routes></TestProviders>);
  fireEvent.click(screen.getByRole("button", { name: "编辑普通书籍" }));
  await screen.findByDisplayValue(book.title);
  fireEvent.change(screen.getByRole("textbox", { name: "书名" }), { target: { value: "保存后的书名" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  expect(await screen.findByText("书籍详情")).toBeInTheDocument();
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(screen.getByTestId("location")).toHaveTextContent(`/library/books/${book.id} {"bookReturnTo":"/library/all?sort=title"}`);
});

it("keeps the edited draft and save failure visible when a save fails", async () => {
  const book = demoBooks[0];
  vi.spyOn(api, "getBook").mockResolvedValue(book);
  let rejectSave: ((reason: Error) => void) | undefined;
  const save = vi.spyOn(api, "updateBookMetadata").mockImplementation(() => new Promise((_done, reject) => { rejectSave = reject; }));
  render(<TestProviders initialPath={`/library/books/${book.id}/edit`}><Routes>
    <Route path="/library/books/:bookId/edit" element={<MetadataEditPage />} />
    <Route path="/library/all" element={<div>返回目录</div>} />
  </Routes></TestProviders>);
  const title = await screen.findByDisplayValue(book.title);
  fireEvent.change(title, { target: { value: "测试修改" } });
  fireEvent.click(screen.getByRole("button", { name: /^保存$/ }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(screen.queryByText("返回目录")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "书名" })).toHaveValue("测试修改");
  await act(async () => rejectSave?.(new Error("保存冲突")));
  expect(await screen.findByText("元数据保存失败，已恢复原内容：保存冲突")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "书名" })).toHaveValue("测试修改");
});
