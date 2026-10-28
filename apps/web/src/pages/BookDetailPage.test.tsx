// Covers direct book details, return navigation, role-gated actions and the library-card route.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { demoBooks } from "../data/demo";
import type { BookMetadata, FileOperationPreview } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { LibraryPage } from "./LibraryPage";
import { bookReviews } from "../features/reviews/api";
import { BookDetailPage } from "./BookDetailPage";
import * as permissionHooks from "../auth/permissions";

const owner = {
  id: "user-owner",
  username: "owner",
  displayName: "林",
  role: "OWNER",
  mustChangePassword: false,
};

const member = {
  id: "user-member",
  username: "member",
  displayName: "家庭成员",
  role: "MEMBER",
  mustChangePassword: false,
};

function RouteLocation() {
  const location = useLocation();
  return <output data-testid="route-location">{location.pathname}{location.search}{location.state ? ` ${JSON.stringify(location.state)}` : ""}</output>;
}

function metadataForBook(book: (typeof demoBooks)[number]): BookMetadata {
  return {
    id: book.id,
    title: book.title,
    authors: [book.author],
    translators: [],
    description: book.description,
    language: "zh-CN",
    publisher: "BookKin典藏",
    publishedDate: "2026",
    isbn: "",
    series: "灯火集",
    tags: book.tags,
    subjectCodes: [],
    sources: {},
    publiclyVisible: true,
  };
}

function renderDetail(initialPath: string, user = owner) {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify(user));
  return render(
    <TestProviders initialPath={initialPath}>
      <>
        <Routes>
          <Route path="/library/books/:bookId" element={<BookDetailPage />} />
          <Route path="/library/books/:bookId/edit" element={<div>编辑目标</div>} />
          <Route path="/reader/:bookId" element={<div>阅读目标</div>} />
          <Route path="/library/all" element={<LibraryPage />} />
        </Routes>
        <RouteLocation />
      </>
    </TestProviders>,
  );
}

describe("BookDetailPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(bookReviews, "list").mockResolvedValue([]);
    vi.spyOn(api, "getBookMetadata").mockImplementation(async id => {
      const book = demoBooks.find(candidate => candidate.id === id);
      if (!book) throw new Error("未找到这本书");
      return metadataForBook(book);
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("shows readable language names for mixed legacy language codes", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    vi.mocked(api.getBookMetadata).mockResolvedValue({ ...metadataForBook(book), language: "zh-CN,en-US,eng,ru" });
    renderDetail(`/library/books/${book.id}`, member);
    const bibliography = await screen.findByRole("region", { name: "书目资料" });
    expect(within(bibliography).getByText("中文、英文、俄语")).toBeInTheDocument();
    expect(within(bibliography).queryByText(/zh-CN|en-US|eng/)).not.toBeInTheDocument();
  });

  it("loads book metadata directly and starts reading from the detail page", async () => {
    const book = demoBooks[2];
    const getBook = vi.spyOn(api, "getBook").mockResolvedValue(book);
    renderDetail(`/library/books/${book.id}`);

    expect(await screen.findByRole("heading", { level: 1, name: "书籍详情" })).toBeInTheDocument();
    const returnButton = screen.getByRole("button", { name: "返回书库" });
    expect(returnButton.compareDocumentPosition(screen.getByRole("heading", { level: 1, name: "书籍详情" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(returnButton.closest(".bk-action-toolbar")).toBeNull();
    expect(await screen.findByRole("heading", { level: 2, name: book.title })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: `${book.title}封面` })).toHaveAttribute("src", book.coverUrl);
    const bibliography = await screen.findByRole("region", { name: "书目资料" });
    expect(screen.getAllByText(book.author)).toHaveLength(1);
    expect(within(bibliography).queryByText(book.author)).not.toBeInTheDocument();
    expect(screen.getByText(book.description)).toBeInTheDocument();
    expect(screen.getByText(book.format)).toBeInTheDocument();
    expect(within(bibliography).getByText(book.tags.join("、"))).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "馆藏信息" })).not.toBeInTheDocument();
    expect(screen.queryByText(`${book.libraryRoot}/${book.relativePath}`)).not.toBeInTheDocument();
    expect(getBook).toHaveBeenCalledWith(book.id);

    fireEvent.click(screen.getByRole("button", { name: "开始阅读" }));
    expect(screen.getByTestId("route-location")).toHaveTextContent(`/reader/${book.id}`);
  });

  it("offers continue reading when progress exists", async () => {
    const book = { ...demoBooks[1], progress: 42 };
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    renderDetail(`/library/books/${book.id}`, member);

    fireEvent.click(await screen.findByRole("button", { name: "继续阅读" }));

    expect(screen.getByTestId("route-location")).toHaveTextContent(`/reader/${book.id}`);
  });

  it("lets a reader download the original through the authenticated streaming endpoint", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    renderDetail(`/library/books/${book.id}`, member);

    const download = await screen.findByRole("link", { name: "下载原书" });
    expect(download).toHaveAttribute("href", `/api/v1/books/${book.id}/content`);
    expect(download).toHaveAttribute("download", `${book.title}.${book.format.toLowerCase()}`);
  });

  it("does not offer an original download without reading permission", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    const usePermissions = permissionHooks.usePermissions;
    vi.spyOn(permissionHooks, "usePermissions").mockImplementation(() => {
      const permissions = usePermissions();
      return { ...permissions, can: code => code !== "reader.read" && permissions.can(code) };
    });
    renderDetail(`/library/books/${book.id}`, member);

    expect(await screen.findByRole("heading", { level: 2, name: book.title })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "下载原书" })).not.toBeInTheDocument();
  });

  it("does not offer an original download for an unavailable file", async () => {
    const book = { ...demoBooks[0], status: "MISSING" as const };
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    renderDetail(`/library/books/${book.id}`, member);

    expect(await screen.findByRole("heading", { level: 2, name: book.title })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "下载原书" })).not.toBeInTheDocument();
  });

  it("lets members add a book to a list without exposing management actions", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    const getBookMetadata = vi.mocked(api.getBookMetadata);
    renderDetail(`/library/books/${book.id}`, member);

    fireEvent.click(await screen.findByRole("button", { name: "加入书目" }));

    expect(await screen.findByText(`将《${book.title}》加入书目`)).toBeInTheDocument();
    expect(getBookMetadata).toHaveBeenCalledWith(book.id);
    expect(screen.queryByRole("button", { name: "编辑元信息" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "管理文件" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除书籍" })).not.toBeInTheDocument();
  });

  it("edits metadata in place and cancels without navigating or changing saved content", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    const updateMetadata = vi.spyOn(api, "updateBookMetadata");
    renderDetail(`/library/books/${book.id}?from=library`);

    const edit = await screen.findByRole("button", { name: "编辑元信息" });
    await waitFor(() => expect(edit).toBeEnabled());
    fireEvent.click(edit);
    const titleInput = await screen.findByRole("textbox", { name: "书名" });
    expect(titleInput).toHaveValue(book.title);
    expect(screen.getByTestId("route-location")).toHaveTextContent(`/library/books/${book.id}?from=library`);
    expect(screen.queryByText("编辑目标")).not.toBeInTheDocument();
    fireEvent.change(titleInput, { target: { value: "未保存的修改" } });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(await screen.findByRole("heading", { level: 2, name: book.title })).toBeInTheDocument();
    expect(updateMetadata).not.toHaveBeenCalled();
    expect(screen.getByTestId("route-location")).toHaveTextContent(`/library/books/${book.id}?from=library`);
  });

  it("saves inline changes and renders the persisted metadata on the same detail route", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    const savedMetadata = { ...metadataForBook(book), publisher: "更新后的出版社", title: "更新后的书名" };
    const updateMetadata = vi.spyOn(api, "updateBookMetadata").mockResolvedValue({ metadata: savedMetadata });
    renderDetail(`/library/books/${book.id}`);

    const edit = await screen.findByRole("button", { name: "编辑元信息" });
    await waitFor(() => expect(edit).toBeEnabled());
    fireEvent.click(edit);
    fireEvent.change(await screen.findByRole("textbox", { name: "书名" }), { target: { value: savedMetadata.title } });
    fireEvent.change(screen.getByRole("textbox", { name: "出版社" }), { target: { value: savedMetadata.publisher } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("heading", { level: 2, name: savedMetadata.title })).toBeInTheDocument();
    expect(screen.getByText(savedMetadata.publisher)).toBeInTheDocument();
    expect(updateMetadata).toHaveBeenCalledWith(book, expect.objectContaining({ title: savedMetadata.title, publisher: savedMetadata.publisher, writeBack: false, manualFields: expect.arrayContaining(["title", "publisher"]) }));
    expect(screen.queryByRole("textbox", { name: "书名" })).not.toBeInTheDocument();
    expect(screen.getByTestId("route-location")).toHaveTextContent(`/library/books/${book.id}`);
  });

  it("keeps source biography and a manually saved table of contents consistent when editing in place", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    vi.mocked(api.getBookMetadata).mockResolvedValue({ ...metadataForBook(book), tableOfContents: "人工目录", sources: { tableOfContents: "MANUAL" } });
    vi.spyOn(api, "getBookBibliographySource").mockResolvedValue({ authorBiography: "原书作者介绍", tableOfContents: "原书目录" });
    renderDetail(`/library/books/${book.id}`);

    expect(await screen.findByText("原书作者介绍")).toBeInTheDocument();
    expect(screen.getByText("人工目录")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑元信息" }));
    expect(await screen.findByRole("textbox", { name: "作者介绍" })).toHaveValue("原书作者介绍");
    expect(screen.queryByRole("textbox", { name: "目录" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(await screen.findByText("人工目录")).toBeInTheDocument();
  });

  it("keeps one metadata-editing entry without a separate file-management button", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    renderDetail(`/library/books/${book.id}`);

    expect(await screen.findByRole("button", { name: "编辑元信息" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "管理文件" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重命名原文件" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "新书名" })).not.toBeInTheDocument();
  });

  it("keeps safe renaming reachable when file permission is granted without metadata editing", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    const usePermissions = permissionHooks.usePermissions;
    vi.spyOn(permissionHooks, "usePermissions").mockImplementation(() => {
      const permissions = usePermissions();
      return { ...permissions, can: code => code !== "library.edit" && permissions.can(code) };
    });
    renderDetail(`/library/books/${book.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "重命名原文件" }));
    expect(await screen.findByRole("textbox", { name: "新书名" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑元信息" })).not.toBeInTheDocument();
  });

  it.each(["OWNER", "ADMIN"])("requires a second confirmation and allows cancelling deletion as %s", async role => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    const preview = { previewToken: "detail-trash-preview", type: "TRASH", sourcePath: book.relativePath,
      requiredBytes: 0, expectedFingerprint: book.fingerprint, expiresAt: new Date(Date.now() + 300000).toISOString(),
      warnings: [], conflicts: [] } satisfies FileOperationPreview;
    const prepare = vi.spyOn(api, "previewFileOperation").mockResolvedValue(preview);
    const execute = vi.spyOn(api, "executeFileOperation");
    renderDetail(`/library/books/${book.id}`, { ...owner, role });

    fireEvent.click(await screen.findByRole("button", { name: "删除书籍" }));
    expect(await screen.findByText("请确认是否将这本书移入回收站。")).toBeInTheDocument();
    await waitFor(() => expect(prepare).toHaveBeenCalledWith(book, "TRASH"));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认移入回收站" })).toBeEnabled());
    expect(execute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(execute).not.toHaveBeenCalled();
    expect(screen.getByTestId("route-location")).toHaveTextContent(`/library/books/${book.id}`);
  });

  it.each(["SUCCEEDED", "PLANNED"] as const)("returns to the catalog after a confirmed %s trash task", async status => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    const preview = { previewToken: "detail-trash-confirm", type: "TRASH", sourcePath: book.relativePath,
      requiredBytes: 0, expectedFingerprint: book.fingerprint, expiresAt: new Date(Date.now() + 300000).toISOString(),
      warnings: [], conflicts: [] } satisfies FileOperationPreview;
    vi.spyOn(api, "previewFileOperation").mockResolvedValue(preview);
    const execute = vi.spyOn(api, "executeFileOperation").mockResolvedValue({ id: "trash-job", type: "TRASH", status,
      sourcePath: book.relativePath, createdAt: new Date().toISOString() });
    renderDetail(`/library/books/${book.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "删除书籍" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认移入回收站" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "确认移入回收站" }));
    await waitFor(() => expect(execute).toHaveBeenCalledExactlyOnceWith(preview));
    await waitFor(() => expect(screen.getByTestId("route-location")).toHaveTextContent("/library/all"));
  });

  it("keeps the detail and offers retry when confirmed deletion fails", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    vi.spyOn(api, "previewFileOperation").mockResolvedValue({ previewToken: "detail-trash-fail", type: "TRASH",
      sourcePath: book.relativePath, requiredBytes: 0, expectedFingerprint: book.fingerprint,
      expiresAt: new Date(Date.now() + 300000).toISOString(), warnings: [], conflicts: [] });
    vi.spyOn(api, "executeFileOperation").mockRejectedValue(new Error("文件已变化，请重新检查。"));
    renderDetail(`/library/books/${book.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "删除书籍" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认移入回收站" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "确认移入回收站" }));
    expect(await screen.findByText("文件已变化，请重新检查。")).toBeInTheDocument();
    expect(screen.getByTestId("route-location")).toHaveTextContent(`/library/books/${book.id}`);
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
  });

  it("retries a failed direct detail load", async () => {
    const book = demoBooks[0];
    const getBook = vi.spyOn(api, "getBook")
      .mockRejectedValueOnce(new ApiRequestError("暂时不可用", 503, "BOOK_UNAVAILABLE", "book-request-123456"))
      .mockResolvedValueOnce(book);
    renderDetail(`/library/books/${book.id}`);

    expect(await screen.findByRole("alert", {name:"错误页面"})).toHaveTextContent("503");
    expect(screen.getByRole("alert")).toHaveTextContent("BOOK_UNAVAILABLE");
    expect(screen.getByRole("alert")).toHaveTextContent("book-request-123456");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(await screen.findByRole("heading", { level: 2, name: book.title })).toBeInTheDocument();
    await waitFor(() => expect(getBook).toHaveBeenCalledTimes(2));
  });

  it("shows all book metadata fields when values are available", async () => {
    const book = demoBooks[0];
    const metadata: BookMetadata = {
      id: book.id,
      title: "完整书目标题",
      subtitle: "副标题示例",
      authors: ["作者甲", "作者乙"],
      translators: ["译者丙"],
      language: "中文",
      publisher: "示例出版社",
      publishedDate: "2025-03-12",
      isbn: "978-7-0000-0000-0",
      description: "来自元数据的完整简介。",
      series: "测试系列",
      seriesIndex: 3,
      tags: ["文学", "藏书"],
      subjectCodes: ["FB"],
      publiclyVisible: false,
      sources: {},
    };
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    vi.mocked(api.getBookMetadata).mockResolvedValue(metadata);
    renderDetail(`/library/books/${book.id}`, member);

    const bibliography = await screen.findByRole("region", { name: "书目资料" });
    for (const value of [
      "译者丙", "中文", "示例出版社",
      "2025年03月", "978-7-0000-0000-0", "测试系列", "3", "文学、藏书",
      "小说（F） / 文学与一般小说（FB）", "仅书库内可见",
    ]) {
      expect(within(bibliography).getByText(value)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { level: 2, name: "完整书目标题" })).toBeInTheDocument();
    for (const value of ["完整书目标题", "副标题示例", "作者甲 / 作者乙"]) {
      expect(screen.getAllByText(value)).toHaveLength(1);
      expect(within(bibliography).queryByText(value)).not.toBeInTheDocument();
    }
    expect(screen.getByText("来自元数据的完整简介。")).toBeInTheDocument();
  });

  it("shows a placeholder for each missing book metadata field", async () => {
    const book = demoBooks[0];
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    vi.mocked(api.getBookMetadata).mockResolvedValue({
      id: book.id,
      title: book.title,
      authors: [],
      translators: [],
      tags: [],
      sources: {},
    });
    renderDetail(`/library/books/${book.id}`, member);

    const bibliography = await screen.findByRole("region", { name: "书目资料" });
    expect(within(bibliography).getAllByText("—")).toHaveLength(10);
    const description = await screen.findByRole("region", { name: "内容简介" });
    expect(within(description).getByText("—")).toBeInTheDocument();
  });

  it("retries failed metadata independently from the book request", async () => {
    const book = demoBooks[0];
    const getBook = vi.spyOn(api, "getBook").mockResolvedValue(book);
    let rejectMetadata: ((reason: Error) => void) | undefined;
    const getBookMetadata = vi.mocked(api.getBookMetadata).mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectMetadata = reject;
    }));
    renderDetail(`/library/books/${book.id}`, member);

    await screen.findByRole("region", { name: "书目资料" });
    await waitFor(() => expect(rejectMetadata).toBeTypeOf("function"));
    await act(async () => rejectMetadata?.(new Error("元数据暂时不可用")));
    expect(await screen.findByText("书目资料暂时无法加载。")).toBeInTheDocument();
    const retryMetadata = screen.getByRole("button", { name: "重试元数据" });
    getBookMetadata.mockResolvedValue(metadataForBook(book));
    fireEvent.click(retryMetadata);

    const loadedBibliography = await screen.findByRole("region", { name: "书目资料" });
    expect(await within(loadedBibliography).findByText("BookKin典藏")).toBeInTheDocument();
    await waitFor(() => expect(getBookMetadata).toHaveBeenCalledTimes(2));
    expect(getBook).toHaveBeenCalledTimes(1);
  });

  it("opens a separate detail route from a filtered catalog and returns with filters intact", async () => {
    const book = demoBooks[1];
    vi.spyOn(api, "listBooks").mockResolvedValue({ items: [book] });
    vi.spyOn(api, "getBook").mockResolvedValue(book);
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    render(
      <TestProviders initialPath="/library/all?q=夜航&format=PDF&sort=title">
        <>
          <Routes>
            <Route path="/library/all" element={<LibraryPage />} />
            <Route path="/library/books/:bookId" element={<BookDetailPage />} />
          </Routes>
          <RouteLocation />
        </>
      </TestProviders>,
    );

    fireEvent.click(await screen.findByRole("button", { name: `${book.title}封面` }));

    expect(await screen.findByRole("heading", { level: 2, name: book.title })).toBeInTheDocument();
    expect(screen.getByTestId("route-location")).toHaveTextContent(`/library/books/${book.id}`);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回书库" }));

    await waitFor(() => expect(screen.getByTestId("route-location")).toHaveTextContent("/library/all?q=夜航&format=PDF&sort=title"));
    expect(await screen.findByRole("heading", { name: "全部藏书" })).toBeInTheDocument();
  });
});
