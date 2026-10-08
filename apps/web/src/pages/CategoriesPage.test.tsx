import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import type { CategorySummary } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { AppShell } from "../components/AppShell";
import { CategoriesPage } from "./CategoriesPage";

function RouteSearch() {
  const location = useLocation();
  return <output data-testid="route-search">{location.search}</output>;
}

const owner = {
  id: "user-owner",
  username: "owner",
  displayName: "林",
  role: "OWNER",
  mustChangePassword: false,
};

describe("CategoriesPage", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("匿名访客可浏览公开分类，不暴露管理入口", async () => {
    render(<TestProviders initialPath="/categories"><AppShell><CategoriesPage /></AppShell></TestProviders>);

    expect(await screen.findByRole("heading", { name: "分类" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "文学与叙事" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "分类筛选" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "格式筛选" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^文学与叙事，\d+ 本$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "管理分类" })).not.toBeInTheDocument();
  });

  it("没有分类时页头提供唯一创建入口并打开简洁表单", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    vi.spyOn(api, "listCategories").mockResolvedValue({ items: [], editable: true });
    render(<TestProviders initialPath="/categories"><CategoriesPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "无书目" })).toBeInTheDocument();
    expect(screen.queryByText(/创建第一个分类|管理员整理完成/)).not.toBeInTheDocument();
    const createButton = screen.getByRole("button", { name: "创建分类" });
    expect(screen.getAllByRole("button", { name: "创建分类" })).toHaveLength(1);

    fireEvent.click(createButton);

    const dialog = await screen.findByRole("dialog", { name: "创建分类" });
    expect(within(dialog).getByRole("textbox", { name: "分类名称" })).toHaveValue("");
    expect(within(dialog).queryByText("当前顺序")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "管理分类" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/右侧创建/)).not.toBeInTheDocument();
  });

  it("旧manage=1空分类链接直接进入创建表单，创建成功后关闭并保留其他查询参数", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    const category: CategorySummary = {
      id: "category-created",
      name: "新分类",
      description: "新分类说明",
      bookCount: 0,
      previewBooks: [],
      editable: true,
    };
    const listCategories = vi.spyOn(api, "listCategories")
      .mockResolvedValueOnce({ items: [], editable: true })
      .mockResolvedValue({ items: [category], editable: true });
    const createCategory = vi.spyOn(api, "createCategory").mockResolvedValue(category);
    vi.spyOn(api, "listCategoryBooks").mockResolvedValue({ items: [] });
    render(<TestProviders initialPath="/categories?manage=1&q=keep&format=PDF"><><CategoriesPage /><RouteSearch /></></TestProviders>);

    const dialog = await screen.findByRole("dialog", { name: "创建分类" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "分类名称" }), { target: { value: "新分类" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "简介" }), { target: { value: "新分类说明" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "创建分类" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "创建分类" })).not.toBeInTheDocument());
    expect(createCategory).toHaveBeenCalledWith({ name: "新分类", description: "新分类说明" });
    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId("route-search").textContent ?? "");
      expect(params.has("manage")).toBe(false);
      expect(params.get("q")).toBe("keep");
      expect(params.get("format")).toBe("PDF");
    });
    expect(listCategories).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("button", { name: "管理分类" })).toBeInTheDocument();
  });

  it("主人尚未读到分类时保留禁用的管理入口而不显示创建空态", () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    vi.spyOn(api, "listCategories").mockImplementation(() => new Promise(() => undefined));
    render(<TestProviders initialPath="/categories"><CategoriesPage /></TestProviders>);

    expect(screen.getByRole("button", { name: "管理分类" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "创建分类" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "无书目" })).not.toBeInTheDocument();
  });

  it("分类读取失败时保留禁用的管理入口", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    vi.spyOn(api, "listCategories").mockRejectedValue(new Error("offline"));
    render(<TestProviders initialPath="/categories"><CategoriesPage /></TestProviders>);

    expect(await screen.findByRole("button", { name: "管理分类" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "创建分类" })).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("分类暂时无法读取");
  });

  it("分类搜索无匹配书目时使用统一空态并保留清筛选操作", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    const category: CategorySummary = {
      id: "category-test",
      name: "测试分类",
      description: "保留分类简介",
      bookCount: 1,
      previewBooks: [],
      editable: true,
    };
    vi.spyOn(api, "listCategories").mockResolvedValue({ items: [category], editable: true });
    vi.spyOn(api, "listCategoryBooks").mockResolvedValue({ items: [] });
    render(<TestProviders initialPath="/categories?category=category-test&q=不存在"><CategoriesPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "无书目" })).toBeInTheDocument();
    expect(screen.queryByText(/换个关键词|可以整理本分类/)).not.toBeInTheDocument();
    expect(screen.getByText("保留分类简介")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清除筛选" })).toBeInTheDocument();
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
    const category: CategorySummary = {
      id: "category-managed",
      name: "现有分类",
      description: "现有分类说明",
      bookCount: 0,
      previewBooks: [],
      editable: true,
    };
    vi.spyOn(api, "listCategories").mockResolvedValue({ items: [category], editable: true });
    vi.spyOn(api, "listCategoryBooks").mockResolvedValue({ items: [] });
    render(<TestProviders initialPath="/categories"><AppShell><CategoriesPage /></AppShell></TestProviders>);

    await screen.findByRole("button", { name: "管理分类" });
    await waitFor(() => expect(screen.getByRole("button", { name: "管理分类" })).toBeEnabled());
    const manageButton = screen.getByRole("button", { name: "管理分类" });
    fireEvent.click(manageButton);
    const dialog = await screen.findByRole("dialog", { name: "管理分类" });
    expect(screen.getByText(/不会删除 NAS 文件/)).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "分类名称" })).toBeInTheDocument();
    expect(within(dialog).getByText("当前顺序")).toBeInTheDocument();

    const editButton = within(dialog).getAllByRole("button", { name: /^编辑 / })[0];
    fireEvent.click(editButton);
    const nameField = within(dialog).getByRole("textbox", { name: "分类名称" });
    expect(nameField).not.toHaveValue("");
    fireEvent.change(nameField, { target: { value: "未保存的改动" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "完成" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "管理分类" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "管理分类" }));
    const reopenedDialog = await screen.findByRole("dialog", { name: "管理分类" });
    expect(within(reopenedDialog).getByRole("textbox", { name: "分类名称" })).toHaveValue("");
    expect(within(reopenedDialog).queryByRole("button", { name: "取消编辑" })).not.toBeInTheDocument();
  });
});
