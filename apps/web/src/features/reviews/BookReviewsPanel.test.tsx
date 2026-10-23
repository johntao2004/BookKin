import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestProviders } from "../../test/TestProviders";
import { BookReviewsPanel } from "./BookReviewsPanel";
import { bookReviews, type BookReview } from "./api";

const saved: BookReview = { id: "review-1", bookId: "book-1", userId: "owner", authorName: "作者", title: "重新理解阅读", markdown: "## 原文\n\n**思考**", visibility: "PRIVATE", revision: 3, createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z" };

function renderPanel() { return render(<TestProviders><BookReviewsPanel bookId="book-1" /></TestProviders>); }

describe("BookReviewsPanel", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "owner", username: "owner", displayName: "作者", role: "OWNER", mustChangePassword: false }));
    vi.spyOn(bookReviews, "list").mockResolvedValue([]);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });

  it("creates a separate private long-form review and renders Markdown", async () => {
    const create = vi.spyOn(bookReviews, "create").mockImplementation(async (_book, draft) => { const result = { ...saved, ...draft }; vi.mocked(bookReviews.list).mockResolvedValue([result]); return result; });
    renderPanel();
    await screen.findByText("暂无随笔");
    fireEvent.click(screen.getByRole("button", { name: "写随笔" }));
    const drawer = await screen.findByRole("dialog", { name: "写随笔" });
    fireEvent.change(within(drawer).getByRole("textbox", { name: "标题" }), { target: { value: "读后的思考" } });
    const markdown = "## 我的观点\n\n**重点**\n\n- 观察\n\n| 名称 | 内容 |\n| --- | --- |\n| 思考 | 重新理解 |\n\n```js\nconst read = true;\n```";
    fireEvent.change(within(drawer).getByRole("textbox", { name: "随笔正文" }), { target: { value: markdown } });
    fireEvent.click(within(drawer).getByRole("button", { name: "预览" }));
    const preview = within(drawer).getByRole("region", { name: "随笔预览" });
    expect(within(preview).getByRole("heading", { name: "我的观点" })).toBeInTheDocument();
    expect(within(preview).getByText("重点").tagName).toBe("STRONG");
    expect(within(preview).getByRole("table")).toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole("button", { name: "保存随笔" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("book-1", { title: "读后的思考", markdown, visibility: "PRIVATE" }));
    expect(await screen.findByRole("heading", { name: "读后的思考" })).toBeInTheDocument();
  });

  it("only offers editing for the author's reviews and sends the original revision", async () => {
    vi.mocked(bookReviews.list).mockResolvedValue([saved, { ...saved, id: "other", userId: "member", title: "其他人的共享随笔", visibility: "LIBRARY" }]);
    const update = vi.spyOn(bookReviews, "update").mockResolvedValue({ ...saved, title: "修订", revision: 4 });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "编辑随笔：重新理解阅读" }));
    expect(screen.queryByRole("button", { name: "编辑随笔：其他人的共享随笔" })).not.toBeInTheDocument();
    const drawer = await screen.findByRole("dialog", { name: "编辑随笔" });
    expect(within(drawer).getByRole("textbox", { name: "随笔正文" })).toHaveValue(saved.markdown);
    fireEvent.change(within(drawer).getByRole("textbox", { name: "标题" }), { target: { value: "修订" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "保存随笔" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("review-1", { title: "修订", markdown: saved.markdown, visibility: "PRIVATE" }, 3));
  });

  it("keeps the draft open after a revision conflict", async () => {
    vi.mocked(bookReviews.list).mockResolvedValue([saved]);
    const update = vi.spyOn(bookReviews, "update").mockRejectedValue(new Error("随笔已被更新，请刷新后重试。"));
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "编辑随笔：重新理解阅读" }));
    const drawer = await screen.findByRole("dialog", { name: "编辑随笔" });
    fireEvent.change(within(drawer).getByRole("textbox", { name: "随笔正文" }), { target: { value: "未保存的修改" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "保存随笔" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(await screen.findByText("随笔已被更新，请刷新后重试。")).toBeInTheDocument();
    expect(within(drawer).getByRole("textbox", { name: "随笔正文" })).toHaveValue("未保存的修改");
  });

  it("does not request or render reviews for anonymous users", () => {
    sessionStorage.removeItem("bookkin-demo-session");
    renderPanel();
    expect(bookReviews.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "读后随笔" })).not.toBeInTheDocument();
  });
});
