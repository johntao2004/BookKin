import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ArticleBodyEditor } from "./ArticleBodyEditor";

const base = { markdown: "# 标题\n\n正文", html: "<h1>标题</h1><p>正文</p>", disabled: false };

it("edits rendered content without switching modes or resetting the editing DOM", () => {
  const onChange = vi.fn();
  const view = render(<ArticleBodyEditor {...base} onChange={onChange} onImportImages={vi.fn()} />);
  const editor = screen.getByRole("textbox", { name: "文章正文" });
  expect(editor).toHaveAttribute("contenteditable", "true");
  expect(screen.getByRole("heading", { name: "标题" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "预览" })).not.toBeInTheDocument();
  editor.innerHTML = "<h1>修改标题</h1><p><strong>修改正文</strong></p>";
  const heading = editor.firstChild;
  fireEvent.input(editor);
  const value = onChange.mock.calls[0][0];
  expect(value).toContain("# 修改标题");
  expect(value).toContain("**修改正文**");
  view.rerender(<ArticleBodyEditor {...base} markdown={value} onChange={onChange} onImportImages={vi.fn()} />);
  expect(editor.firstChild).toBe(heading);
});

it("pastes images into rendered content and retains edits made during upload", async () => {
  let resolve!: (value: string) => void;
  const onChange = vi.fn();
  const onImportImages = vi.fn(() => new Promise<string>(done => { resolve = done; }));
  render(<ArticleBodyEditor {...base} onChange={onChange} onImportImages={onImportImages} />);
  const editor = screen.getByRole("textbox", { name: "文章正文" });
  fireEvent.paste(editor, { clipboardData: { files: [new File(["image"], "image.png", { type: "image/png" })], getData: () => "" } });
  editor.innerHTML += "<p>上传期间的修改</p>";
  fireEvent.input(editor);
  resolve("![图片](/api/v1/articles/assets/00000000-0000-4000-8000-000000000001)");
  await waitFor(() => expect(editor.querySelector("img")).toHaveAttribute("src", "/api/v1/articles/assets/00000000-0000-4000-8000-000000000001"));
  expect(onChange.mock.lastCall?.[0]).toContain("上传期间的修改");
});

it("sanitizes pasted rich text and keeps headings and formatting editable", () => {
  const onChange = vi.fn();
  render(<ArticleBodyEditor {...base} onChange={onChange} onImportImages={vi.fn()} />);
  const editor = screen.getByRole("textbox", { name: "文章正文" });
  fireEvent.paste(editor, { clipboardData: { files: [], getData: (type: string) => type === "text/html" ? '<h2>粘贴</h2><p><strong>加粗</strong><script>alert(1)</script></p>' : "" } });
  expect(editor.querySelector("script")).toBeNull();
  expect(onChange.mock.lastCall?.[0]).toContain("## 粘贴");
  expect(onChange.mock.lastCall?.[0]).toContain("**加粗**");
});

it("disables editing and image insertion while saving", () => {
  const importImages = vi.fn();
  render(<ArticleBodyEditor {...base} disabled onChange={vi.fn()} onImportImages={importImages} />);
  const editor = screen.getByRole("textbox", { name: "文章正文" });
  expect(editor).toHaveAttribute("contenteditable", "false");
  fireEvent.drop(editor, { dataTransfer: { files: [new File(["image"], "image.png")] } });
  expect(importImages).not.toHaveBeenCalled();
});

it("replaces only the selected passage when pasting formatted content", () => {
  const onChange = vi.fn();
  render(<ArticleBodyEditor {...base} onChange={onChange} onImportImages={vi.fn()} />);
  const editor = screen.getByRole("textbox", { name: "文章正文" });
  const text = editor.querySelector("p")!.firstChild!;
  const range = document.createRange(); range.selectNodeContents(text);
  window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
  fireEvent.mouseUp(editor);
  fireEvent.paste(editor, { clipboardData: { files: [], getData: (type: string) => type === "text/html" ? "<strong>替换</strong>" : "" } });
  expect(onChange.mock.lastCall?.[0]).toContain("# 标题");
  expect(onChange.mock.lastCall?.[0]).toContain("**替换**");
  expect(onChange.mock.lastCall?.[0]).not.toContain("正文");
});
