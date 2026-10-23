// 覆盖菜单离开关闭、输入法提交与移动端导航可达性，不只验证桌面静态渲染。
// Covers pointer-leave menus, IME submission and mobile navigation reachability beyond static desktop rendering.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, DEFAULT_SITE_SETTINGS } from "../api/client";
import { AppShell } from "./AppShell";
import { BookKinThemeProvider } from "../theme/BookKinThemeProvider";

const authState = vi.hoisted(() => ({ signedIn: true }));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: authState.signedIn ? { id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false } : null,
    logout: vi.fn(),
    ready: true,
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
  beforeEach(() => { localStorage.clear(); authState.signedIn = true; });
  afterEach(() => {vi.restoreAllMocks(); vi.useRealTimers();});

  it.each(["/library/books/book-1", "/annotations/books", "/vault"])("does not select an article entry outside the article section on %s", async (path) => {
    renderShell(path);
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const drawer = await screen.findByRole("dialog");
    const group = within(drawer).getByRole("group", { name: "文钞馆二级菜单" });
    for (const name of ["全部文章", "选集"]) {
      const entry = within(group).getByRole("button", { name });
      expect(entry).not.toHaveAttribute("aria-current");
      expect(entry).not.toHaveAttribute("aria-pressed");
    }
    fireEvent.click(within(drawer).getByRole("button", { name: "文钞馆二级菜单" }));
    expect(within(drawer).queryByRole("group", { name: "文钞馆二级菜单" })).not.toBeInTheDocument();
    expect(screen.getByTestId("search-route")).toHaveTextContent(path);
  });

  it("groups article collections below articles and keeps their parent active on desktop and mobile", async () => {
    renderShell("/article-collections/collection-1");
    const trigger = screen.getByRole("link", { name: "文钞馆" });
    expect(trigger).toHaveAttribute("aria-current", "page");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("link", { name: "选集" })).toHaveAttribute("href", "/article-collections");
    expect(within(menu).getByRole("link", { name: "全部文章" })).toHaveAttribute("href", "/articles");
    fireEvent.click(within(menu).getByRole("link", { name: "选集" }));
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const drawer = await screen.findByRole("dialog");
    const group = within(drawer).getByRole("group", { name: "文钞馆二级菜单" });
    expect(within(group).getByRole("button", { name: "选集" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(group).getByRole("button", { name: "全部文章" }));
    expect(screen.getByTestId("search-route")).toHaveTextContent("/articles");
  });

  it("groups the two source pages below the reading-note overview in desktop and mobile navigation", async () => {
    renderShell("/annotations/articles");
    const trigger = screen.getByRole("link", { name: "读书录" });
    expect(trigger).toHaveAttribute("aria-current", "page");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("link", { name: "读书札记" })).toHaveAttribute("href", "/annotations/books");
    expect(within(menu).getByRole("link", { name: "阅文札记" })).toHaveAttribute("href", "/annotations/articles");
    expect(within(menu).queryByRole("link", { name: "书籍+文章" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("href", "/annotations");
    fireEvent.keyDown(trigger, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const children = await screen.findByRole("group", { name: "读书录二级菜单" });
    fireEvent.click(within(children).getByRole("button", { name: "读书札记" }));
    expect(screen.getByTestId("search-route")).toHaveTextContent("/annotations/books");
  });

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
    expect(screen.queryByRole("textbox", { name: "搜索书籍、笔记、书目" })).not.toBeInTheDocument();
    fireEvent.mouseEnter(trigger);
    const input = screen.getByRole("textbox", { name: "搜索书籍、笔记、书目" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "文学" } });
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.mouseEnter(trigger);
    const reopenedInput = screen.getByRole("textbox", { name: "搜索书籍、笔记、书目" });
    fireEvent.keyDown(reopenedInput, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("textbox", { name: "搜索书籍、笔记、书目" })).toHaveValue("文学");
    fireEvent.blur(screen.getByRole("textbox", { name: "搜索书籍、笔记、书目" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("submits global search without changing local filters or submitting IME composition", () => {
    renderShell("/categories?format=PDF");
    fireEvent.click(screen.getByRole("button", { name: "展开搜索" }));
    const input = screen.getByRole("textbox", { name: "搜索书籍、笔记、书目" });
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
    expect(screen.queryByRole("link", { name: "分类" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "全站导航" })).queryByRole("link", { name: "书目" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "藏书楼" })).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.getByRole("link", { name: "读书录" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("navigation", { name: "全站导航" })).getByRole("link", { name: "秘阁" }));
    expect(screen.getByTestId("search-route")).toHaveTextContent("/vault");
    expect(screen.getByRole("link", { name: "秘阁" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "书楼漫游" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "首页" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "学脉图" })).not.toBeInTheDocument();
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

    const input = screen.getByRole("textbox", { name: "搜索书籍、笔记、书目" });
    expect(input).toHaveFocus();

  });

  it("keeps management pages in the account menu instead of the main drawer", async () => {
    renderShell("/library");
    const managementLabels = ["管理设置"];

    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const drawer = screen.getByRole("navigation", { name: "移动端导航" });
    expect(within(screen.getByRole("dialog", { name: "BookKin" })).getByRole("heading", { name: "BookKin" })).toBeInTheDocument();
    for (const label of managementLabels) expect(within(drawer).queryByText(label)).not.toBeInTheDocument();
    expect(within(drawer).queryByText("展示书目设置")).not.toBeInTheDocument();
    for (const name of ["藏书楼", "文钞馆", "书目", "读书录", "秘阁"]) expect(within(drawer).getByRole("button", { name })).toBeInTheDocument();
    const children = within(drawer).getByRole("group", { name: "藏书楼二级菜单" });
    for (const name of ["楼中一览", "书目", "学脉图", "书楼漫游"]) expect(within(children).getByRole("button", { name })).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: "楼中一览" }));
    fireEvent.click(await screen.findByRole("button", { name: "账户菜单" }));
    const accountMenu = screen.getByRole("menu");
    expect(within(accountMenu).queryByRole("menuitem", { name: "秘阁" })).not.toBeInTheDocument();
    expect(within(accountMenu).queryByRole("menuitem", { name: "用户管理" })).not.toBeInTheDocument();
    for (const label of managementLabels) expect(within(accountMenu).getByRole("menuitem", { name: label })).toBeInTheDocument();
    expect(within(accountMenu).queryByRole("menuitem", { name: "展示书目设置" })).not.toBeInTheDocument();
  });

  it("does not import 3D or prefetch its catalog while idle or approaching its link", async () => {
    vi.useFakeTimers();
    const listBooks = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
    const revision = vi.spyOn(api, "catalogRevision");
    renderShell("/library");
    const link = screen.getByRole("link", { name: "藏书楼" });
    fireEvent.mouseEnter(link); fireEvent.focus(link); fireEvent.touchStart(link);
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(sceneImported).not.toHaveBeenCalled();
    expect(listBooks).not.toHaveBeenCalled();
    expect(revision).not.toHaveBeenCalled();
  });

  it("hides the disabled 3D child in desktop and mobile navigation", async () => {
    renderShell("/library", false);
    const trigger = screen.getByRole("link", { name: "藏书楼" });
    fireEvent.mouseEnter(trigger);
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("link", { name: "学脉图" })).toBeInTheDocument();
    expect(within(menu).queryByText("书楼漫游")).not.toBeInTheDocument();
    fireEvent.keyDown(menu, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    expect(within(screen.getByRole("navigation", { name: "移动端导航" })).queryByText("书楼漫游")).not.toBeInTheDocument();
  });

  it("opens a secondary route from the desktop dropdown and keeps the parent selected", async () => {
    renderShell("/library");
    const trigger = screen.getByRole("link", { name: "藏书楼" });
    fireEvent.mouseEnter(trigger);
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map(item => item.textContent)).toEqual(["楼中一览", "书目", "学脉图", "书楼漫游"]);
    expect(screen.getByTestId("search-route")).toHaveTextContent("/library");
    expect(within(menu).getByRole("link", { name: "楼中一览" })).toHaveAttribute("href", "/library/overview");
    fireEvent.click(within(menu).getByRole("link", { name: "学脉图" }));
    expect(screen.getByTestId("search-route")).toHaveTextContent("/knowledge-graph");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-current", "page");
  });

  it.each(["/booklists", "/booklists/list-one"])("keeps booklists nested and the library active at %s", async (path) => {
    renderShell(path);
    const parent = screen.getByRole("link", { name: "藏书楼" });
    expect(parent).toHaveAttribute("aria-current", "page");
    fireEvent.keyDown(parent, { key: "ArrowDown" });
    const menu = await screen.findByRole("menu");
    const booklists = within(menu).getByRole("link", { name: "书目" });
    expect(booklists).toHaveAttribute("href", "/booklists");
    expect(booklists).toHaveAttribute("aria-current", "page");
    fireEvent.click(booklists);
    expect(screen.getByTestId("search-route")).toHaveTextContent("/booklists");
    expect(parent).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the parent a direct catalog link when its submenu is open", async () => {
    renderShell("/knowledge-graph");
    const parent = screen.getByRole("link", { name: "藏书楼" });
    expect(parent).toHaveAttribute("href", "/library");
    fireEvent.mouseEnter(parent);
    await screen.findByRole("menu");
    expect(screen.getByTestId("search-route")).toHaveTextContent("/knowledge-graph");
    fireEvent.click(parent);
    expect(screen.getByTestId("search-route")).toHaveTextContent("/library");
    expect(parent).toHaveAttribute("aria-expanded", "false");
  });

  it("navigates to the catalog through the mobile parent independently of its toggle", async () => {
    renderShell("/library/overview");
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const drawer = screen.getByRole("navigation", { name: "移动端导航" });
    fireEvent.click(within(drawer).getByRole("button", { name: "藏书楼" }));
    expect(screen.getByTestId("search-route")).toHaveTextContent("/library");
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "移动端导航" })).not.toBeInTheDocument());
  });

  it("supports keyboard opening and Escape closing of the secondary menu", async () => {
    renderShell("/virtual-library");
    const trigger = screen.getByRole("link", { name: "藏书楼" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("link", { name: "书楼漫游" })).toHaveAttribute("aria-current", "page");
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("collapses the mobile library group and navigates through its children", async () => {
    renderShell("/knowledge-graph");
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const drawer = screen.getByRole("navigation", { name: "移动端导航" });
    const parent = within(drawer).getByRole("button", { name: "藏书楼" });
    expect(parent).toHaveAttribute("aria-pressed", "true");
    const toggle = within(drawer).getByRole("button", { name: "藏书楼二级菜单" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(drawer).queryByRole("group", { name: "藏书楼二级菜单" })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    const graph = within(drawer).getByRole("button", { name: "学脉图" });
    expect(graph).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(drawer).getByRole("button", { name: "书楼漫游" }));
    expect(screen.getByTestId("search-route")).toHaveTextContent("/virtual-library");
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "移动端导航" })).not.toBeInTheDocument());
  });

  it("keeps public booklists under the library and hides private secondary entries when signed out", async () => {
    authState.signedIn = false;
    renderShell("/library");
    expect(screen.getByRole("link", { name: "藏书楼" })).toHaveAttribute("href", "/library");
    expect(screen.queryByRole("button", { name: "藏书楼" })).not.toBeInTheDocument();
    expect(screen.queryByText("学脉图")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const drawer = screen.getByRole("navigation", { name: "移动端导航" });
    expect(screen.queryByText("秘阁")).not.toBeInTheDocument();
    const children = within(drawer).getByRole("group", { name: "藏书楼二级菜单" });
    expect(within(children).getAllByRole("button")).toHaveLength(1);
    expect(within(children).getByRole("button", { name: "书目" })).toBeInTheDocument();
    expect(within(drawer).queryByText("楼中一览")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("学脉图")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("书楼漫游")).not.toBeInTheDocument();
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
