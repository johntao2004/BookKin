import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { BatchRenameDialog } from "./BatchRenameDialog";

describe("BatchRenameDialog", () => {
  it("requires selection and shows a complete preview before submitting", async () => {
    const completed = vi.fn();
    const closed = vi.fn();
    render(
      <TestProviders>
        <BatchRenameDialog open books={demoBooks.slice(0, 2)} onClose={closed} onCompleted={completed} />
      </TestProviders>,
    );

    expect(screen.getByRole("button", { name: "预览 0 项变更" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: `选择${demoBooks[0].title}` }));
    fireEvent.click(screen.getByRole("button", { name: "预览 1 项变更" }));

    await waitFor(() => expect(screen.getByText("已生成 1 项变更，其中 1 项可以提交。存在冲突的项目不会执行。")).toBeInTheDocument());
    expect(screen.getByText(`原：${demoBooks[0].libraryRoot}/${demoBooks[0].relativePath}`)).toBeInTheDocument();
    expect(screen.getByText(/新：.*灯火集.*山川与灯火\.epub/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "提交 1 个任务" }));
    await waitFor(() => expect(completed).toHaveBeenCalledWith("已提交 1 个重命名任务"));
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
