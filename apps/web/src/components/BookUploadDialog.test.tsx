// 验证局域网 HTTP 上传与键盘选文件入口，上传成功后进入持久校对路由而非直接假定入库。
// Checks LAN-HTTP upload and keyboard file selection, leading to persistent review rather than assuming catalog commit.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { TestProviders } from "../test/TestProviders";
import { api } from "../api/client";
import { BookUploadDialog } from "./BookUploadDialog";

vi.mock("../features/uploads/file-fingerprint", () => ({ fileFingerprint: vi.fn(async () => "sha256:" + "a".repeat(64)) }));
import { fileFingerprint } from "../features/uploads/file-fingerprint";
beforeEach(() => { vi.spyOn(api, "precheckBookUpload").mockResolvedValue({ match: "NONE" }); });

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Location() { const location = useLocation(); return <><output>{location.pathname}</output><output data-testid="upload-state">{JSON.stringify(location.state)}</output></>; }
it("automatically uploads on LAN HTTP and confirms into a persistent editor route", async () => {
  vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
  vi.spyOn(api, "listLibraryRoots").mockResolvedValue([{ id: "root", name: "主书库", status: "ONLINE", canWrite: true, canStage: true } as any]);
  vi.spyOn(api, "listBookUploads").mockResolvedValue([]);
  const create = vi.spyOn(api, "createBookUpload").mockResolvedValue({ id: "upload-test" } as any);
  const transfer = vi.spyOn(api, "uploadBookContent").mockResolvedValue({ id: "upload-test", status: "INSPECTING" } as any);
  render(<TestProviders><BookUploadDialog open onClose={vi.fn()} onCompleted={vi.fn()} /><Location /></TestProviders>);
  await waitFor(() => expect(screen.getByRole('button', { name: '开始上传' })).toBeEnabled());
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['test'], 'upload-check.pdf', { type: 'application/pdf' })] } });
  await waitFor(() => expect(transfer).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledWith({ libraryRootId: "root", filename: "upload-check.pdf", sizeBytes: 4 });
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(await screen.findByText(/已上传。你可以更改/)).toBeInTheDocument();
  expect(screen.queryByText('识别与入库队列')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '编辑信息' }));
  expect(screen.getByText('/library/uploads/upload-test')).toBeInTheDocument();
  expect(screen.getByTestId('upload-state')).toHaveTextContent('"freshUploadIds":["upload-test"]');
});

it('lets the upload surface open the picker by click or keyboard without extra divider or subtitle', async () => {
  vi.spyOn(api, 'listLibraryRoots').mockResolvedValue([{ id: 'root', name: '主书库', status: 'ONLINE', canWrite: true, canStage: true } as any]);
  vi.spyOn(api, 'listBookUploads').mockResolvedValue([]);
  render(<TestProviders><BookUploadDialog open onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
  const surface = await screen.findByRole('button', { name: '点击或拖入 EPUB 或 PDF' });
  await waitFor(() => expect(surface).toHaveAttribute('aria-disabled', 'false'));
  const picker = vi.spyOn(document.querySelector('input[type="file"]') as HTMLInputElement, 'click');
  fireEvent.click(surface);
  fireEvent.keyDown(surface, {key: 'Enter'});
  fireEvent.keyDown(surface, {key: ' '});
  expect(picker).toHaveBeenCalledTimes(3);
  expect(screen.queryByText('选择或拖入文件即可自动上传。')).not.toBeInTheDocument();
  expect(document.querySelector('.bk-dialog-content')).not.toHaveStyle({borderTop: '1px solid var(--color-border)'});
});

it('does not keep the first-upload exemption after closing and reopening the upload dialog', async () => {
  vi.spyOn(api, 'listLibraryRoots').mockResolvedValue([{ id: 'root', name: '主书库', status: 'ONLINE', canWrite: true, canStage: true } as any]);
  vi.spyOn(api, 'listBookUploads').mockResolvedValue([]);
  vi.spyOn(api, 'createBookUpload').mockResolvedValue({ id: 'later-review' } as any);
  vi.spyOn(api, 'uploadBookContent').mockResolvedValue({ id: 'later-review', status: 'INSPECTING' } as any);
  function UploadAgain() {
    const [open, setOpen] = useState(true);
    return <><button onClick={() => setOpen(true)}>再次打开上传</button><BookUploadDialog open={open} onClose={() => setOpen(false)} onCompleted={vi.fn()} /><Location /></>;
  }
  render(<TestProviders><UploadAgain /></TestProviders>);
  await waitFor(() => expect(screen.getByRole('button', { name: '开始上传' })).toBeEnabled());
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['test'], 'later.pdf', { type: 'application/pdf' })] } });
  await screen.findByRole('button', { name: '编辑信息' });
  fireEvent.click(within(screen.getByRole('dialog', { name: '上传书籍' })).getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByRole('button', { name: '再次打开上传' }));
  fireEvent.click(await screen.findByRole('button', { name: '编辑信息' }));
  expect(screen.getByText('/library/uploads/later-review')).toBeInTheDocument();
  expect(screen.getByTestId('upload-state')).toHaveTextContent('"freshUploadIds":[]');
});

it("does not offer editing for a duplicate upload response", async () => {
  vi.spyOn(api, "listLibraryRoots").mockResolvedValue([{ id: "root", name: "主书库", status: "ONLINE", canWrite: true, canStage: true } as any]);
  vi.spyOn(api, "listBookUploads").mockResolvedValue([]);
  vi.spyOn(api, "createBookUpload").mockResolvedValue({ id: "duplicate" } as any);
  vi.spyOn(api, "uploadBookContent").mockResolvedValue({ id: "duplicate", status: "DUPLICATE", errorDetail: "相同文件已在待校对列表中" } as any);
  render(<TestProviders><BookUploadDialog open onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
  await waitFor(() => expect(screen.getByRole("button", { name: "开始上传" })).toBeEnabled());
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["same"], "same.pdf", { type: "application/pdf" })] } });
  expect(await screen.findByText("相同文件已在待校对列表中")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "编辑信息" })).not.toBeInTheDocument();
});

function preparePrecheckUpload() {
  vi.spyOn(api, "listLibraryRoots").mockResolvedValue([{ id: "root", status: "ONLINE", canWrite: true, canStage: true } as any]);
  vi.spyOn(api, "listBookUploads").mockResolvedValue([]);
  const create = vi.spyOn(api, "createBookUpload").mockResolvedValue({ id: "new-upload" } as any);
  const transfer = vi.spyOn(api, "uploadBookContent").mockResolvedValue({ id: "new-upload", status: "INSPECTING" } as any);
  const view = render(<TestProviders><BookUploadDialog open onClose={vi.fn()} onCompleted={vi.fn()} /></TestProviders>);
  return { create, transfer, ...view };
}
it.each(["CATALOG", "DRAFT"] as const)("blocks %s duplicates before session creation and binary transfer", async match => {
  vi.mocked(api.precheckBookUpload).mockResolvedValue({ match });
  const { create, transfer } = preparePrecheckUpload();
  await waitFor(() => expect(screen.getByRole("button", { name: "开始上传" })).toBeEnabled());
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["same"], "renamed.pdf")] } });
  await screen.findByText(match === "DRAFT" ? "相同文件已在待校对列表中，请继续处理已有草稿" : "相同文件已存在于书库中，请勿重复上传");
  expect(api.precheckBookUpload).toHaveBeenCalledWith({ fingerprint: "sha256:" + "a".repeat(64), sizeBytes: 4 });
  expect(create).not.toHaveBeenCalled(); expect(transfer).not.toHaveBeenCalled();
});
it("serializes same-content files with different names within one concurrent batch", async () => {
  const { create, transfer } = preparePrecheckUpload();
  await waitFor(() => expect(screen.getByRole("button", { name: "开始上传" })).toBeEnabled());
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["same"], "one.pdf"), new File(["same"], "two.pdf")] } });
  await screen.findByText("相同文件已在待校对列表中，请继续处理已有草稿");
  expect(api.precheckBookUpload).toHaveBeenCalledTimes(1); expect(create).toHaveBeenCalledTimes(1); expect(transfer).toHaveBeenCalledTimes(1);
});
it("allows the later equal-content file to proceed when the first receive fails", async () => {
  const { transfer } = preparePrecheckUpload();
  transfer.mockRejectedValueOnce(new Error("连接中断"));
  await waitFor(() => expect(screen.getByRole("button", { name: "开始上传" })).toBeEnabled());
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["same"], "one.pdf"), new File(["same"], "two.pdf")] } });
  await screen.findByRole("button", { name: "编辑信息" });
  expect(api.precheckBookUpload).toHaveBeenCalledTimes(2); expect(transfer).toHaveBeenCalledTimes(2);
});
it("does not upload after hashing fails and retries file checking explicitly", async () => {
  const { create } = preparePrecheckUpload();
  vi.mocked(fileFingerprint).mockRejectedValueOnce(new Error("文件读取失败"));
  await waitFor(() => expect(screen.getByRole("button", { name: "开始上传" })).toBeEnabled());
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["same"], "bad.pdf")] } });
  await screen.findByText("文件读取失败"); expect(create).not.toHaveBeenCalled(); expect(api.precheckBookUpload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "开始上传" }));
  await screen.findByRole("button", { name: "编辑信息" }); expect(create).toHaveBeenCalledTimes(1);
});
