import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { ReadingOverview } from "../domain/types";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { LibraryOverviewPage } from "./LibraryOverviewPage";

const emptyOverview = (): ReadingOverview => ({
  today: "2026-10-22", featuredBook: null, recentReading: [],
  stats: {weekStart: "2026-10-19", weekEnd: "2026-10-25", totalSeconds: 0, previousWeekSeconds: 0,
    days: Array.from({length: 7}, (_, index) => ({date: `2026-10-${19 + index}`, seconds: 0}))},
});
beforeEach(() => {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false }));
  vi.spyOn(api, "getReadingOverview").mockResolvedValue(emptyOverview());
});
afterEach(() => vi.restoreAllMocks());
it("preserves all four overview cards and empty states on its own page", async () => {
  render(<TestProviders initialPath="/library/overview"><LibraryOverviewPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "本周暂无新书" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "阁中一览", level: 1 })).toBeInTheDocument();
  const overview = screen.getByRole("region", { name: "书库概览" });
  for (const name of ["本周新藏", "批注回顾", "本周阅读时长", "最近阅读"]) expect(within(overview).getByRole("heading", { name })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "全部藏书" })).toHaveAttribute("href", "/library");
  expect(screen.queryByRole("combobox", { name: "格式" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "上传书籍" })).not.toBeInTheDocument();
});
it("ignores catalog filters and the retired overview-hidden preference", async () => {
  localStorage.setItem("bookkin-library-overview:user-owner", "hidden");
  const list = vi.spyOn(api, "listBooks");
  render(<TestProviders initialPath="/library/overview?q=missing&format=PDF"><LibraryOverviewPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "本周暂无新书" })).toBeInTheDocument();
  expect(list).not.toHaveBeenCalled();
  expect(api.getReadingOverview).toHaveBeenCalledWith(expect.any(AbortSignal));
  expect(screen.queryByRole("button", { name: "显示概览" })).not.toBeInTheDocument();
  localStorage.removeItem("bookkin-library-overview:user-owner");
});
it("retains zero-progress guidance and aligned private-annotation empty state", async () => {
  vi.mocked(api.getReadingOverview).mockResolvedValue({...emptyOverview(), featuredBook: {...demoBooks[0], progress: 50}});
  const { container } = render(<TestProviders initialPath="/library/overview"><LibraryOverviewPage /></TestProviders>);
  const progressTitle = await screen.findByRole("heading", { name: "请开始阅读" });
  const currentReading = container.querySelector<HTMLElement>('[aria-labelledby="recent-reading-card-title"]')!;
  expect(within(currentReading).getByText("打开任意一本书后，阅读进度会显示在这里。")).toBeInTheDocument();
  expect(within(currentReading).queryByRole("button")).not.toBeInTheDocument();
  const recent = await screen.findByRole("region", { name: "批注回顾" });
  const recentTitle = await within(recent).findByRole("heading", { name: "暂无批注" });
  expect(progressTitle).toHaveClass("bk-typography-h4"); expect(recentTitle).toHaveClass("bk-typography-h4");
  const stats = container.querySelector('[aria-labelledby="reading-time-title"]');
  expect(stats?.compareDocumentPosition(currentReading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});
it("shows a retryable failure instead of pretending the overview is empty", async () => {
  const books = vi.mocked(api.getReadingOverview).mockRejectedValue(new Error("unavailable"));
  render(<TestProviders initialPath="/library/overview"><LibraryOverviewPage /></TestProviders>);
  expect(await screen.findByText("阅读概览暂时无法读取。")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "本周暂无新书" })).not.toBeInTheDocument();
  books.mockResolvedValue(emptyOverview()); fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "本周暂无新书" })).toBeInTheDocument());
});

it("shows three saved recent positions with real progress and no invented chapter", async () => {
  const recentReading: ReadingOverview["recentReading"] = [
    {book: {...demoBooks[0], id: "first", title: "最近阅读一", format: "PDF", progress: 80}, position: {bookId: "first", locator: "pdf:page=12", progress: 0, updatedAt: "2026-10-22T10:00:00Z"}},
    {book: {...demoBooks[0], id: "second", title: "最近阅读二", format: "EPUB"}, position: {bookId: "second", locator: "epubcfi(/6/14!/4/2)", progress: 0.42, updatedAt: "2026-10-22T09:00:00Z"}},
    {book: {...demoBooks[0], id: "third", title: "最近阅读三", format: "PDF"}, position: {bookId: "third", locator: "pdf:page=90&offset=2", progress: 1, updatedAt: "2026-10-22T08:00:00Z"}},
  ];
  vi.mocked(api.getReadingOverview).mockResolvedValue({...emptyOverview(), recentReading});
  render(<TestProviders initialPath="/library/overview"><LibraryOverviewPage /></TestProviders>);
  const list = await screen.findByRole("list", {name: "最近阅读书籍"});
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(within(list).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/reader/first", "/reader/second", "/reader/third"]);
  const links = within(list).getAllByRole("link");
  expect(links[0]).toHaveTextContent("已读 0%");
  expect(links[0]).toHaveTextContent("第 12 页");
  expect(links[1]).toHaveTextContent("已读 42%");
  expect(links[1]).toHaveTextContent("已保存阅读位置");
  expect(links[2]).toHaveTextContent("已读 100%");
  expect(links[2]).toHaveTextContent("第 90 页");
  expect(screen.queryByText("第 7 章")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", {name: "本周暂无新书"})).toBeInTheDocument();
});
