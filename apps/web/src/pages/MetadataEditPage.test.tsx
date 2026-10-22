// 验证离开编辑页后仍能看到后台保存失败，避免乐观导航吞掉错误。
// Checks background save failures remain visible after leaving the editor so optimistic navigation cannot hide errors.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import type { BookUpload } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { MetadataEditPage } from "./MetadataEditPage";

afterEach(() => vi.restoreAllMocks());

describe("unified metadata page", () => {
  it.each(["", "next"])("keeps one page return after upload completion and preserves the %s review queue", async next => {
    vi.spyOn(api, "getBookUpload").mockResolvedValue({ id: "review", status: "SUCCEEDED" } as BookUpload);
    render(<TestProviders initialPath={`/library/uploads/review${next ? `?next=${next}` : ""}`}><Routes>
      <Route path="/library/uploads/next" element={<div>下一本校对</div>} />
      <Route path="/library/uploads/:uploadId" element={<MetadataEditPage />} />
    </Routes></TestProviders>);
    expect(await screen.findByText("书籍信息已保存。")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "返回书库" })).toHaveLength(1);
    if (next) {
      fireEvent.click(screen.getByRole("button", { name: "继续校对" }));
      expect(await screen.findByText("下一本校对")).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button", { name: "继续校对" })).not.toBeInTheDocument();
    }
  });

  it.each(["stored", "upload"])("renders %s metadata in the shared page rather than a modal", async mode => {
    const book = demoBooks[0];
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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const returnButton = screen.getByRole("button", { name: "返回书库" });
    expect(returnButton.compareDocumentPosition(screen.getByRole("heading", { level: 1, name: "编辑书籍信息" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(returnButton.closest(".bk-action-toolbar")).toBeNull();
    expect(screen.getByRole("button", { name: "更换封面" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "公开展示" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "简介" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: mode === "stored" ? "保存" : "确认入库" })).toBeInTheDocument();
  });
});

it("keeps a background save failure visible after returning to the catalog", async () => {
  const book = demoBooks[0];
  vi.spyOn(api, "getBook").mockResolvedValue(book);
  let rejectSave: ((reason: Error) => void) | undefined;
  vi.spyOn(api, "updateBookMetadata").mockImplementation(() => new Promise((_done, reject) => { rejectSave = reject; }));
  render(<TestProviders initialPath={`/library/books/${book.id}/edit`}><Routes>
    <Route path="/library/books/:bookId/edit" element={<MetadataEditPage />} />
    <Route path="/library/all" element={<div>返回目录</div>} />
  </Routes></TestProviders>);
  const title = await screen.findByDisplayValue(book.title);
  fireEvent.change(title, { target: { value: "测试修改" } });
  fireEvent.click(screen.getByRole("button", { name: /^保存$/ }));
  expect(await screen.findByText("返回目录")).toBeInTheDocument();
  await act(async () => rejectSave?.(new Error("保存冲突")));
  expect(await screen.findByText("元数据保存失败，已恢复原内容：保存冲突")).toBeInTheDocument();
});
