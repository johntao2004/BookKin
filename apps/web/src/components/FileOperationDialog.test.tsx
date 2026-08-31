import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import type { FileOperationPreview } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { FileOperationDialog } from "./FileOperationDialog";

describe("FileOperationDialog", () => {
  it("重命名只输入书名，路径和扩展名交给服务端计算", async () => {
    const previewRequest = vi.spyOn(api, "previewFileOperation").mockResolvedValue({
      previewToken: "rename-preview",
      type: "RENAME",
      sourcePath: `${demoBooks[0].libraryRoot}/${demoBooks[0].relativePath}`,
      targetPath: `${demoBooks[0].libraryRoot}/顾远/新书名.epub`,
      requiredBytes: 0,
      expectedFingerprint: demoBooks[0].fingerprint,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      conflicts: [],
      warnings: [],
    } satisfies FileOperationPreview);
    render(
      <TestProviders>
        <FileOperationDialog book={demoBooks[0]} type="RENAME" onClose={() => undefined} onCompleted={vi.fn()} />
      </TestProviders>,
    );

    const input = screen.getByRole("textbox", { name: "新书名" });
    expect(input).toHaveValue(demoBooks[0].title);
    expect(input).not.toHaveValue(`${demoBooks[0].author}/${demoBooks[0].title}.${demoBooks[0].format.toLowerCase()}`);
    fireEvent.change(input, { target: { value: "新书名" } });
    fireEvent.click(screen.getByRole("button", { name: "生成安全预览" }));

    await waitFor(() => expect(previewRequest).toHaveBeenCalledWith(demoBooks[0], "RENAME", "新书名"));
    expect(await screen.findByText("家庭藏书/顾远/新书名.epub")).toBeInTheDocument();
  });

  it("automatically prepares the trash preview and waits for the second confirmation", async () => {
    const completed = vi.fn();
    render(
      <TestProviders>
        <FileOperationDialog book={demoBooks[0]} type="TRASH" onClose={() => undefined} onCompleted={completed} />
      </TestProviders>,
    );

    const execute = screen.getByRole("button", { name: "确认移入回收站" });
    expect(execute).toBeDisabled();
    expect(screen.queryByRole("button", { name: "生成安全预览" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/文件保留 30 天/)).toBeInTheDocument());
    expect(screen.queryByText("预览已生成")).not.toBeInTheDocument();
    expect(screen.queryByText("预期指纹")).not.toBeInTheDocument();
    expect(screen.queryByText("空间需求")).not.toBeInTheDocument();
    expect(screen.queryByText("重新检查")).not.toBeInTheDocument();
    expect(execute).toBeEnabled();
    expect(completed).not.toHaveBeenCalled();
    fireEvent.click(execute);
    await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
  });

  it("执行请求失败后恢复操作，不会永久卡在删除中", async () => {
    const execute = vi.spyOn(api, "executeFileOperation").mockRejectedValueOnce(new Error("请求超时，请刷新后重试。"));
    render(
      <TestProviders>
        <FileOperationDialog book={demoBooks[1]} type="TRASH" onClose={() => undefined} onCompleted={vi.fn()} />
      </TestProviders>,
    );

    const confirm = await screen.findByRole("button", { name: "确认移入回收站" });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    expect(await screen.findByText("请求超时，请刷新后重试。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认移入回收站" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
