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
  expect(create).toHaveBeenCalledTimes(1);
  expect(await screen.findByText(/已上传。你可以更改/)).toBeInTheDocument();
  expect(screen.queryByText('识别与入库队列')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '确定' }));
  expect(screen.getByText('/library/uploads/upload-test')).toBeInTheDocument();
});
