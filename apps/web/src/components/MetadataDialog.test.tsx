import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { MetadataDialog } from "./MetadataDialog";

describe("MetadataDialog", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the edit form concise without explanatory copy or a save icon", async () => {
    render(
      <TestProviders>
        <MetadataDialog book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );

    await screen.findByDisplayValue(demoBooks[0].title);
    expect(screen.getByRole("heading", { name: "编辑元信息" })).toBeInTheDocument();
    expect(screen.queryByText("不勾选时只修改BookKin的展示信息。写回会先生成安全预览，确认后直接覆盖当前原文件，不保留历史版本。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" }).querySelector("svg")).toBeNull();
  });

  it("closes and reports an ordinary metadata edit before persistence resolves", async () => {
    let resolveUpdate: ((value: Awaited<ReturnType<typeof api.updateBookMetadata>>) => void) | undefined;
    vi.spyOn(api, "updateBookMetadata").mockImplementationOnce(() => new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    const savedImmediately = vi.fn();
    const failed = vi.fn();
    const closed = vi.fn();
    render(
      <TestProviders>
        <MetadataDialog
          book={demoBooks[0]}
          onClose={closed}
          onCompleted={vi.fn()}
          onSavedImmediately={savedImmediately}
          onSaveFailed={failed}
        />
      </TestProviders>,
    );

    const titleInput = await screen.findByDisplayValue(demoBooks[0].title);
    fireEvent.change(titleInput, { target: { value: "即时标题" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(savedImmediately).toHaveBeenCalledWith("书籍展示信息已保存");
    expect(closed).toHaveBeenCalledTimes(1);
    expect(failed).not.toHaveBeenCalled();
    resolveUpdate?.({
      metadata: {
        id: demoBooks[0].id,
        title: "即时标题",
        authors: [demoBooks[0].author],
        translators: [],
        description: demoBooks[0].description,
        tags: demoBooks[0].tags,
        sources: {},
      },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());
  });

  it("separates database save from the confirmed file writeback", async () => {
    const completed = vi.fn();
    const closed = vi.fn();
    render(
      <TestProviders>
        <MetadataDialog book={demoBooks[0]} onClose={closed} onCompleted={completed} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );

    await screen.findByDisplayValue(demoBooks[0].title);
    fireEvent.click(screen.getByRole("checkbox", { name: `同时写回 ${demoBooks[0].format} 原文件` }));
    fireEvent.click(screen.getByRole("button", { name: "保存并生成预览" }));

    await screen.findByText("是否将刚刚保存的元信息同步到原文件？");
    expect(screen.getByRole("heading", { name: "确认写回原文件" })).toBeInTheDocument();
    expect(screen.queryByText("展示信息已保存。下面是原文件写回计划，确认前不会修改书籍文件。")).not.toBeInTheDocument();
    expect(screen.queryByText("源文件")).not.toBeInTheDocument();
    expect(screen.queryByText("预期指纹")).not.toBeInTheDocument();
    expect(screen.queryByText("写回会校验临时文件后直接覆盖当前原文件，不保留历史版本。")).not.toBeInTheDocument();
    expect(screen.queryByText("预览 5 分钟内有效；执行时会再次校验指纹和读取租约。")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认写回原文件" }));

    await waitFor(() => expect(completed).toHaveBeenCalledWith("元数据已写回文件"));
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
