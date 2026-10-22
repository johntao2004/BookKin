// 覆盖三条私人回顾、真实时间排序、原文定位、空状态与匿名门禁。
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, vi } from "vitest";
import { api } from "../api/client";
import type { Annotation } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { RecentAnnotationsPanel } from "./RecentAnnotationsPanel";

const recent: Annotation[] = [
  { id: "fourth", bookId: "book-4", bookTitle: "较早的书", type: "NOTE", note: "较早的笔记", locator: "pdf:page=1", style: "HIGHLIGHT", createdAt: "2026-08-21T02:00:00Z" },
  { id: "bookmark", bookId: "book-5", bookTitle: "书签不应出现", type: "BOOKMARK", quote: "书签附带摘录也不应出现", locator: "pdf:page=2", style: "HIGHLIGHT", createdAt: "2026-08-22T04:00:00Z" },
  { id: "edited", bookId: "book-1", bookTitle: "山川与灯火", type: "NOTE", quote: "河面先暗了一层。", note: "记住这层暮色。", locator: "epubcfi(/6/14!/4/2:0,/1:0,/1:8)", style: "HIGHLIGHT", color: "YELLOW", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-08-22T03:00:00Z" },
  { id: "blank", bookId: "book-6", bookTitle: "空记录不应出现", type: "NOTE", quote: "  ", note: "\n", locator: "pdf:page=3", style: "HIGHLIGHT", createdAt: "2026-08-24T04:00:00Z" },
  { id: "highlight", bookId: "book-2", bookTitle: "夜航记", type: "HIGHLIGHT", quote: "灯塔在海雾里亮起。", locator: "pdf:page=7&offset=4", style: "UNDERLINE", createdAt: "2026-08-21T03:00:00Z" },
  { id: "note-only", bookId: "book-3", bookTitle: "清晨札记", type: "NOTE", note: "只有笔记也保留。", locator: "pdf:page=5", style: "HIGHLIGHT", createdAt: "2026-08-22T10:00:00+08:00" },
];

function RouteProbe() {
  const location = useLocation();
  return <output data-testid="review-route">{location.pathname}{location.search}</output>;
}

beforeEach(() => {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({id: "review-owner", username: "owner", displayName: "主人", role: "OWNER", mustChangePassword: false}));
  vi.spyOn(api, "listAnnotations").mockResolvedValue(recent);
});
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

it("reviews the latest three substantive notes/highlights by actual update time", async () => {
  render(<TestProviders><RecentAnnotationsPanel embedded /></TestProviders>);
  expect(await screen.findByRole("heading", {name: "批注回顾"})).toBeInTheDocument();
  const list = await screen.findByRole("list", {name: "批注回顾记录"});
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(within(list).getAllByRole("heading", {level: 3}).map(el => el.textContent)).toEqual(["山川与灯火", "清晨札记", "夜航记"]);
  expect(screen.getByText("河面先暗了一层。")).toBeInTheDocument();
  expect(screen.getByText("笔记：记住这层暮色。")).toBeInTheDocument();
  expect(screen.getByText("笔记：只有笔记也保留。")).toBeInTheDocument();
  expect(screen.getByText("灯塔在海雾里亮起。")).toBeInTheDocument();
  for (const text of ["较早的书", "书签不应出现", "空记录不应出现"]) expect(screen.queryByText(text)).not.toBeInTheDocument();
  expect(api.listAnnotations).toHaveBeenCalledWith();
});

it("returns to exact EPUB and PDF annotation locations including reserved URL characters", async () => {
  render(<TestProviders><RecentAnnotationsPanel /><RouteProbe /></TestProviders>);
  const epub = await screen.findByRole("link", {name: "返回《山川与灯火》原文"});
  const epubTarget = new URL(epub.getAttribute("href")!, "http://localhost");
  expect(epubTarget.pathname).toBe("/reader/book-1");
  expect(epubTarget.searchParams.get("locator")).toBe(recent[2].locator);
  const pdf = screen.getByRole("link", {name: "返回《夜航记》原文"});
  const pdfTarget = new URL(pdf.getAttribute("href")!, "http://localhost");
  expect(pdfTarget.pathname).toBe("/reader/book-2");
  expect(pdfTarget.searchParams.get("locator")).toBe("pdf:page=7&offset=4");
  fireEvent.click(pdf);
  const route = new URL(screen.getByTestId("review-route").textContent!, "http://localhost");
  expect(route.pathname).toBe("/reader/book-2");
  expect(route.searchParams.get("locator")).toBe("pdf:page=7&offset=4");
});

it("keeps the existing plain empty state without adding a reading action", async () => {
  vi.mocked(api.listAnnotations).mockResolvedValue([]);
  render(<TestProviders><RecentAnnotationsPanel embedded /></TestProviders>);
  expect(await screen.findByRole("heading", {name: "暂无批注"})).toHaveClass("bk-typography-h4");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("does not turn legacy missing positions into misleading original-text links", async () => {
  vi.mocked(api.listAnnotations).mockResolvedValue([{...recent[2], locator: undefined}]);
  render(<TestProviders><RecentAnnotationsPanel /></TestProviders>);
  expect(await screen.findByText("原文位置缺失")).toBeInTheDocument();
  expect(screen.getByText("河面先暗了一层。")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("keeps loading and failures distinct from confirmed empty annotations", async () => {
  let reject: (reason: Error) => void = () => {};
  vi.mocked(api.listAnnotations).mockReturnValue(new Promise((_, fail) => {reject = fail;}));
  render(<TestProviders><RecentAnnotationsPanel /></TestProviders>);
  expect(await screen.findByRole("status", {name: "正在整理批注回顾"})).toBeInTheDocument();
  expect(screen.queryByText("暂无批注")).not.toBeInTheDocument();
  reject(new Error("unavailable"));
  expect(await screen.findByText("暂时无法读取批注，不影响继续阅读。")).toBeInTheDocument();
  expect(screen.queryByText("暂无批注")).not.toBeInTheDocument();
});

it("does not request private annotations when the user is signed out", async () => {
  sessionStorage.clear();
  render(<TestProviders><RecentAnnotationsPanel /></TestProviders>);
  await waitFor(() => expect(screen.queryByRole("heading", {name: "批注回顾"})).not.toBeInTheDocument());
  expect(api.listAnnotations).not.toHaveBeenCalled();
});
