import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MarkdownEditor } from "./MarkdownEditor";

it("opens GFM, code blocks, merged HTML tables, links, and images in one editable canvas without rewriting", async () => {
  const markdown = [
    "| A | B |\n| --- | --- |\n| 1 | 2 |",
    "```js\n  const x = 1;  \n\n```",
    '<table><tbody><tr><td rowspan="2"><p><a href="https://example.test">合并</a></p><p>文本data-src=保留</p><img src="https://private.test/image.png" alt="私有图"></td><td>右</td></tr><tr><td>下</td></tr></tbody></table>',
  ].join("\n\n");
  const onChange = vi.fn();
  render(<MarkdownEditor label="随笔正文" mode="note" value={markdown} onChange={onChange} maxLength={500_000} />);
  const editor = await screen.findByRole("textbox", { name: "随笔正文" }, { timeout: 5000 });
  expect(editor).toHaveAttribute("contenteditable", "true");
  expect(editor.querySelectorAll("table")).toHaveLength(2);
  expect(editor.querySelector("td[rowspan='2'] a")).toHaveAttribute("href", "https://example.test");
  expect(editor.querySelector("td[rowspan='2'] [data-bk-markdown-image]")).toHaveAttribute("data-bk-markdown-image", "https://private.test/image.png");
  expect(editor.querySelector("td[rowspan='2']")).toHaveTextContent("文本data-src=保留");
  expect(editor.querySelector("img[src*='private.test']")).toBeNull();
  expect(editor.querySelector("code.language-js")?.textContent).toBe("  const x = 1;  \n");
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "预览" })).not.toBeInTheDocument();
});

it("keeps managed article image links visible in article mode", async () => {
  const src = "/api/v1/articles/assets/00000000-0000-4000-8000-000000000001";
  render(<MarkdownEditor label="文章正文" mode="article" value={`![配图](${src})`} onChange={vi.fn()} />);
  const editor = await screen.findByRole("textbox", { name: "文章正文" }, { timeout: 5000 });
  expect(editor.querySelector("img")).toHaveAttribute("src", src);
});

it("keeps note editing free of formatting controls", async () => {
  render(<MarkdownEditor label="随笔正文" mode="note" value="# 新标题" onChange={vi.fn()} />);
  const editor = await screen.findByRole("textbox", { name: "随笔正文" }, { timeout: 5000 });
  expect(editor.querySelector("h1")).toHaveTextContent("新标题");
  expect(screen.queryByRole("toolbar", { name: "Markdown格式工具" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("链接地址")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("代码语言")).not.toBeInTheDocument();
});

it("loads external controlled drafts even when they exceed the user editing limit", async () => {
  const onChange = vi.fn();
  const view = render(<MarkdownEditor label="随笔正文" mode="note" value="# 初始长文" onChange={onChange} maxLength={3} />);
  expect(await screen.findByRole("heading", { name: "初始长文" })).toBeInTheDocument();
  view.rerender(<MarkdownEditor label="随笔正文" mode="note" value="# AI 新长文" onChange={onChange} maxLength={3} />);
  expect(await screen.findByRole("heading", { name: "AI 新长文" })).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

it("preserves rapid sequential editor updates when intermediate controlled values render in order", async () => {
  const emitted: string[] = [];
  const view = render(<MarkdownEditor label="随笔正文" mode="note" value="" onChange={(next) => emitted.push(next)} />);
  const editor = await screen.findByRole("textbox", { name: "随笔正文" }, { timeout: 5000 });
  fireEvent.paste(editor, { clipboardData: { files: [], getData: (type: string) => (type === "text/plain" ? "甲" : "") } });
  fireEvent.paste(editor, { clipboardData: { files: [], getData: (type: string) => (type === "text/plain" ? "乙" : "") } });
  expect(emitted).toHaveLength(2);
  view.rerender(<MarkdownEditor label="随笔正文" mode="note" value={emitted[0]!} onChange={(next) => emitted.push(next)} />);
  expect(editor).toHaveTextContent("甲乙");
  view.rerender(<MarkdownEditor label="随笔正文" mode="note" value={emitted[1]!} onChange={(next) => emitted.push(next)} />);
  expect(editor).toHaveTextContent("甲乙");
});
