import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("presents deleted files as a searchable book library", async () => {
    render(<TestProviders initialPath="/recycle-bin"><Routes><Route path="/recycle-bin" element={<RecycleBinPage />} /></Routes></TestProviders>);

    expect(await screen.findByRole("heading", { name: "回收站" })).toBeInTheDocument();
    expect(screen.getByText("从藏书中移除的书会进入这里，保留 30 天。")).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "声之来信封面" })).toBeInTheDocument();
    expect(screen.getByText("顾安安")).toBeInTheDocument();
    expect(screen.getByText("EPUB")).toBeInTheDocument();
    expect(screen.queryByText(/主书库\/顾安安\/声之来信\.epub/)).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "确认恢复" })).toBeEnabled();
    await waitFor(() => expect(api.previewRecycleOperation).toHaveBeenCalledWith(demoRecycleBin[0], "RESTORE"));
  });
});
