import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { AppShell } from "../components/AppShell";
import { CategoriesPage } from "./CategoriesPage";

const owner = {
  id: "user-owner",
  username: "owner",
  displayName: "林",
  role: "OWNER",
  mustChangePassword: false,
};

describe("CategoriesPage", () => {
  beforeEach(() => sessionStorage.clear());

  it("匿名访客可浏览公开分类，不暴露管理入口", async () => {
    render(<TestProviders initialPath="/categories"><AppShell><CategoriesPage /></AppShell></TestProviders>);

    expect(await screen.findByRole("heading", { name: "分类" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "文学与叙事" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "分类筛选" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "格式筛选" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^文学与叙事，\d+ 本$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "管理分类" })).not.toBeInTheDocument();
  });

  it("可切换分类并在当前分类内搜索书目", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    render(<TestProviders initialPath="/categories"><AppShell><CategoriesPage /></AppShell></TestProviders>);

    const readingCategory = await screen.findByRole("button", { name: /^阅读生活，\d+ 本$/ });
    fireEvent.click(readingCategory);

    await waitFor(() => expect(readingCategory).toHaveAttribute("aria-pressed", "true"));
    expect(await screen.findByRole("heading", { name: "阅读生活" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开搜索" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索当前分类" }), { target: { value: "慢读手册" } });
    expect(await screen.findByText("慢读手册")).toBeInTheDocument();
    expect(await screen.findByText("1 本匹配")).toBeInTheDocument();
  });

  it("主人在分类页唯一位置进入管理，并看到安全删除提示", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    render(<TestProviders initialPath="/categories"><AppShell><CategoriesPage /></AppShell></TestProviders>);

    fireEvent.click(await screen.findByRole("button", { name: "管理分类" }));
    const dialog = await screen.findByRole("dialog", { name: "管理分类" });
    expect(screen.getByText(/不会删除 NAS 文件/)).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "分类名称" })).toBeInTheDocument();
  });
});
