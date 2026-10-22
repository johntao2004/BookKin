// 验证回收书目可检索且恢复先进入安全预览，不能从列表直接执行恢复。
// Checks searchable recycled books and a safety preview before restoration.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { api } from "../api/client";
import { demoRecycleBin } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { RecycleBinPage } from "./RecycleBinPage";

describe("RecycleBinPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false }));
    vi.spyOn(api, "listRecycleBin").mockResolvedValue(demoRecycleBin);
  });

  afterEach(() => vi.restoreAllMocks());

  it("presents deleted files in a table without cover cards", async () => {
    render(<TestProviders initialPath="/recycle-bin"><Routes><Route path="/recycle-bin" element={<RecycleBinPage />} /></Routes></TestProviders>);

    expect(await screen.findByRole("heading", { name: "回收站" })).toBeInTheDocument();
    expect(screen.getByText("条目会在这里保留 30 天。恢复时不会覆盖同路径的新文件；到期后自动清理，只有主人可以提前永久清理。")).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "回收站列表" });
    expect(await within(table).findByText("声之来信")).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "剩余" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "声之来信封面" })).not.toBeInTheDocument();
    expect(screen.getByText("顾安安")).toBeInTheDocument();
    expect(screen.getByText("EPUB")).toBeInTheDocument();
    expect(screen.queryByText(/主书库\/顾安安\/声之来信\.epub/)).not.toBeInTheDocument();
  });

  it("keeps permanent purge owner-only and opens its preview without executing it", async () => {
    const preview = vi.spyOn(api, "previewRecycleOperation").mockResolvedValue({
      previewToken: "purge-preview", type: "PURGE", sourcePath: demoRecycleBin[0].trashPath,
      targetPath: demoRecycleBin[0].originalPath, requiredBytes: 0, expectedFingerprint: demoRecycleBin[0].fingerprint,
      expiresAt: "2026-08-21T10:30:00Z", conflicts: [], warnings: [],
    });
    const execute = vi.spyOn(api, "executeRecycleOperation");
    const view = render(<TestProviders><RecycleBinPage /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: `永久清理${demoRecycleBin[0].bookTitle}` }));
    expect(await screen.findByRole("dialog", { name: "确认永久清理" })).toBeInTheDocument();
    expect(preview).toHaveBeenCalledWith(demoRecycleBin[0], "PURGE");
    expect(execute).not.toHaveBeenCalled();
    view.unmount();
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "admin", username: "admin", displayName: "管理员", role: "ADMIN", mustChangePassword: false }));
    render(<TestProviders><RecycleBinPage /></TestProviders>);
    expect(await screen.findByText(demoRecycleBin[0].bookTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /永久清理/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "恢复" })).toBeEnabled();
  });

  it("opens a safe restore preview before execution", async () => {
    vi.spyOn(api, "previewRecycleOperation").mockResolvedValue({
      previewToken: "preview-1",
      type: "RESTORE",
      sourcePath: demoRecycleBin[0].trashPath,
      targetPath: demoRecycleBin[0].originalPath,
      requiredBytes: 0,
      expectedFingerprint: demoRecycleBin[0].fingerprint,
      expiresAt: "2026-08-21T10:30:00Z",
      conflicts: [],
      warnings: ["不会覆盖已有文件。"],
    });
    render(<TestProviders initialPath="/recycle-bin"><Routes><Route path="/recycle-bin" element={<RecycleBinPage />} /></Routes></TestProviders>);

    fireEvent.click(await screen.findByRole("button", { name: "恢复" }));

    expect(await screen.findByRole("dialog", { name: "确认恢复这本书" })).toBeInTheDocument();
    expect(screen.getByText(demoRecycleBin[0].trashPath)).toBeInTheDocument();
    expect(within(screen.getByRole("dialog", { name: "确认恢复这本书" })).getByRole("button", { name: "恢复" })).toBeEnabled();
    await waitFor(() => expect(api.previewRecycleOperation).toHaveBeenCalledWith(demoRecycleBin[0], "RESTORE"));
  });
});
