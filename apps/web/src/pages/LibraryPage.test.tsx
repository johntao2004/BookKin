import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { LibraryPage } from "./LibraryPage";
function RouteSearch() { const location = useLocation(); return <output data-testid="route-search">{location.search}</output>; }

beforeEach(() => {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false }));
});
afterEach(() => vi.restoreAllMocks());

it("keeps the catalog independent of overview data and removes the visibility switch", async () => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  const stats = vi.spyOn(api, "getWeeklyReadingStats");
  const annotations = vi.spyOn(api, "listAnnotations");
  render(<TestProviders initialPath="/library"><LibraryPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "藏书楼", level: 1 })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "全部藏书", level: 2 })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "上传书籍" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "书库概览" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /[显隐][示藏]概览/ })).not.toBeInTheDocument();
  expect(stats).not.toHaveBeenCalled();
  expect(annotations).not.toHaveBeenCalled();
});

it("switches private/public scopes while retaining catalog filters", async () => {
  const privateBooks = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  const publicBooks = vi.spyOn(api, "listDisplayBooks").mockResolvedValue({ items: [], revision: 1 });
  render(<TestProviders initialPath="/library?format=PDF&q=river&sort=title"><><LibraryPage /><RouteSearch /></></TestProviders>);
  fireEvent.mouseDown(await screen.findByRole("combobox", { name: "馆藏范围" }));
  fireEvent.click(await screen.findByText("公开藏书", { exact: true }));
  expect(await screen.findByRole("heading", { name: "公开藏书" })).toBeInTheDocument();
  await waitFor(() => expect(publicBooks).toHaveBeenCalledWith(expect.objectContaining({ q: "river", format: "PDF", sort: "title" })));
  expect(screen.queryByRole("button", { name: "上传书籍" })).not.toBeInTheDocument();
  expect(screen.getByTestId("route-search")).toHaveTextContent("scope=public");
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "馆藏范围" }));
  fireEvent.click(await screen.findByText("全部藏书", { exact: true }));
  expect(await screen.findByRole("heading", { name: "全部藏书" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "上传书籍" })).toBeInTheDocument();
  expect(privateBooks).toHaveBeenCalledWith(expect.objectContaining({ q: "river", format: "PDF", sort: "title" }));
  expect(screen.getByTestId("route-search")).not.toHaveTextContent("scope=public");
});

it.each(["/library/all", "/library/all?sort=title"])("does not show reset for an unfiltered empty catalog %s", async initialPath => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  render(<TestProviders initialPath={initialPath}><LibraryPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "暂无书籍" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "清除筛选" })).not.toBeInTheDocument();
});
it.each(["/library?format=PDF", "/library?q=not-found"])("can reset an empty filtered catalog %s", async initialPath => {
  vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  render(<TestProviders initialPath={initialPath}><LibraryPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "未找到匹配的书籍" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "清除筛选" })).toBeInTheDocument();
});
it("clears search and format while preserving sort and other URL parameters", async () => {
  const listBooks = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
  render(<TestProviders initialPath="/library?format=PDF&q=not-found&sort=title&view=compact"><><LibraryPage /><RouteSearch /></></TestProviders>);
  fireEvent.click(await screen.findByRole("button", { name: "清除筛选" }));
  await waitFor(() => {
    const params = new URLSearchParams(screen.getByTestId("route-search").textContent ?? "");
    expect(params.has("q")).toBe(false); expect(params.has("format")).toBe(false);
    expect(params.get("sort")).toBe("title"); expect(params.get("view")).toBe("compact");
  });
  await waitFor(() => expect(listBooks).toHaveBeenLastCalledWith(expect.objectContaining({ q: undefined, format: undefined, sort: "title" })));
});
it("filters the gallery from URL search without mounting overview modules", async () => {
  render(<TestProviders initialPath="/library?q=夜航"><LibraryPage /></TestProviders>);
  expect(await screen.findByText("夜航记")).toBeInTheDocument();
  expect(screen.getByText("找到 1 本相关藏书")).toBeInTheDocument();
  expect(screen.queryByText("夏日植物学")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "批注回顾" })).not.toBeInTheDocument();
});
it("shows a working back-to-top action after scrolling", async () => {
  const originalScrollY = window.scrollY;
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  render(<TestProviders initialPath="/library"><LibraryPage /></TestProviders>);
  expect(screen.queryByRole("button", { name: "回到顶部" })).not.toBeInTheDocument();
  Object.defineProperty(window, "scrollY", { configurable: true, value: 600 }); fireEvent.scroll(window);
  fireEvent.click(await screen.findByRole("button", { name: "回到顶部" }));
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  Object.defineProperty(window, "scrollY", { configurable: true, value: originalScrollY });
});
