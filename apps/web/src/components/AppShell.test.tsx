// 覆盖菜单离开关闭、输入法提交与移动端导航可达性，不只验证桌面静态渲染。
// Covers pointer-leave menus, IME submission and mobile navigation reachability beyond static desktop rendering.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, DEFAULT_SITE_SETTINGS } from "../api/client";
import { AppShell } from "./AppShell";
import { BookKinThemeProvider } from "../theme/BookKinThemeProvider";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false },
    logout: vi.fn(),
  }),
}));

const sceneImported = vi.hoisted(() => vi.fn());
vi.mock("../pages/VirtualLibraryExperience", () => {
  sceneImported();
  return {VirtualLibraryExperience: () => null};
});

function RouteProbe() {
  const location = useLocation();
  return <output data-testid="search-route">{location.pathname}{location.search}</output>;
}

function renderShell(initialPath: string, virtualLibraryEnabled = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(['site-settings'], {...DEFAULT_SITE_SETTINGS, virtualLibraryEnabled});
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <BookKinThemeProvider>
          <AppShell><div>正文</div><RouteProbe /></AppShell>
        </BookKinThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {vi.restoreAllMocks(); vi.useRealTimers();});

  it("automatically closes the theme dropdown when the pointer leaves", async () => {
    renderShell("/library");
    const trigger = screen.getByRole("button", { name: "切换全站主题" });
    fireEvent.mouseEnter(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    fireEvent.mouseLeave(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("opens search on hover and preserves the query after Escape or blur", () => {
    renderShell("/library");
    const trigger = screen.getByRole("button", { name: "展开搜索" });
    expect(screen.queryByRole("textbox", { name: "搜索书籍、笔记、书单" })).not.toBeInTheDocument();
    fireEvent.mouseEnter(trigger);
    const input = screen.getByRole("textbox", { name: "搜索书籍、笔记、书单" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "文学" } });
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.mouseEnter(trigger);
    const reopenedInput = screen.getByRole("textbox", { name: "搜索书籍、笔记、书单" });
    fireEvent.keyDown(reopenedInput, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(screen.getByRole("textbox", { name: "搜索书籍、笔记、书单" })).toHaveValue("文学");
    fireEvent.blur(screen.getByRole("textbox", { name: "搜索书籍、笔记、书单" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("submits global search without changing local filters or submitting IME composition", () => {
    renderShell("/categories?format=PDF");
    fireEvent.click(screen.getByRole("button", { name: "展开搜索" }));
    const input = screen.getByRole("textbox", { name: "搜索书籍、笔记、书单" });
    fireEvent.change(input, { target: { value: "文学" } });
    expect(screen.getByTestId("search-route")).toHaveTextContent("/categories?format=PDF");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(screen.getByTestId("search-route")).toHaveTextContent("/categories?format=PDF");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("search-route")).toHaveTextContent(`/search?q=${encodeURIComponent("文学")}`);
  });

  it("keeps the global navigation above reader routes", () => {
    renderShell("/reader/book-1");

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "全站导航" })).toHaveStyle({ width: "100%", maxWidth: "none" });
    expect(screen.getByRole("link", { name: "BookKin" })).toHaveAttribute("href", "/library");
    expect(screen.getByRole("main")).toHaveTextContent("正文");
  });

  it("keeps the global navigation on library routes", () => {
    renderShell("/library");

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "全站导航" })).toBeInTheDocument();
    const wordmark = screen.getByRole("link", { name: "BookKin" });
    expect(wordmark).toBeInTheDocument();
    expect(wordmark.previousElementSibling).toHaveAccessibleName("打开导航");
    expect(screen.getByRole("link", { name: "分类" })).toHaveAttribute("href", "/categories");
    expect(screen.getByRole("link", { name: "书单" })).toHaveAttribute("href", "/booklists");
    expect(screen.getByRole("link", { name: "藏书库" })).toHaveAttribute("href", "/library/all");
    expect(screen.getByRole("link", { name: "阅读笔记" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "虚拟书库" })).toHaveAttribute("href", "/virtual-library");
    expect(screen.queryByText("已同步")).not.toBeInTheDocument();
  });

  it("keeps search, theme, and account controls reachable in the phone header", () => {
    renderShell("/library");
    const search = screen.getByRole("button", { name: "展开搜索" });
    const theme = screen.getByRole("button", { name: "切换全站主题" });
    const account = screen.getByRole("button", { name: "账户菜单" });
    const precedes = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(precedes(search, theme)).toBe(true);
    expect(precedes(theme, account)).toBe(true);
    fireEvent.click(search);

    const input = screen.getByRole("textbox", { name: "搜索书籍、笔记、书单" });
    expect(input).toHaveFocus();

  });

  it("keeps management pages in the account menu instead of the main drawer", async () => {
    renderShell("/library");
    const managementLabels = ["设置"];

    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const drawer = screen.getByRole("navigation", { name: "移动端导航" });
    expect(within(screen.getByRole("dialog", { name: "BookKin" })).getByRole("heading", { name: "BookKin" })).toBeInTheDocument();
    for (const label of managementLabels) expect(within(drawer).queryByText(label)).not.toBeInTheDocument();
    expect(within(drawer).queryByText("展示书目设置")).not.toBeInTheDocument();
    expect(within(drawer).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "首页",
      "文章收藏",
      "禁书区",
      "藏书库",
      "分类",
      "书单",
      "知识图谱",
      "阅读笔记",
      "虚拟书库",
    ]);

    fireEvent.click(within(drawer).getByText("首页"));
    fireEvent.click(await screen.findByRole("button", { name: "账户菜单" }));
    const accountMenu = screen.getByRole("menu");
    expect(within(accountMenu).queryByRole("menuitem", { name: "用户管理" })).not.toBeInTheDocument();
    for (const label of managementLabels) expect(within(accountMenu).getByRole("menuitem", { name: label })).toBeInTheDocument();
    expect(within(accountMenu).queryByRole("menuitem", { name: "展示书目设置" })).not.toBeInTheDocument();
  });

  it("does not import 3D or prefetch its catalog while idle or approaching its link", async () => {
    vi.useFakeTimers();
    const listBooks = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
    const revision = vi.spyOn(api, "catalogRevision");
    renderShell("/library");
    const link = screen.getByRole("link", { name: "虚拟书库" });
    fireEvent.mouseEnter(link); fireEvent.focus(link); fireEvent.touchStart(link);
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(sceneImported).not.toHaveBeenCalled();
    expect(listBooks).not.toHaveBeenCalled();
    expect(revision).not.toHaveBeenCalled();
  });

  it("hides the disabled 3D entry in desktop and mobile navigation", () => {
    renderShell("/library", false);
    expect(screen.queryByRole("link", {name: "虚拟书库"})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "打开导航"}));
    expect(within(screen.getByRole("navigation", {name: "移动端导航"})).queryByText("虚拟书库")).not.toBeInTheDocument();
  });

  it("switches the whole site to the same night theme used by the reader", async () => {
    renderShell("/library");

    fireEvent.click(screen.getByRole("button", { name: "切换全站主题" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "夜间" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-bookkin-theme", "night");
      expect(screen.getByRole("button", { name: "切换全站主题" })).toHaveAttribute("aria-expanded", "false");
    });
    expect(localStorage.getItem("bookkin-site-theme")).toBe("NIGHT");
  });

  it("switches back to the bright theme and closes the menu after selection", async () => {
    renderShell("/library");

    fireEvent.click(screen.getByRole("button", { name: "切换全站主题" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "明亮" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-bookkin-theme", "white");
      expect(screen.getByRole("button", { name: "切换全站主题" })).toHaveAttribute("aria-expanded", "false");
    });
    expect(localStorage.getItem("bookkin-site-theme")).toBe("WHITE");
  });
});
