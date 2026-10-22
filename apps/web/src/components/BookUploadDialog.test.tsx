// 验证局域网 HTTP 上传与键盘选文件入口，上传成功后进入持久校对路由而非直接假定入库。
// Checks LAN-HTTP upload and keyboard file selection, leading to persistent review rather than assuming catalog commit.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { TestProviders } from "../test/TestProviders";
import { api } from "../api/client";
import { BookUploadDialog } from "./BookUploadDialog";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Location() { return <output>{useLocation().pathname}</output>; }
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
