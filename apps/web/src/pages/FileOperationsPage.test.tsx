// 覆盖后台任务表格与空态，完成任务不重复显示无用阶段信息。
// Covers background task rows and empty states without redundant stage details after completion.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { FileOperationsPage } from "./FileOperationsPage";

describe("FileOperationsPage", () => {
  beforeEach(() => {
    vi.spyOn(api, "listFileTaskHistoryPage").mockResolvedValue({ items: [
      { id: "op-1", type: "FILE_OPERATION", action: "TRASH", status: "SUCCEEDED", title: "声之来信", originalFilename: "声之来信.epub", createdAt: "2026-08-20T07:02:00Z", updatedAt: "2026-08-20T07:02:00Z" },
      { id: "op-1", type: "BOOK_UPLOAD", action: null, status: "INSPECTING", title: "待整理上传", originalFilename: "draft.epub", createdAt: "2026-08-19T07:02:00Z", updatedAt: "2026-08-19T07:02:00Z" },
      { id: "op-2", type: "FILE_OPERATION", action: "WRITE_METADATA", status: "SUCCEEDED", title: "山川与灯火", originalFilename: "山川与灯火.epub", createdAt: "2026-08-18T07:02:00Z", updatedAt: "2026-08-18T07:02:00Z" },
      { id: "op-3", type: "FILE_OPERATION", action: "RENAME", status: "RUNNING", title: "运行中书籍", originalFilename: "running.epub", createdAt: "2026-08-17T07:02:00Z", updatedAt: "2026-08-17T07:02:00Z", stage: "VALIDATING" },
    ], total: 4 });
  });

  afterEach(() => vi.restoreAllMocks());

  it("用紧凑表格呈现任务，并移除已完成阶段的重复信息", async () => {
    render(<TestProviders><FileOperationsPage /></TestProviders>);

    const table = await screen.findByRole("table", { name: "操作日志列表" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "任务",
      "书籍",
      "状态",
      "时间",
    ]);
    await within(table).findByText("声之来信");
    expect(within(table).getAllByRole("row")).toHaveLength(5);
    expect(within(table).getByText("声之来信")).toBeInTheDocument();
    expect(within(table).getByText("待整理上传")).toBeInTheDocument();
    expect(within(table).getByText("上传书籍")).toBeInTheDocument();
    expect(within(table).getByText("检查中")).toBeInTheDocument();
    expect(within(table).getByText("正在处理")).toBeInTheDocument();
    expect(table).not.toHaveTextContent("VALIDATING");
    expect(within(table).getAllByRole("row")).toHaveLength(5);
    expect(table.querySelector("[title]")).toBeNull();
    expect(within(table).getAllByText("已完成")).toHaveLength(2);
    expect(within(table).queryByText("COMPLETE")).not.toBeInTheDocument();
    expect(within(table).getAllByText("山川与灯火")).toHaveLength(1);
  });

  it("保留清楚的空状态引导", async () => {
    vi.mocked(api.listFileTaskHistoryPage).mockResolvedValueOnce({ items: [], total: 0 });

    render(<TestProviders><FileOperationsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "暂无文件任务" })).toBeInTheDocument();
    expect(screen.getByText("书籍操作与上传任务会显示在这里。")).toBeInTheDocument();
  });

  it("使用服务端页码和准确总数，失败时显示错误", async () => {
    render(<TestProviders><FileOperationsPage /></TestProviders>);
    await screen.findByText("声之来信");
    expect(api.listFileTaskHistoryPage).toHaveBeenCalledWith(0, 10);
    expect(screen.getByText(/共 4 条/)).toBeInTheDocument();
    vi.mocked(api.listFileTaskHistoryPage).mockRejectedValueOnce(new Error("offline"));
    // Refresh query through the page action to exercise the visible failure state.
    screen.getByRole("button", { name: "刷新" }).click();
    expect(await screen.findByText("无法读取操作日志，请刷新重试。")).toBeInTheDocument();
  });

  it("切换到下一页时向服务端请求第二页，保持返回顺序", async () => {
    vi.mocked(api.listFileTaskHistoryPage).mockImplementation(async (page = 0, _pageSize = 10) => ({
      items: page === 0
        ? [{ id: "page-0", type: "BOOK_UPLOAD", action: null, status: "READY_FOR_REVIEW", title: "第一页首项", originalFilename: "one.epub", createdAt: "2026-08-20T07:02:00Z", updatedAt: "2026-08-20T07:02:00Z" }]
        : [{ id: "page-1", type: "BOOK_UPLOAD", action: null, status: "FAILED", title: "第二页首项", originalFilename: "two.epub", createdAt: "2026-08-19T07:02:00Z", updatedAt: "2026-08-19T07:02:00Z" }],
      total: 11,
    }));
    render(<TestProviders><FileOperationsPage /></TestProviders>);
    await screen.findByText("第一页首项");
    fireEvent.click(screen.getByTitle("下一页"));
    await screen.findByText("第二页首项");
    expect(api.listFileTaskHistoryPage).toHaveBeenLastCalledWith(1, 10);
  });
});
