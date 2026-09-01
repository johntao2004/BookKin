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
    const managementLabels = ["书库状态", "用户管理", "文件任务", "阅读字体"];

    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const drawer = screen.getByRole("navigation");
    expect(within(drawer).getByText("BookKin").previousElementSibling).toBeNull();
    for (const label of managementLabels) expect(within(drawer).queryByText(label)).not.toBeInTheDocument();
    expect(within(drawer).queryByText("展示书目设置")).not.toBeInTheDocument();
    expect(within(drawer).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "首页",
      "藏书库",
      "分类",
      "书单",
      "阅读笔记",
      "虚拟书库",
    ]);

    fireEvent.click(within(drawer).getByText("首页"));
    fireEvent.click(await screen.findByRole("button", { name: "账户菜单" }));
    const accountMenu = screen.getByRole("menu");
    for (const label of managementLabels) expect(within(accountMenu).getByRole("menuitem", { name: label })).toBeInTheDocument();
    expect(within(accountMenu).getByRole("menuitem", { name: "展示书目设置" })).toBeInTheDocument();
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

    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-bookkin-theme", "night"));
    expect(localStorage.getItem("bookkin-site-theme")).toBe("NIGHT");
  });
});
