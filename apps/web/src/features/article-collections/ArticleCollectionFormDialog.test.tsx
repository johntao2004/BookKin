import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../api/client";
import { TestProviders } from "../../test/TestProviders";
import { articleCollections, type ArticleCollectionDetail } from "./api";
import { ArticleCollectionFormDialog } from "./ArticleCollectionFormDialog";

const detail: ArticleCollectionDetail = {
  id: "collection-1", title: "自然阅读", description: "留给周末", visibility: "PRIVATE", ownerDisplayName: "林", ownedByViewer: true, editable: true,
  articleCount: 0, previewArticles: [], articles: [], revision: 3, createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z",
};

describe("ArticleCollectionFormDialog", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("creates a private collection with bounded title and description fields", async () => {
    const create = vi.spyOn(articleCollections, "create").mockResolvedValue(detail);
    const saved = vi.fn();
    render(<TestProviders><ArticleCollectionFormDialog open onClose={vi.fn()} onSaved={saved} /></TestProviders>);

    fireEvent.change(screen.getByLabelText("合集名称"), { target: { value: "  自然阅读  " } });
    fireEvent.change(screen.getByLabelText("合集说明"), { target: { value: "留给周末" } });
    fireEvent.click(screen.getByRole("button", { name: "创建合集" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ title: "自然阅读", description: "留给周末", visibility: "PRIVATE" }));
    expect(saved).toHaveBeenCalledWith(detail, "私人合集已创建");
    expect(screen.getByLabelText("合集名称")).toHaveAttribute("maxlength", "240");
    expect(screen.getByLabelText("合集说明")).toHaveAttribute("maxlength", "4000");
  });

  it("refreshes a stale revision and preserves the edit draft until the user retries", async () => {
    const latest = { ...detail, title: "服务端版本", revision: 8 };
    const update = vi.spyOn(articleCollections, "update")
      .mockRejectedValueOnce(new ApiRequestError("Revision conflict", 409))
      .mockResolvedValueOnce({ ...latest, title: "本地草稿", description: "继续编辑", revision: 9 });
    const get = vi.spyOn(articleCollections, "get").mockResolvedValue(latest);
    const conflictLatest = vi.fn();
    const saved = vi.fn();
    render(<TestProviders><ArticleCollectionFormDialog open initial={detail} onClose={vi.fn()} onSaved={saved} onConflictLatest={conflictLatest} /></TestProviders>);

    fireEvent.change(screen.getByLabelText("合集名称"), { target: { value: "本地草稿" } });
    fireEvent.change(screen.getByLabelText("合集说明"), { target: { value: "继续编辑" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText(/当前草稿保留/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(detail.id);
    expect(conflictLatest).toHaveBeenCalledWith(latest);
    expect(screen.getByLabelText("合集名称")).toHaveValue("本地草稿");
    expect(screen.getByLabelText("合集说明")).toHaveValue("继续编辑");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(update).toHaveBeenLastCalledWith(detail.id, { title: "本地草稿", description: "继续编辑", visibility: "PRIVATE" }, 8));
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ revision: 9 }), "合集资料已更新");
  });

  it("requires a second confirmation to delete the collection and leaves articles alone", async () => {
    const remove = vi.spyOn(articleCollections, "remove").mockResolvedValue(undefined);
    const deleted = vi.fn();
    render(<TestProviders><ArticleCollectionFormDialog open initial={detail} onClose={vi.fn()} onSaved={vi.fn()} onDeleted={deleted} /></TestProviders>);

    fireEvent.click(screen.getByRole("button", { name: "删除合集" }));
    const confirmation = await screen.findByRole("dialog", { name: "删除“自然阅读”？" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "删除合集" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(detail.id, detail.revision));
    expect(deleted).toHaveBeenCalledWith("合集已删除；文章及其阅读记录仍保留");
  });
});
