import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { AppShell } from "./AppShell";
import { BookKinThemeProvider } from "../theme/BookKinThemeProvider";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false },
    logout: vi.fn(),
  }),
}));

vi.mock("../pages/VirtualLibraryExperience", () => ({
  VirtualLibraryExperience: () => null,
}));

function renderShell(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <BookKinThemeProvider>
          <AppShell><div>正文</div></AppShell>
        </BookKinThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => localStorage.clear());

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
    expect(screen.queryByRole("textbox", { name: "搜索展示书目" })).not.toBeInTheDocument();
    fireEvent.mouseEnter(trigger);
    const input = screen.getByRole("textbox", { name: "搜索展示书目" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "文学" } });
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.mouseEnter(trigger);
    const reopenedInput = screen.getByRole("textbox", { name: "搜索展示书目" });
    fireEvent.keyDown(reopenedInput, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(screen.getByRole("textbox", { name: "搜索展示书目" })).toHaveValue("文学");
    fireEvent.blur(screen.getByRole("textbox", { name: "搜索展示书目" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves only the reader navigation on reader routes", () => {
    renderShell("/reader/book-1");

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("正文");
  });

  it("keeps the global navigation on library routes", () => {
    renderShell("/library");

    expect(screen.getByRole("banner")).toBeInTheDocument();
    const wordmark = screen.getByRole("link", { name: "BookKin" });
    expect(wordmark).toBeInTheDocument();
    expect(wordmark.previousElementSibling).toBeNull();
    expect(screen.getByRole("link", { name: "分类" })).toHaveAttribute("href", "/categories");
    expect(screen.getByRole("link", { name: "书单" })).toHaveAttribute("href", "/booklists");
    expect(screen.getByRole("link", { name: "藏书库" })).toHaveAttribute("href", "/library/all");
    expect(screen.getByRole("link", { name: "阅读笔记" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "虚拟书库" })).toHaveAttribute("href", "/virtual-library");
    expect(screen.queryByText("已同步")).not.toBeInTheDocument();
  });

  it("keeps management pages in the account menu instead of the main drawer", async () => {
    renderShell("/library");
    const managementLabels = ["用户管理", "设置"];

    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const drawer = screen.getByRole("navigation");
    expect(within(screen.getByRole("dialog", { name: "BookKin" })).getByRole("heading", { name: "BookKin" })).toBeInTheDocument();
    for (const label of managementLabels) expect(within(drawer).queryByText(label)).not.toBeInTheDocument();
    expect(within(drawer).queryByText("展示书目设置")).not.toBeInTheDocument();
    expect(within(drawer).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "首页",
      "藏书库",
      "展示书目",
      "分类",
      "书单",
      "阅读笔记",
      "虚拟书库",
    ]);

    fireEvent.click(within(drawer).getByText("首页"));
    fireEvent.click(await screen.findByRole("button", { name: "账户菜单" }));
    const accountMenu = screen.getByRole("menu");
    for (const label of managementLabels) expect(within(accountMenu).getByRole("menuitem", { name: label })).toBeInTheDocument();
    expect(within(accountMenu).queryByRole("menuitem", { name: "展示书目设置" })).not.toBeInTheDocument();
  });

  it("prefetches the 3D catalog when the virtual-library link is approached", async () => {
    const listBooks = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
    renderShell("/library");

    fireEvent.mouseEnter(screen.getByRole("link", { name: "虚拟书库" }));

    await waitFor(() => expect(listBooks).toHaveBeenCalledWith(expect.objectContaining({
      limit: 60,
      sort: "recent",
    })));
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
