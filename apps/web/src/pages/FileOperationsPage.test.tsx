import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { FileOperationsPage } from "./FileOperationsPage";

describe("FileOperationsPage", () => {
  beforeEach(() => {
    vi.spyOn(api, "listFileOperations").mockResolvedValue([
      {
        id: "operation-1",
        type: "TRASH",
        status: "SUCCEEDED",
        sourcePath: "顾安安/声之来信.epub",
        targetPath: ".bookkin-trash/4fa12d/声之来信.epub",
        createdAt: "2026-08-20T07:02:00Z",
        stage: "COMPLETE",
      },
      {
        id: "operation-2",
        type: "WRITE_METADATA",
        status: "SUCCEEDED",
        sourcePath: "顾远/山川与灯火.epub",
        targetPath: "顾远/山川与灯火.epub",
        createdAt: "2026-08-19T13:02:00Z",
        stage: "COMPLETE",
      },
    ]);
  });

  afterEach(() => vi.restoreAllMocks());

  it("用紧凑表格呈现任务，并移除已完成阶段的重复信息", async () => {
    render(<TestProviders><FileOperationsPage /></TestProviders>);

    const table = await screen.findByRole("table", { name: "文件任务列表" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "任务",
      "文件变更",
      "状态",
      "时间",
    ]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText(".bookkin-trash/4fa12d/声之来信.epub")).toBeInTheDocument();
    expect(within(table).getAllByText("已完成")).toHaveLength(2);
    expect(within(table).queryByText("COMPLETE")).not.toBeInTheDocument();
    expect(within(table).getAllByText("顾远/山川与灯火.epub")).toHaveLength(1);
  });

  it("保留清楚的空状态引导", async () => {
    vi.mocked(api.listFileOperations).mockResolvedValueOnce([]);

    render(<TestProviders><FileOperationsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "暂无文任务" })).toBeInTheDocument();
    expect(screen.getByText("从藏书卡片的更多菜单发起安全预览。")).toBeInTheDocument();
  });
});
