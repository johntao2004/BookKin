import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import type { BooklistSummary } from "../domain/types";
import { BooklistsPage } from "./BooklistsPage";

const owner = {
  id: "user-owner",
  username: "owner",
  displayName: "林",
  role: "OWNER",
  mustChangePassword: false,
};

function createBooklist(id: string, kind: BooklistSummary["kind"], ownedByViewer: boolean): BooklistSummary {
  return {
    id,
    title: id,
    description: undefined,
    kind,
    visibility: kind === "OFFICIAL" || !ownedByViewer ? "PUBLIC" : "PRIVATE",
    ownerDisplayName: "林",
    bookCount: 0,
    previewBooks: [],
    ownedByViewer,
    editable: ownedByViewer,
    revision: 1,
    hiddenPublicBookCount: 0,
    updatedAt: "2026-08-21T03:00:00Z",
  };
}

describe("BooklistsPage", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("匿名访客只看官方与公开发现区", async () => {
    render(<TestProviders initialPath="/booklists"><BooklistsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "官方书单" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "公开书单" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "秋日慢读" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "灯塔与远方" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的书单" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新建书单" })).not.toBeInTheDocument();
  });

  it.each(["/booklists", "/booklists?q=not-found"]) ("空书单列表使用统一空态（%s）", async (initialPath) => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    vi.spyOn(api, "listBooklists").mockResolvedValue({ items: [] });
    render(<TestProviders initialPath={initialPath}><BooklistsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "无书目" })).toBeInTheDocument();
    expect(screen.queryByText(/试试书单名称|创建一份个人书单|登录后可以创建/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "新建书单" })).toHaveLength(1);
    if (initialPath.includes("?q=")) {
      expect(screen.getByRole("button", { name: "清除搜索" })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button", { name: "清除搜索" })).not.toBeInTheDocument();
    }
  });

  it.each([
    { emptyGroup: "官方书单", items: [createBooklist("mine", "PERSONAL", true), createBooklist("shared", "PERSONAL", false)] },
    { emptyGroup: "我的书单", items: [createBooklist("official", "OFFICIAL", false), createBooklist("shared", "PERSONAL", false)] },
    { emptyGroup: "家庭共享与公开", items: [createBooklist("official", "OFFICIAL", false), createBooklist("mine", "PERSONAL", true)] },
  ]) ("空的$emptyGroup分组显示持续的统一文案", async ({ emptyGroup, items }) => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    vi.spyOn(api, "listBooklists").mockResolvedValue({ items });
    render(<TestProviders initialPath="/booklists"><BooklistsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: emptyGroup })).toBeInTheDocument();
    expect(screen.getByText("无书目")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("由主人和管理员整理的馆内阅读路径。")).toBeInTheDocument();
  });

  it("登录后分开我的书单与家庭发现，且主人可选官方类型", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    render(<TestProviders initialPath="/booklists"><BooklistsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "我的书单" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "家庭共享与公开" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "想读的自然笔记" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "灯塔与远方" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "新建书单" })[0]);
    expect(await screen.findByRole("dialog", { name: "新建书单" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "书单类型" })).toBeInTheDocument();
  });
});
