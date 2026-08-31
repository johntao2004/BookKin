import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import type { DisplayBook } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { DisplayBooksSettingsPage } from "./DisplayBooksSettingsPage";

const owner = {
  id: "user-owner",
  username: "owner",
  displayName: "林",
  role: "OWNER",
  mustChangePassword: false,
};

const displayBook = (index: number, sortOrder: number): DisplayBook => ({
  id: demoBooks[index].id,
  title: demoBooks[index].title,
  author: demoBooks[index].author,
  description: demoBooks[index].description,
  format: demoBooks[index].format,
  coverUrl: demoBooks[index].coverUrl,
  available: true,
  sortOrder,
});

describe("DisplayBooksSettingsPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
  });

  afterEach(() => vi.restoreAllMocks());

  it("用新增按钮替代常驻添加面板，并在弹窗中搜索选择书籍", async () => {
    vi.spyOn(api, "listDisplayBooks").mockResolvedValue({ items: [displayBook(0, 1), displayBook(1, 2)], revision: 3 });
    vi.spyOn(api, "listBooks").mockImplementation(async ({ q } = {}) => {
      const candidates = [demoBooks[2], demoBooks[3]];
      const query = q?.trim() ?? "";
      return { items: query ? candidates.filter((book) => `${book.title} ${book.author}`.includes(query)) : candidates };
    });

    render(<TestProviders initialPath="/settings/display-books"><DisplayBooksSettingsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "当前展示顺序" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "添加书目" })).not.toBeInTheDocument();

    const openButton = screen.getByRole("button", { name: "新增" });
    await waitFor(() => expect(openButton).toBeEnabled());
    fireEvent.click(openButton);
    const dialog = await screen.findByRole("dialog", { name: "新增展示书目" });
    const search = within(dialog).getByRole("textbox", { name: "搜索书名或作者" });
    const confirm = within(dialog).getByRole("button", { name: "新增" });

    expect(confirm).toBeDisabled();
    expect(await within(dialog).findByRole("button", { name: new RegExp(demoBooks[2].title) })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: new RegExp(demoBooks[3].title) })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: demoBooks[2].title } });
    const candidate = await within(dialog).findByRole("button", { name: new RegExp(demoBooks[2].title) });
    await waitFor(() => expect(within(dialog).queryByRole("button", { name: new RegExp(demoBooks[3].title) })).not.toBeInTheDocument());
    fireEvent.click(candidate);

    expect(confirm).toBeEnabled();
    expect(within(dialog).getByRole("radio", { name: `选择 ${demoBooks[2].title}` })).toBeChecked();

    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "新增展示书目" })).not.toBeInTheDocument());
  });
});
