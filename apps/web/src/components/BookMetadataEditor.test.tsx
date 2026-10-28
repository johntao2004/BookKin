// 覆盖乐观保存、文件写回确认、公开状态与重置封面取消，区分普通资料保存和后果较大的动作。
// Covers optimistic saves, writeback confirmation, visibility and cancelled cover resets, separating ordinary edits from consequential actions.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { useEffect, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Book, BookKnowledgeDraft, BookMetadata, FileOperation, FileOperationPreview, ReadingOverview } from "../domain/types";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { BookMetadataEditor } from "./BookMetadataEditor";

function CacheFixture({capture}: {capture: (client: QueryClient) => void}) {
  const client = useQueryClient();
  useEffect(() => {
    capture(client);
    const book = demoBooks[0];
    client.setQueryData(["books", "catalog"], {pages: [{items: [book]}], pageParams: [undefined]});
    client.setQueryData(["books", "overview"], {
      today: "2026-10-22", featuredBook: book,
      recentReading: [{book, position: {bookId: book.id, locator: "pdf:page=12", progress: 0.2}}],
      stats: {weekStart: "2026-10-19", weekEnd: "2026-10-25", totalSeconds: 0, previousWeekSeconds: 0, days: []},
    } satisfies ReadingOverview);
  }, [capture, client]);
  return null;
}

function MetadataConsumerCacheFixture({ capture }: { capture: (client: QueryClient) => void }) {
  const client = useQueryClient();
  useEffect(() => {
    capture(client);
    const book = demoBooks[0];
    const summary = { id: book.id, title: book.title, author: book.author, description: book.description, format: book.format, coverUrl: book.coverUrl, available: true, addedAt: "2026-10-22" };
    client.setQueryData(["book", book.id, "owner"], book);
    client.setQueryData(["booklists", "owner", ""], { items: [{ id: "list-1", previewBooks: [summary] }] });
    client.setQueryData(["booklist-books", "list-1", "owner", "", "ALL"], { pages: [{ items: [summary] }], pageParams: [undefined] });
  }, [capture, client]);
  return null;
}

function MutableBookMetadataEditor({ capture }: { capture: (updateBook: (book: Book) => void) => void }) {
  const [book, setBook] = useState<Book>(demoBooks[0]);
  useEffect(() => capture(setBook), [capture]);
  return <BookMetadataEditor book={book} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />;
}

describe("BookMetadataEditor", () => {
  beforeEach(() => sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "owner", username: "owner", displayName: "主人", role: "OWNER", mustChangePassword: false })));
  afterEach(() => vi.restoreAllMocks());

  it("uses the shared detail form with actions at the bottom of the form", async () => {
    render(
      <TestProviders>
        <BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );

    const title = await screen.findByRole("textbox", { name: "书名" });
    expect(title).toHaveValue(demoBooks[0].title);
    expect(title.tagName).toBe("TEXTAREA");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("不勾选时只修改BookKin的展示信息。写回会先生成安全预览，确认后直接覆盖当前原文件，不保留历史版本。")).not.toBeInTheDocument();
    const cover = screen.getByRole("img", { name: "当前书籍封面" });
    expect(Boolean(cover.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    const authors = screen.getByRole("textbox", { name: "作者" });
    const save = screen.getByRole("button", { name: "保存" });
    expect(screen.getByRole("region", { name: "书目资料" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "保存" })).toHaveLength(1);
    expect(Boolean(authors.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(screen.getByRole("textbox", { name: "作者介绍" }).compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getByRole("textbox", { name: "内容简介" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "作者介绍" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "内容简介" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "作者介绍" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "目录" })).not.toBeInTheDocument();
  });

  it("waits for a detail save to succeed, updates book and booklist caches, and preserves untouched fallback sources", async () => {
    let client: QueryClient | undefined;
    let resolveSave: ((value: Awaited<ReturnType<typeof api.updateBookMetadata>>) => void) | undefined;
    const original = await api.getBookMetadata(demoBooks[0].id);
    const metadata: BookMetadata = {
      ...original,
      authorBiography: undefined,
      tableOfContents: undefined,
      sources: { ...original.sources, authorBiography: "FILE", tableOfContents: "FILE" },
    };
    vi.spyOn(api, "getBookMetadata").mockResolvedValue(metadata);
    const saveRequest = vi.spyOn(api, "updateBookMetadata").mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    const close = vi.fn();
    const saved = vi.fn();
    render(
      <TestProviders>
        <MetadataConsumerCacheFixture capture={(value) => { client = value; }} />
        <BookMetadataEditor book={demoBooks[0]} layout="detail"
          bibliographyFallback={{ authorBiography: "原书作者介绍", tableOfContents: "原书目录" }}
          onClose={close} onCompleted={vi.fn()} onSavedImmediately={saved} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );

    await screen.findByDisplayValue("原书作者介绍");
    expect(screen.queryByRole("textbox", { name: "目录" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "保存" })).toHaveLength(1);
    fireEvent.change(screen.getByRole("textbox", { name: "书名" }), { target: { value: "详情新标题" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(close).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    await waitFor(() => expect(saveRequest).toHaveBeenCalledWith(demoBooks[0], expect.objectContaining({
      manualFields: ["title"], authorBiography: undefined, tableOfContents: undefined,
    })));
    expect(client!.getQueryData<Book>(["book", demoBooks[0].id, "owner"])?.title).toBe("详情新标题");

    resolveSave?.({ metadata: { ...metadata, title: "详情新标题", sources: { ...metadata.sources, title: "MANUAL" } } });
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(saved).toHaveBeenCalledWith("书籍展示信息已保存");
    expect(client!.getQueryData<Book>(["book", demoBooks[0].id, "owner"])?.title).toBe("详情新标题");
    expect(client!.getQueryData<{ items: { previewBooks: { title: string }[] }[] }>(["booklists", "owner", ""])?.items[0].previewBooks[0].title).toBe("详情新标题");
    expect(client!.getQueryData<{ pages: { items: { title: string }[] }[] }>(["booklist-books", "list-1", "owner", "", "ALL"])?.pages[0].items[0].title).toBe("详情新标题");
  });

  it("persists evidence-backed knowledge-point changes in the metadata save", async () => {
    const original = await api.getBookMetadata(demoBooks[0].id);
    const existing = { name: "已有知识点", quote: "现有的原文证据。", locator: "page:1" };
    const removed = { name: "准备删除", quote: "另一段原文证据。", locator: "page:2" };
    const initialDraft: BookKnowledgeDraft = { points: [existing, removed], fingerprint: "sha256:book", sampledSections: 2, totalSections: 6 };
    const savedDraft: BookKnowledgeDraft = { ...initialDraft, points: [removed] };
    vi.spyOn(api, "getBookMetadata").mockResolvedValue(original);
    vi.spyOn(api, "getBookKnowledge").mockResolvedValue(initialDraft);
    const save = vi.spyOn(api, "updateBookMetadata").mockResolvedValue({ metadata: { ...original, knowledgeDraft: savedDraft } });
    render(<TestProviders><BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} /></TestProviders>);

    await screen.findByText(existing.name);
    const knowledgeSelect = screen.getByRole("combobox", { name: "知识点" }).closest(".ant-select")!;
    const existingChip = [...knowledgeSelect.querySelectorAll(".ant-select-selection-item")].find(item => item.textContent?.includes(existing.name));
    const remove = existingChip?.querySelector(".ant-select-selection-item-remove");
    expect(remove).toBeTruthy();
    fireEvent.mouseDown(remove!);
    fireEvent.click(remove!);
    await waitFor(() => expect(screen.queryByText(existing.name)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(demoBooks[0], expect.objectContaining({ knowledgeDraft: savedDraft })));
  });

  it.each(["page", "detail"] as const)("keeps the %s draft and shows a persistent local error when persistence fails", async layout => {
    const rejectSave = vi.spyOn(api, "updateBookMetadata").mockRejectedValueOnce(new Error("保存失败"));
    const close = vi.fn();
    const saved = vi.fn();
    const failed = vi.fn();
    render(
      <TestProviders>
        <BookMetadataEditor book={demoBooks[0]} layout={layout} onClose={close} onCompleted={vi.fn()} onSavedImmediately={saved} onSaveFailed={failed} />
      </TestProviders>,
    );

    await screen.findByDisplayValue(demoBooks[0].title);
    fireEvent.change(screen.getByRole("textbox", { name: "书名" }), { target: { value: "保留的详情草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByText("保存失败");

    expect(rejectSave).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox", { name: "书名" })).toHaveValue("保留的详情草稿");
    expect(close).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith("元数据保存失败，已恢复原内容：保存失败");
  });

  it("cancels detail editing without calling the metadata API", async () => {
    const save = vi.spyOn(api, "updateBookMetadata");
    const close = vi.fn();
    render(
      <TestProviders>
        <BookMetadataEditor book={demoBooks[0]} layout="detail" onClose={close} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );

    await screen.findByDisplayValue(demoBooks[0].title);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(close).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });

  it("marks only edited bibliography fallbacks as manual and never replaces manual-source values", async () => {
    const original = await api.getBookMetadata(demoBooks[0].id);
    const fallbackMetadata: BookMetadata = {
      ...original,
      authorBiography: undefined,
      tableOfContents: undefined,
      sources: { ...original.sources, authorBiography: "FILE", tableOfContents: "FILE" },
    };
    vi.spyOn(api, "getBookMetadata").mockResolvedValue(fallbackMetadata);
    const save = vi.spyOn(api, "updateBookMetadata").mockResolvedValue({ metadata: fallbackMetadata });
    render(
      <TestProviders>
        <BookMetadataEditor book={demoBooks[0]} layout="detail"
          bibliographyFallback={{ authorBiography: "原书作者介绍", tableOfContents: "原书目录" }}
          onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );
    await screen.findByDisplayValue("原书作者介绍");
    fireEvent.change(screen.getByRole("textbox", { name: "作者介绍" }), { target: { value: "人工作者介绍" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(demoBooks[0], expect.objectContaining({
      manualFields: ["authorBiography"],
      authorBiography: "人工作者介绍", tableOfContents: undefined,
    })));

  });

  it("does not show bibliography fallbacks when the persisted source is MANUAL", async () => {
    const original = await api.getBookMetadata(demoBooks[0].id);
    const manualMetadata: BookMetadata = {
      ...original,
      authorBiography: undefined,
      tableOfContents: undefined,
      sources: { ...original.sources, authorBiography: "MANUAL", tableOfContents: "MANUAL" },
    };
    vi.spyOn(api, "getBookMetadata").mockResolvedValue(manualMetadata);
    const save = vi.spyOn(api, "updateBookMetadata").mockResolvedValue({ metadata: manualMetadata });
    render(
      <TestProviders>
        <BookMetadataEditor book={demoBooks[0]} layout="detail"
          bibliographyFallback={{ authorBiography: "不应覆盖的作者介绍", tableOfContents: "不应覆盖的目录" }}
          onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );
    await screen.findByRole("textbox", { name: "作者介绍" });
    expect(screen.getByRole("textbox", { name: "作者介绍" })).toHaveValue("");
    expect(screen.queryByRole("textbox", { name: "目录" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "书名" }), { target: { value: "其他书名" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(demoBooks[0], expect.objectContaining({
      manualFields: ["title"],
    })));
  });

  it("lets file managers open and cancel the existing original-file rename dialog", async () => {
    const previewRequest = vi.spyOn(api, "previewFileOperation");
    render(
      <TestProviders>
        <BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );

    await screen.findByDisplayValue(demoBooks[0].title);
    fireEvent.click(screen.getByRole("button", { name: "重命名原文件" }));
    const dialog = screen.getByRole("dialog", { name: /重命名书籍/ });
    expect(dialog).toBeInTheDocument();
    expect(previewRequest).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog", { name: /重命名书籍/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  it("hides original-file rename from users without the file permission", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "member", username: "member", displayName: "成员", role: "MEMBER", mustChangePassword: false }));
    render(
      <TestProviders>
        <BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );

    await screen.findByDisplayValue(demoBooks[0].title);
    expect(screen.queryByRole("button", { name: "重命名原文件" })).not.toBeInTheDocument();
  });

  it("preserves an unsaved metadata draft when the same book refreshes with a new file path", async () => {
    let updateBook: ((book: Book) => void) | undefined;
    const capture = (update: (book: Book) => void) => { updateBook = update; };
    render(<TestProviders><MutableBookMetadataEditor capture={capture} /></TestProviders>);

    const titleInput = await screen.findByRole("textbox", { name: "书名" });
    fireEvent.change(titleInput, { target: { value: "未保存的书名草稿" } });
    act(() => updateBook?.({ ...demoBooks[0], relativePath: "顾远/新文件名.epub" }));

    expect(screen.getByRole("textbox", { name: "书名" })).toHaveValue("未保存的书名草稿");
  });

  it("uses the safe rename preview and refreshes book caches without calling a queued task complete", async () => {
    let client: QueryClient | undefined;
    const capture = (value: QueryClient) => { client = value; };
    const previewRequest = vi.spyOn(api, "previewFileOperation").mockResolvedValue({
      previewToken: "rename-preview",
      type: "RENAME",
      sourcePath: `${demoBooks[0].libraryRoot}/${demoBooks[0].relativePath}`,
      targetPath: `${demoBooks[0].libraryRoot}/新书名.${demoBooks[0].format.toLowerCase()}`,
      requiredBytes: 0,
      expectedFingerprint: demoBooks[0].fingerprint,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      conflicts: [],
      warnings: [],
    } satisfies FileOperationPreview);
    vi.spyOn(api, "executeFileOperation").mockResolvedValue({
      id: "rename-operation",
      type: "RENAME",
      status: "PLANNED",
      sourcePath: `${demoBooks[0].libraryRoot}/${demoBooks[0].relativePath}`,
      targetPath: `${demoBooks[0].libraryRoot}/新书名.${demoBooks[0].format.toLowerCase()}`,
      createdAt: new Date().toISOString(),
    } satisfies FileOperation);
    const completed = vi.fn();
    render(
      <TestProviders>
        <CacheFixture capture={capture} />
        <BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={completed} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );

    await screen.findByDisplayValue(demoBooks[0].title);
    const invalidate = vi.spyOn(client!, "invalidateQueries").mockResolvedValue();
    fireEvent.click(screen.getByRole("button", { name: "重命名原文件" }));
    fireEvent.change(screen.getByRole("textbox", { name: "新书名" }), { target: { value: "新书名" } });
    fireEvent.click(screen.getByRole("button", { name: "预览" }));
    await waitFor(() => expect(previewRequest).toHaveBeenCalledWith(demoBooks[0], "RENAME", "新书名"));
    await screen.findByText("预览已生成");
    fireEvent.click(screen.getByRole("button", { name: "确认重命名" }));

    await waitFor(() => expect(completed).toHaveBeenCalledWith("重命名任务已提交，可在文件任务页查看进度"));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["book", demoBooks[0].id] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["book-metadata", demoBooks[0].id] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["books"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["display-books"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["file-operations"] });
  });

  it("reports failed rename tasks through the persistent error callback", async () => {
    vi.spyOn(api, "previewFileOperation").mockResolvedValue({
      previewToken: "rename-preview-failed",
      type: "RENAME",
      sourcePath: `${demoBooks[0].libraryRoot}/${demoBooks[0].relativePath}`,
      targetPath: `${demoBooks[0].libraryRoot}/新书名.${demoBooks[0].format.toLowerCase()}`,
      requiredBytes: 0,
      expectedFingerprint: demoBooks[0].fingerprint,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      conflicts: [],
      warnings: [],
    } satisfies FileOperationPreview);
    vi.spyOn(api, "executeFileOperation").mockResolvedValue({
      id: "rename-operation-failed",
      type: "RENAME",
      status: "FAILED",
      sourcePath: `${demoBooks[0].libraryRoot}/${demoBooks[0].relativePath}`,
      createdAt: new Date().toISOString(),
    } satisfies FileOperation);
    const completed = vi.fn();
    const failed = vi.fn();
    render(
      <TestProviders>
        <BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={completed} onSavedImmediately={vi.fn()} onSaveFailed={failed} />
      </TestProviders>,
    );

    await screen.findByDisplayValue(demoBooks[0].title);
    fireEvent.click(screen.getByRole("button", { name: "重命名原文件" }));
    fireEvent.click(screen.getByRole("button", { name: "预览" }));
    await screen.findByText("预览已生成");
    fireEvent.click(screen.getByRole("button", { name: "确认重命名" }));

    await waitFor(() => expect(failed).toHaveBeenCalledWith("重命名任务未完成，可在文件任务页查看结果"));
    expect(completed).not.toHaveBeenCalled();
  });

  it("waits for an ordinary metadata edit to persist before reporting success and closing", async () => {
    let resolveUpdate: ((value: Awaited<ReturnType<typeof api.updateBookMetadata>>) => void) | undefined;
    const updateMetadata = vi.spyOn(api, "updateBookMetadata").mockImplementationOnce(() => new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    const savedImmediately = vi.fn();
    const failed = vi.fn();
    const closed = vi.fn();
    render(
      <TestProviders>
        <BookMetadataEditor
          book={demoBooks[0]}
          onClose={closed}
          onCompleted={vi.fn()}
          onSavedImmediately={savedImmediately}
          onSaveFailed={failed}
        />
      </TestProviders>,
    );

    const titleInput = await screen.findByDisplayValue(demoBooks[0].title);
    fireEvent.change(titleInput, { target: { value: "即时标题" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(updateMetadata).toHaveBeenCalledWith(demoBooks[0], expect.objectContaining({ manualFields: ["title"] }));
    expect(savedImmediately).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    resolveUpdate?.({
      metadata: {
        id: demoBooks[0].id,
        title: "即时标题",
        authors: [demoBooks[0].author],
        translators: [],
        description: demoBooks[0].description,
        tags: demoBooks[0].tags,
        sources: {},
      },
    });
    await waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
    expect(savedImmediately).toHaveBeenCalledWith("书籍展示信息已保存");
  });

  it("separates database save from the confirmed file writeback", async () => {
    const completed = vi.fn();
    const closed = vi.fn();
    render(
      <TestProviders>
        <BookMetadataEditor book={demoBooks[0]} onClose={closed} onCompleted={completed} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );

    await screen.findByDisplayValue(demoBooks[0].title);
    fireEvent.click(screen.getByRole("checkbox", { name: `同时写回 ${demoBooks[0].format} 原文件` }));
    fireEvent.click(screen.getByRole("button", { name: "保存并预览" }));

    await screen.findByText("是否将刚刚保存的元信息同步到原文件？");
    expect(screen.getByRole("heading", { name: "确认写回原文件" })).toBeInTheDocument();
    expect(screen.queryByText("展示信息已保存。下面是原文件写回计划，确认前不会修改书籍文件。")).not.toBeInTheDocument();
    expect(screen.queryByText("源文件")).not.toBeInTheDocument();
    expect(screen.queryByText("预期指纹")).not.toBeInTheDocument();
    expect(screen.queryByText("写回会校验临时文件后直接覆盖当前原文件，不保留历史版本。")).not.toBeInTheDocument();
    expect(screen.queryByText("预览 5 分钟内有效；执行时会再次校验指纹和读取租约。")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认写回原文件" }));

    await waitFor(() => expect(completed).toHaveBeenCalledWith("元数据已写回文件"));
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it("updates overview book metadata alongside catalog caches and rolls both back after failure", async () => {
    let client: QueryClient | undefined;
    let rejectSave: ((reason: Error) => void) | undefined;
    const capture = (value: QueryClient) => {client = value;};
    vi.spyOn(api, "updateBookMetadata").mockImplementationOnce(() => new Promise((_, reject) => {rejectSave = reject;}));
    const failed = vi.fn();
    render(<TestProviders><CacheFixture capture={capture} /><BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={failed} /></TestProviders>);
    await screen.findByDisplayValue(demoBooks[0].title);
    fireEvent.change(screen.getByRole("textbox", {name: "书名"}), {target: {value: "更新书名"}});
    fireEvent.click(screen.getByRole("button", {name: "保存"}));
    const optimistic = client!.getQueryData<ReadingOverview>(["books", "overview"])!;
    expect(optimistic.featuredBook?.title).toBe("更新书名");
    expect(optimistic.recentReading[0].book.title).toBe("更新书名");
    expect(optimistic.recentReading[0].position.locator).toBe("pdf:page=12");
    rejectSave!(new Error("save failed"));
    await waitFor(() => expect(failed).toHaveBeenCalled());
    expect(client!.getQueryData<ReadingOverview>(["books", "overview"])!.featuredBook?.title).toBe(demoBooks[0].title);
    expect(client!.getQueryData<{pages: {items: typeof demoBooks}[]}>(["books", "catalog"])!.pages[0].items[0].title).toBe(demoBooks[0].title);
  });

});

it('loads the actual public choice and saves an explicit visibility change with metadata', async () => {
  const original = await api.getBookMetadata(demoBooks[0].id);
  vi.spyOn(api, 'getBookMetadata').mockResolvedValue({...original, publiclyVisible: true});
  const save = vi.spyOn(api, 'updateBookMetadata').mockResolvedValue({metadata: {...original, publiclyVisible: false}});
  render(<TestProviders><BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} /></TestProviders>);
  await screen.findByDisplayValue(demoBooks[0].title);
  const toggle = screen.getByRole('switch', {name: '公开展示'});
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', {name: '保存'}));
  await waitFor(() => expect(save).toHaveBeenCalledWith(demoBooks[0], expect.objectContaining({publiclyVisible: false})));
});

it("requires confirmation before restoring the cover and leaves cancellation untouched", async () => {
  const reset = vi.spyOn(api, "resetBookCover").mockResolvedValue();
  render(<TestProviders><BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} /></TestProviders>);
  await screen.findByDisplayValue(demoBooks[0].title);
  fireEvent.click(screen.getByRole("button", { name: "恢复默认封面" }));
  expect(screen.getByRole("dialog", { name: "恢复默认封面？" })).toBeInTheDocument();
  expect(reset).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog", { name: "恢复默认封面？" })).getByRole("button", { name: "取消" }));
  expect(reset).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "恢复默认封面" }));
  fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));
  await waitFor(() => expect(reset).toHaveBeenCalledExactlyOnceWith(demoBooks[0].id));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "恢复默认封面？" })).not.toBeInTheDocument());

});

it('preserves deep subject codes during unrelated edits and saves expanded bibliography explicitly', async () => {
  const original = await api.getBookMetadata(demoBooks[0].id);
  vi.spyOn(api, 'getBookMetadata').mockResolvedValue({ ...original, subjectCodes: ['RNKH2'], authorBiography: '原作者介绍', tableOfContents: '原目录' });
  const save = vi.spyOn(api, 'updateBookMetadata').mockResolvedValue({ metadata: original });
  render(<TestProviders><BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} /></TestProviders>);
  const biography = await screen.findByDisplayValue('原作者介绍');
  fireEvent.change(biography, { target: { value: '新的作者介绍' } });
  expect(screen.queryByRole('textbox', { name: '目录' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(demoBooks[0], expect.objectContaining({ subjectCodes: ['RNKH2'], authorBiography: '新的作者介绍', tableOfContents: '原目录', manualFields: ['authorBiography'] })));
});
