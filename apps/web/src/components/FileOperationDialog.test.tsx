// 覆盖禁用移动、重命名预览、回收二次确认及失败恢复，避免错误后永久停在忙状态。
// Covers disabled moves, rename previews, second trash confirmation and recovery from failed execution without a stuck busy state.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { api, ApiRequestError } from "../api/client";
import { demoBooks } from "../data/demo";
import type { FileOperationPreview } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { FileOperationDialog } from "./FileOperationDialog";

function renamePreview(overrides: Partial<FileOperationPreview> = {}): FileOperationPreview {
  return { previewToken: "rename-check", type: "RENAME", sourcePath: "library/old.epub", targetPath: "library/new.epub", expectedFingerprint: "fingerprint", requiredBytes: 0, expiresAt: new Date(Date.now() + 300_000).toISOString(), conflicts: [], warnings: [], ...overrides };
}

describe("FileOperationDialog", () => {
  afterEach(() => vi.restoreAllMocks());
  it("旧移动状态不打开弹窗或请求文件操作", () => {
    const roots = vi.spyOn(api, "listLibraryRoots");
    const prepare = vi.spyOn(api, "previewFileOperation");
    const execute = vi.spyOn(api, "executeFileOperation");
    render(<TestProviders><FileOperationDialog book={demoBooks[0]} type="MOVE" onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(roots).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("重命名只输入书名，路径和扩展名交给服务端计算", async () => {
    const previewRequest = vi.spyOn(api, "previewFileOperation").mockResolvedValue({
      previewToken: "rename-preview",
      type: "RENAME",
      sourcePath: `${demoBooks[0].libraryRoot}/${demoBooks[0].relativePath}`,
      targetPath: `${demoBooks[0].libraryRoot}/顾远/新书名.epub`,
      requiredBytes: 0,
      expectedFingerprint: demoBooks[0].fingerprint,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      conflicts: [],
      warnings: [],
    } satisfies FileOperationPreview);
    render(
      <TestProviders>
        <FileOperationDialog book={demoBooks[0]} type="RENAME" onClose={() => undefined} onCompleted={vi.fn()} />
      </TestProviders>,
    );

    const input = screen.getByRole("textbox", { name: "新书名" });
    expect(input).toHaveValue(demoBooks[0].title);
    expect(input).not.toHaveValue(`${demoBooks[0].author}/${demoBooks[0].title}.${demoBooks[0].format.toLowerCase()}`);
    fireEvent.change(input, { target: { value: "新书名" } });

    await waitFor(() => expect(previewRequest).toHaveBeenCalledWith(demoBooks[0], "RENAME", "新书名"));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认重命名" })).toBeEnabled());
    expect(screen.queryByText("目标路径")).not.toBeInTheDocument();
    expect(screen.queryByText("预期指纹")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更新预览" })).not.toBeInTheDocument();
  });

  it("automatically checks a metadata title that differs from the current filename", async () => {
    const prepare = vi.spyOn(api, "previewFileOperation").mockResolvedValue(renamePreview());
    const book = { ...demoBooks[0], title: "元数据新书名", relativePath: "作者/原文件名.epub" };
    render(<TestProviders><FileOperationDialog book={book} type="RENAME" onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
    await waitFor(() => expect(prepare).toHaveBeenCalledWith(book, "RENAME", "元数据新书名"));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认重命名" })).toBeEnabled());
  });

  it("does not check or execute an unchanged or invalid name", async () => {
    const prepare = vi.spyOn(api, "previewFileOperation");
    const execute = vi.spyOn(api, "executeFileOperation");
    render(<TestProviders><FileOperationDialog book={demoBooks[0]} type="RENAME" onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
    expect(screen.getByRole("button", { name: "确认重命名" })).toBeDisabled();
    expect(screen.queryByText("书名未变化")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认重命名" }));
    fireEvent.change(screen.getByRole("textbox", { name: "新书名" }), { target: { value: "../outside" } });
    expect(screen.getByRole("button", { name: "确认重命名" })).toBeDisabled();
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(prepare).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("refreshes an expired check automatically before executing", async () => {
    const prepare = vi.spyOn(api, "previewFileOperation").mockResolvedValueOnce(renamePreview({ expiresAt: new Date(0).toISOString() })).mockResolvedValueOnce(renamePreview({ previewToken: "fresh-check" }));
    const execute = vi.spyOn(api, "executeFileOperation").mockResolvedValue({ id: "renamed", type: "RENAME", status: "PLANNED", sourcePath: "library/old.epub", createdAt: new Date().toISOString() });
    render(<TestProviders><FileOperationDialog book={demoBooks[0]} type="RENAME" onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
    fireEvent.change(screen.getByRole("textbox", { name: "新书名" }), { target: { value: "新书名" } });
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认重命名" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "确认重命名" }));
    await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ previewToken: "fresh-check", expectedFingerprint: "fingerprint" })));
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it("retries a timed-out execution with the same token even after its preview expires", async () => {
    const checked = renamePreview();
    const prepare = vi.spyOn(api, "previewFileOperation").mockResolvedValue(checked);
    const execute = vi.spyOn(api, "executeFileOperation").mockRejectedValueOnce(new Error("请求超时")).mockResolvedValueOnce({ id: "renamed", type: "RENAME", status: "PLANNED", sourcePath: "library/old.epub", createdAt: new Date().toISOString() });
    render(<TestProviders><FileOperationDialog book={demoBooks[0]} type="RENAME" onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
    fireEvent.change(screen.getByRole("textbox", { name: "新书名" }), { target: { value: "新书名" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "确认重命名" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "确认重命名" }));
    expect(await screen.findByText("请求超时")).toBeInTheDocument();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(checked.expiresAt) + 1);
    fireEvent.click(screen.getByRole("button", { name: "确认重命名" }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(execute.mock.calls[0][0]).toBe(checked);
    expect(execute.mock.calls[1][0]).toBe(checked);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("discards a definitely rejected expired token and rechecks on the next confirmation", async () => {
    const prepare = vi.spyOn(api, "previewFileOperation").mockResolvedValueOnce(renamePreview()).mockResolvedValueOnce(renamePreview({ previewToken: "replacement-check" }));
    const execute = vi.spyOn(api, "executeFileOperation").mockRejectedValueOnce(new ApiRequestError("预览已过期", 409, "PREVIEW_EXPIRED")).mockResolvedValueOnce({ id: "renamed", type: "RENAME", status: "PLANNED", sourcePath: "library/old.epub", createdAt: new Date().toISOString() });
    render(<TestProviders><FileOperationDialog book={demoBooks[0]} type="RENAME" onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
    fireEvent.change(screen.getByRole("textbox", { name: "新书名" }), { target: { value: "新书名" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "确认重命名" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "确认重命名" }));
    expect(await screen.findByText("预览已过期")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认重命名" }));
    await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ previewToken: "replacement-check" })));
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it("ignores an old name check and never executes a server-resolved unchanged path", async () => {
    let resolveOld!: (value: FileOperationPreview) => void;
    const prepare = vi.spyOn(api, "previewFileOperation").mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(renamePreview({ sourcePath: "same.epub", targetPath: "same.epub" }));
    const execute = vi.spyOn(api, "executeFileOperation");
    render(<TestProviders><FileOperationDialog book={demoBooks[0]} type="RENAME" onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
    const input = screen.getByRole("textbox", { name: "新书名" });
    fireEvent.change(input, { target: { value: "旧请求" } });
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: "新请求" } });
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(2));
    resolveOld(renamePreview());
    await waitFor(() => expect(screen.getByRole("button", { name: "确认重命名" })).toBeDisabled());
    expect(screen.queryByText("书名未变化")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认重命名" })).toBeDisabled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("retries a failed automatic check when the user confirms", async () => {
    const prepare = vi.spyOn(api, "previewFileOperation").mockRejectedValueOnce(new Error("检查暂时失败")).mockResolvedValueOnce(renamePreview());
    const execute = vi.spyOn(api, "executeFileOperation").mockResolvedValue({ id: "renamed", type: "RENAME", status: "PLANNED", sourcePath: "library/old.epub", createdAt: new Date().toISOString() });
    render(<TestProviders><FileOperationDialog book={demoBooks[0]} type="RENAME" onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
    fireEvent.change(screen.getByRole("textbox", { name: "新书名" }), { target: { value: "新书名" } });
    expect(await screen.findByText("检查暂时失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认重命名" }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it("automatically prepares the trash preview and waits for the second confirmation", async () => {
    const completed = vi.fn();
    render(
      <TestProviders>
        <FileOperationDialog book={demoBooks[0]} type="TRASH" onClose={() => undefined} onCompleted={completed} />
      </TestProviders>,
    );

    const execute = screen.getByRole("button", { name: "确认移入回收站" });
    expect(execute).toBeDisabled();
    expect(screen.queryByRole("button", { name: "预览" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/文件保留 30 天/)).toBeInTheDocument());
    expect(screen.queryByText("预览已生成")).not.toBeInTheDocument();
    expect(screen.queryByText("预期指纹")).not.toBeInTheDocument();
    expect(screen.queryByText("空间需求")).not.toBeInTheDocument();
    expect(screen.queryByText("重新检查")).not.toBeInTheDocument();
    expect(execute).toBeEnabled();
    expect(completed).not.toHaveBeenCalled();
    fireEvent.click(execute);
    await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
  });

  it("执行请求失败后恢复操作，不会永久卡在删除中", async () => {
    const execute = vi.spyOn(api, "executeFileOperation").mockRejectedValueOnce(new Error("请求超时，请刷新后重试。"));
    render(
      <TestProviders>
        <FileOperationDialog book={demoBooks[1]} type="TRASH" onClose={() => undefined} onCompleted={vi.fn()} />
      </TestProviders>,
    );

    const confirm = await screen.findByRole("button", { name: "确认移入回收站" });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    expect(await screen.findByText("请求超时，请刷新后重试。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认移入回收站" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
