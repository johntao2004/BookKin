// 区分匿名公开书目与登录后的个人/家庭分组，不因旧官方类型暴露额外选择。
// Distinguishes anonymous public lists from signed-in personal/family groups without reviving legacy official-type choices.
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

  it("匿名访客只看合并后的公开书目区", async () => {
    render(<TestProviders initialPath="/booklists"><BooklistsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "公开书目" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "官方书目" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "秋日慢读" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "灯塔与远方" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的书目" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新建书目" })).not.toBeInTheDocument();
  });

  it.each(["/booklists", "/booklists?q=not-found"]) ("空书目列表使用统一空态（%s）", async (initialPath) => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    vi.spyOn(api, "listBooklists").mockResolvedValue({ items: [] });
    render(<TestProviders initialPath={initialPath}><BooklistsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: initialPath.includes("?q=") ? "未找到匹配的书目" : "暂无书目" })).toBeInTheDocument();
    expect(screen.queryByText(/试试书目名称|创建一份个人书目|登录后可以创建/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "新建书目" })).toHaveLength(1);
    if (initialPath.includes("?q=")) {
      expect(screen.getByRole("button", { name: "清除搜索" })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button", { name: "清除搜索" })).not.toBeInTheDocument();
    }
  });

  it.each([
    { emptyGroup: "我的书目", items: [createBooklist("official", "OFFICIAL", false), createBooklist("shared", "PERSONAL", false)] },
    { emptyGroup: "家庭共享", items: [createBooklist("mine", "PERSONAL", true)] },
  ]) ("空的$emptyGroup分组显示持续的统一文案", async ({ emptyGroup, items }) => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    vi.spyOn(api, "listBooklists").mockResolvedValue({ items });
    render(<TestProviders initialPath="/booklists"><BooklistsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: emptyGroup })).toBeInTheDocument();
    expect(screen.getByText(emptyGroup === "家庭共享" ? "暂无家庭共享书目" : "暂无书目")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("由主人和管理员整理的馆内阅读路径。")).not.toBeInTheDocument();
  });

  it("登录后分开我的书目与家庭发现，且不再提供官方类型", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    render(<TestProviders initialPath="/booklists"><BooklistsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "我的书目" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "家庭共享" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "想读的自然笔记" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "灯塔与远方" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "新建书目" })[0]);
    expect(await screen.findByRole("dialog", { name: "新建书目" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "书目类型" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "官方书目" })).not.toBeInTheDocument();
  });
});
