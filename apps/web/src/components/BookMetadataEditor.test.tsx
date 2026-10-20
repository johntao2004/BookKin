import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { BookMetadataEditor } from "./BookMetadataEditor";

describe("BookMetadataEditor", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the shared page form without a metadata modal or divider", async () => {
    render(
      <TestProviders>
        <BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
      </TestProviders>,
    );

    await screen.findByDisplayValue(demoBooks[0].title);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("不勾选时只修改BookKin的展示信息。写回会先生成安全预览，确认后直接覆盖当前原文件，不保留历史版本。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" }).querySelector("svg")).toBeNull();
    expect(document.querySelectorAll(".bk-divider")).toHaveLength(0);
    expect(screen.getByRole("img", { name: "当前书籍封面" })).toBeInTheDocument();
  });

  it("closes and reports an ordinary metadata edit before persistence resolves", async () => {
    let resolveUpdate: ((value: Awaited<ReturnType<typeof api.updateBookMetadata>>) => void) | undefined;
    const updateMetadata = vi.spyOn(api, "updateBookMetadata").mockImplementationOnce(() => new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    const savedImmediately = vi.fn();
    const failed = vi.fn();
    const closed = vi.fn();
    render(
      <TestProviders>
        <BookMetadataEditor
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

    expect(updateMetadata).toHaveBeenCalledWith(demoBooks[0], expect.objectContaining({ manualFields: ["title"] }));
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
        <BookMetadataEditor book={demoBooks[0]} onClose={closed} onCompleted={completed} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} />
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

it('loads the actual public choice and saves an explicit visibility change with metadata', async () => {
  const original = await api.getBookMetadata(demoBooks[0].id);
  vi.spyOn(api, 'getBookMetadata').mockResolvedValue({...original, publiclyVisible: true});
  const save = vi.spyOn(api, 'updateBookMetadata').mockResolvedValue({metadata: {...original, publiclyVisible: false}});
  render(<TestProviders><BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} /></TestProviders>);
  await screen.findByDisplayValue(demoBooks[0].title);
  const toggle = screen.getByRole('switch', {name: '公开展示'});
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', {name: '保存'}));
  await waitFor(() => expect(save).toHaveBeenCalledWith(demoBooks[0], expect.objectContaining({publiclyVisible: false})));
});

it("requires confirmation before restoring the cover and leaves cancellation untouched", async () => {
  const reset = vi.spyOn(api, "resetBookCover").mockResolvedValue();
  render(<TestProviders><BookMetadataEditor book={demoBooks[0]} onClose={vi.fn()} onCompleted={vi.fn()} onSavedImmediately={vi.fn()} onSaveFailed={vi.fn()} /></TestProviders>);
  await screen.findByDisplayValue(demoBooks[0].title);
  fireEvent.click(screen.getByRole("button", { name: "恢复默认封面" }));
  expect(screen.getByRole("dialog", { name: "恢复默认封面？" })).toBeInTheDocument();
  expect(reset).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog", { name: "恢复默认封面？" })).getByRole("button", { name: "取消" }));
  expect(reset).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "恢复默认封面" }));
  fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));
  await waitFor(() => expect(reset).toHaveBeenCalledExactlyOnceWith(demoBooks[0].id));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "恢复默认封面？" })).not.toBeInTheDocument());
});
