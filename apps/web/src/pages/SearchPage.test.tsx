// 验证匿名只搜索公开来源，登录搜索私人笔记时保留原阅读定位。
// Checks anonymous searches use only public sources and signed-in private-note results preserve reading locators.
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { SearchPage } from "./SearchPage";

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(api, "listBooklists").mockResolvedValue({ items: [] });
  vi.spyOn(api, "listCategories").mockResolvedValue({ items: [], editable: false });
});
afterEach(() => vi.restoreAllMocks());

it("searches only public sources for an anonymous visitor", async () => {
  const privateBooks = vi.spyOn(api, "listBooks");
  const notes = vi.spyOn(api, "listAnnotations");
  const publicBooks = vi.spyOn(api, "listDisplayBooks").mockResolvedValue({ revision: 1, items: [{ id: "public-book", title: "星空公开书", author: "作者", coverUrl: "/cover.jpg", available: true, sortOrder: 0 }] });
  render(<TestProviders initialPath="/search?q=星空"><SearchPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "星空公开书" })).toBeInTheDocument();
  expect(publicBooks).toHaveBeenCalledWith(expect.objectContaining({ q: "星空" }));
  expect(privateBooks).not.toHaveBeenCalled();
  expect(notes).not.toHaveBeenCalled();
  expect(screen.queryByText("我的笔记与划线")).not.toBeInTheDocument();
});

it("searches the signed-in catalog and own note text and preserves its reading locator", async () => {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "主人", role: "OWNER", mustChangePassword: false }));
  const privateBooks = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  vi.spyOn(api, "listAnnotations").mockResolvedValue([
    { id: "own-note", bookId: "private-book", bookTitle: "私人阅读", type: "NOTE", note: "我的星空笔记", quote: "原文", locator: "pdf:page=2&offset=1", style: "HIGHLIGHT", createdAt: "2026-10-20T00:00:00Z" },
    { id: "unmatched", bookId: "other-book", type: "NOTE", note: "不匹配的内容", style: "HIGHLIGHT", createdAt: "2026-10-20T00:00:00Z" },
  ]);
  render(<TestProviders initialPath="/search?q=星空"><SearchPage /></TestProviders>);
  expect(await screen.findByText("我的星空笔记")).toBeInTheDocument();
  expect(screen.queryByText("不匹配的内容")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "查看笔记" })).toHaveAttribute("href", "/reader/private-book?locator=pdf%3Apage%3D2%26offset%3D1");
  await waitFor(() => expect(privateBooks).toHaveBeenCalledWith(expect.objectContaining({ q: "星空" })));
});

 it("does not query revoked note and booklist features through global search", async () => {
  const { defaultGrants } = await import("../auth/permissions");
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "member", username: "member", displayName: "成员", role: "MEMBER", mustChangePassword: false }));
  sessionStorage.setItem("bookkin-demo-role-permissions", JSON.stringify({ revision: 1, grants: { OWNER: defaultGrants("OWNER"), ADMIN: defaultGrants("ADMIN"), MEMBER: defaultGrants("MEMBER").filter(code => !code.startsWith("notes.") && !code.startsWith("booklists.")) } }));
  const books = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  const notes = vi.spyOn(api, "listAnnotations"); const lists = vi.spyOn(api, "listBooklists");
  render(<TestProviders initialPath="/search?q=星空"><SearchPage /></TestProviders>);
  await waitFor(() => expect(books).toHaveBeenCalled());
  expect(notes).not.toHaveBeenCalled(); expect(lists).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByText("正在搜索…")).not.toBeInTheDocument());
});
