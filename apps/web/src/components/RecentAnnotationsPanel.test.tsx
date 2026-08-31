import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import type { Annotation } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { RecentAnnotationsPanel } from "./RecentAnnotationsPanel";

const recent: Annotation[] = [
  {
    id: "annotation-new",
    bookId: "book-1",
    bookTitle: "山川与灯火",
    bookAuthor: "顾远",
    type: "NOTE",
    quote: "河面先暗了一层。",
    note: "记住这层暮色。",
    locator: "epubcfi(/6/14!/4/2)",
    style: "HIGHLIGHT",
    color: "YELLOW",
    createdAt: "2026-08-22T02:00:00Z",
    updatedAt: "2026-08-22T03:00:00Z",
  },
  {
    id: "annotation-second",
    bookId: "book-2",
    bookTitle: "夜航记",
    bookAuthor: "林栖迟",
    type: "HIGHLIGHT",
    quote: "灯塔在海雾里亮起。",
    locator: "pdf:page=7",
    style: "UNDERLINE",
    createdAt: "2026-08-21T03:00:00Z",
  },
  {
    id: "annotation-bookmark",
    bookId: "book-3",
    bookTitle: "不应出现",
    type: "BOOKMARK",
    locator: "pdf:page=2",
    style: "HIGHLIGHT",
    createdAt: "2026-08-22T04:00:00Z",
  },
];

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="当前路径">{location.pathname}{location.search}</output>;
}

describe("RecentAnnotationsPanel", () => {
  beforeEach(() => {
    vi.spyOn(api, "listAnnotations").mockResolvedValue(recent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("只展示最新的一条私人批注并排除书签", async () => {
    render(<TestProviders><RecentAnnotationsPanel fallbackBookId="book-1" /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "最近批注" })).toBeInTheDocument();
    expect(await screen.findByText("河面先暗了一层。")).toBeInTheDocument();
    expect(screen.queryByText("灯塔在海雾里亮起。")).not.toBeInTheDocument();
    expect(screen.queryByText("不应出现")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看全部笔记" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /回到/ })).not.toBeInTheDocument();
    expect(api.listAnnotations).toHaveBeenCalledWith();
  });

  it("无批注时引导用户进入阅读", async () => {
    vi.mocked(api.listAnnotations).mockResolvedValueOnce([]);
    render(<TestProviders><RecentAnnotationsPanel fallbackBookId="book-1" /><LocationProbe /></TestProviders>);

    expect(await screen.findByText("还没有批注")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "去阅读" }));
    expect(screen.getByRole("status", { name: "当前路径" })).toHaveTextContent("/reader/book-1");
  });

  it("异步加载批注后按卡片高度重新计算可展示行数", async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      observe = observe;
      disconnect = disconnect;
    });

    render(<TestProviders><RecentAnnotationsPanel fallbackBookId="book-1" embedded /></TestProviders>);

    expect(await screen.findByText("河面先暗了一层。")).toBeInTheDocument();
    await waitFor(() => expect(observe).toHaveBeenCalled());
  });
});
