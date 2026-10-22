// 覆盖重复选择、拖放、禁用态和多文件拒绝，保证文件与图片入口遵守相同插入流程。
// Covers reselection, drops, disabled state and multi-file rejection with consistent file/image insertion flows.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ArticleFileImport } from "./ArticleFileImport";
afterEach(cleanup);
it("opens the chooser and imports its selection, allowing the same file again", async () => {
  const onImport = vi.fn().mockResolvedValue(undefined);
  render(<ArticleFileImport disabled={false} onImport={onImport} onError={vi.fn()} />);
  expect(screen.getByRole("region", { name: "正文文件" })).toBeInTheDocument();
  const input = screen.getByLabelText("导入文章文件");
  const click = vi.spyOn(input, "click");
  fireEvent.click(screen.getByRole("button"));
  expect(click).toHaveBeenCalledOnce();
  const file = new File(["# 正文"], "文章.md");
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(onImport).toHaveBeenCalledWith(file));
  expect((input as HTMLInputElement).value).toBe("");
});
it("imports dropped files, rejects multiple files and ignores drops while disabled", async () => {
  const onImport = vi.fn().mockResolvedValue(undefined), onError = vi.fn();
  const view = render(<ArticleFileImport disabled={false} onImport={onImport} onError={onError} />);
  const file = new File(["正文"], "文章.html");
  fireEvent.drop(screen.getByRole("button"), { dataTransfer: { files: [file, file] } });
  expect(onError).toHaveBeenCalledWith(expect.stringContaining("一个文件"));
  expect(onImport).not.toHaveBeenCalled();
  fireEvent.drop(screen.getByRole("button"), { dataTransfer: { files: [file] } });
  await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
  view.rerender(<ArticleFileImport disabled onImport={onImport} onError={onError} />);
  fireEvent.drop(screen.getByRole("button"), { dataTransfer: { files: [file] } });
  expect(onImport).toHaveBeenCalledOnce();
});
