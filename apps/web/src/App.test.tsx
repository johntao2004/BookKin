// 验证私有页面在匿名访问时不挂载，并区分公开发现入口与角色不足的 403。
// Checks private content never mounts anonymously and distinguishes public discovery from role-denied 403 routes.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { articles } from "./features/content/api";
import { api } from "./api/client";
import { readingPosts } from "./features/notes/posts-api";
import { articleNotesApi } from "./features/notes/api";
import { TestProviders } from "./test/TestProviders";

const member = {
  id: "user-member",
  username: "member",
  displayName: "家庭成员",
  role: "MEMBER",
  mustChangePassword: false,
};

function RouteLocationProbe() {
  const location = useLocation();
  return <output data-testid="route-location">{`${location.pathname}${location.search}${location.hash}`}</output>;
}

function ReturnToProbe() {
  const location = useLocation();
  return <output data-testid="return-to">{(location.state as { from?: string } | null)?.from}</output>;
}

describe("App route permissions", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it.each(["/annotations", "/annotations/books", "/annotations/articles", "/annotations/all", "/annotations/posts/article/post-1"])("protects the reading-note page %s before loading private posts", async path => {
    const list = vi.spyOn(readingPosts, "list");
    const get = vi.spyOn(readingPosts, "get");
    render(<TestProviders initialPath={path}><App /></TestProviders>);
    expect(await screen.findByRole("heading", { name: "这间书房暂未为你开门" })).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it.each([
    ["/annotations", "/annotations"],
    ["/annotations/all?view=cards#notes", "/annotations?view=cards#notes"],
  ])("uses the parent notes page as the overview for %s", async (initialPath, expectedPath) => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(member));
    vi.spyOn(api, "listAnnotationBooks").mockResolvedValue({ items: [] });
    vi.spyOn(articleNotesApi, "list").mockResolvedValue([]);
    vi.spyOn(articles, "list").mockResolvedValue([]);
    vi.spyOn(readingPosts, "list").mockResolvedValue({ items: [], nextCursor: null });
    render(<TestProviders initialPath={initialPath}><RouteLocationProbe /><App /></TestProviders>);
    expect(await screen.findByRole("heading", { name: "读书录", level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId("route-location")).toHaveTextContent(expectedPath);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("书籍+文章")).not.toBeInTheDocument();
  });

  it("serves only the public catalog at the unified anonymous entry even with an all scope", async () => {
    const privateBooks = vi.spyOn(api, "listBooks");
    const stats = vi.spyOn(api, "getWeeklyReadingStats");
    const publicBooks = vi.spyOn(api, "listDisplayBooks").mockResolvedValue({ items: [], revision: 1 });
    render(<TestProviders initialPath="/library?scope=all"><App /></TestProviders>);
    expect(await screen.findByRole("heading", { name: "藏书楼", level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(publicBooks).toHaveBeenCalled());
    expect(privateBooks).not.toHaveBeenCalled();
    expect(stats).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "上传书籍" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "文钞馆" })).not.toBeInTheDocument();
  });

  it.each(["MEMBER", "ADMIN", "OWNER"])("opens the merged library for %s and retains management permissions", async role => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ ...member, role }));
    vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
    render(<TestProviders initialPath="/library"><App /></TestProviders>);
    expect(await screen.findByRole("heading", { name: "全部藏书" })).toBeInTheDocument();
    expect(Boolean(screen.queryByRole("button", { name: "上传书籍" }))).toBe(role !== "MEMBER");
    expect(screen.queryByRole("link", { name: "学脉图" })).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole("link", { name: "藏书楼" }));
    expect(await screen.findByRole("link", { name: "学脉图" })).toHaveAttribute("href", "/knowledge-graph");
  });

  it("blocks anonymous overview access before private requests mount", async () => {
    const overview = vi.spyOn(api, "getReadingOverview");
    const books = vi.spyOn(api, "listBooks");
    const stats = vi.spyOn(api, "getWeeklyReadingStats");
    render(<TestProviders initialPath="/library/overview"><App /></TestProviders>);
    expect(await screen.findByRole("heading", { name: "这间书房暂未为你开门" })).toBeInTheDocument();
    expect(books).not.toHaveBeenCalled();
    expect(stats).not.toHaveBeenCalled();
    expect(overview).not.toHaveBeenCalled();
  });

  it.each(["MEMBER", "ADMIN", "OWNER"])("opens the standalone overview for %s", async role => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ ...member, role }));
    vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
    render(<TestProviders initialPath="/library/overview"><App /></TestProviders>);
    expect(await screen.findByRole("heading", { name: "楼中一览", level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "书库概览" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "全部藏书" })).not.toBeInTheDocument();
  });

  it("keeps filters, hash and return state when normalizing the old private library address", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(member));
    render(<TestProviders initialPath="/library/all?q=river&format=PDF&sort=title#books"><><App /><RouteLocationProbe /></></TestProviders>);
    await waitFor(() => expect(screen.getByTestId("route-location")).toHaveTextContent("/library?q=river&format=PDF&sort=title#books"));
  });

  it.each(["/recycle-bin", "/admin/recycle-bin"])("keeps members out of the regrouped recycle bin through %s", async path => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(member));
    render(<TestProviders initialPath={path}><App /></TestProviders>);
    expect(await screen.findByRole("heading", { name: "这把钥匙打不开这一页" })).toBeInTheDocument();
  });

  it.each(["/articles?tag=essay&sort=title#catalog", "/articles/article-one"])("requires login for %s without requesting article content", async (path) => {
    const list = vi.spyOn(articles, "list").mockResolvedValue([]);
    const get = vi.spyOn(articles, "get");
    render(<TestProviders initialPath={path}><><App /><RouteLocationProbe /><ReturnToProbe /></></TestProviders>);

    expect(await screen.findByRole("heading", { name: "这间书房暂未为你开门" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "文钞馆" })).not.toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "登录" }));
    await waitFor(() => expect(screen.getByTestId("route-location")).toHaveTextContent("/login"));
    expect(screen.getByTestId("return-to")).toHaveTextContent(path);
  });

  it.each(["MEMBER", "ADMIN", "OWNER"])("allows a signed-in %s to view article collections", async (role) => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ ...member, role }));
    const list = vi.spyOn(articles, "list").mockResolvedValue([]);
    render(<TestProviders initialPath="/articles"><App /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "文钞馆" })).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "文钞馆" })).toHaveAttribute("href", "/articles");
  });

  it("blocks a signed-out direct visit before private library content mounts", async () => {
    render(<TestProviders initialPath="/library/all"><App /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "这间书房暂未为你开门" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "全部藏书" })).not.toBeInTheDocument();
  });

  it("blocks a signed-out direct visit to a book detail before private metadata mounts", async () => {
    render(<TestProviders initialPath="/library/books/book-1"><App /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "这间书房暂未为你开门" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "书籍详情" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "山川与灯火" })).not.toBeInTheDocument();
  });

  it("blocks a signed-out direct visit to the optional 3D route", async () => {
    render(<TestProviders initialPath="/virtual-library"><App /></TestProviders>);
    expect(await screen.findByRole("heading", {name:"这间书房暂未为你开门"})).toBeInTheDocument();
    expect(screen.queryByRole("region", {name:"虚拟 3D 图书馆"})).not.toBeInTheDocument();
  });

  it("keeps the explicit public discovery route available anonymously", async () => {
    render(<TestProviders initialPath="/library"><App /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "藏书楼", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("401 · 需要登录")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "文钞馆" })).not.toBeInTheDocument();
  });

  it("redirects legacy category routes into the signed-in library and preserves filters", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(member));
    render(<TestProviders initialPath="/categories/path-category?category=query-category&manage=1&q=lamp&format=PDF&sort=title#results"><><App /><RouteLocationProbe /></></TestProviders>);

    await waitFor(() => expect(screen.getByTestId("route-location")).toHaveTextContent("/library?"));
    const redirected = new URL(screen.getByTestId("route-location").textContent ?? "", window.location.origin);
    expect(redirected.pathname).toBe("/library");
    expect(redirected.searchParams.get("category")).toBe("path-category");
    expect(redirected.searchParams.get("advanced")).toBe("1");
    expect(redirected.searchParams.get("manage")).toBe("1");
    expect(redirected.searchParams.get("q")).toBe("lamp");
    expect(redirected.searchParams.get("format")).toBe("PDF");
    expect(redirected.searchParams.get("sort")).toBe("title");
    expect(redirected.hash).toBe("#results");
  });

  it("redirects legacy category browse visits to the anonymous library and retains query category", async () => {
    render(<TestProviders initialPath="/categories?category=fiction&manage=0&q=river&format=EPUB&sort=author#books"><><App /><RouteLocationProbe /></></TestProviders>);

    await waitFor(() => expect(screen.getByTestId("route-location")).toHaveTextContent("/library?"));
    const redirected = new URL(screen.getByTestId("route-location").textContent ?? "", window.location.origin);
    expect(redirected.pathname).toBe("/library");
    expect(redirected.searchParams.get("category")).toBe("fiction");
    expect(redirected.searchParams.get("advanced")).toBe("1");
    expect(redirected.searchParams.get("manage")).toBe("0");
    expect(redirected.searchParams.get("q")).toBe("river");
    expect(redirected.searchParams.get("format")).toBe("EPUB");
    expect(redirected.searchParams.get("sort")).toBe("author");
    expect(redirected.hash).toBe("#books");
  });

  it("does not reuse category-name search text as an anonymous book filter", async () => {
    render(<TestProviders initialPath="/search?q=文学"><App /></TestProviders>);

    const categoryLink = await screen.findByRole("link", { name: "文学与叙事" }, { timeout: 5_000 });
    const target = new URL(categoryLink.getAttribute("href") ?? "", window.location.origin);
    expect(target.pathname).toBe("/library");
    expect(target.searchParams.get("category")).toBe("category-literature");
    expect(target.searchParams.get("advanced")).toBe("1");
    expect(target.searchParams.get("q")).toBeNull();
  });

  it("does not reuse category-name search text as a signed-in book filter", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(member));
    render(<TestProviders initialPath="/search?q=文学"><App /></TestProviders>);

    const categoryLink = await screen.findByRole("link", { name: "文学与叙事" }, { timeout: 5_000 });
    const target = new URL(categoryLink.getAttribute("href") ?? "", window.location.origin);
    expect(target.pathname).toBe("/library");
    expect(target.searchParams.get("category")).toBe("category-literature");
    expect(target.searchParams.get("advanced")).toBe("1");
    expect(target.searchParams.get("q")).toBeNull();
  });

  it("shows the 403 route page for an authenticated member on administration routes", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(member));
    render(<TestProviders initialPath="/admin/users"><App /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "这把钥匙打不开这一页" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "用户管理" })).not.toBeInTheDocument();
  });
});
