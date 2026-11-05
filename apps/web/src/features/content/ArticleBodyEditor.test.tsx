import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ArticleBodyEditor } from "./ArticleBodyEditor";

const base = { markdown: "# 标题\n\n正文", disabled: false };

it("renders stored Markdown in the same editable canvas without initial rewrite or preview mode", async () => {
  const onChange = vi.fn();
  render(<ArticleBodyEditor {...base} onChange={onChange} onImportImages={vi.fn()} />);
  const editor = await screen.findByRole("textbox", { name: "文章正文" }, { timeout: 5000 });
  expect(editor).toHaveAttribute("contenteditable", "true");
  expect(screen.getByRole("heading", { name: "标题" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "预览" })).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

it("disables the editable canvas and article image import while saving", async () => {
  render(<ArticleBodyEditor {...base} disabled onChange={vi.fn()} onImportImages={vi.fn()} />);
  expect(await screen.findByRole("textbox", { name: "文章正文" })).toHaveAttribute("contenteditable", "false");
  expect(screen.getByRole("button", { name: "上传正文图片" })).toBeDisabled();
});
