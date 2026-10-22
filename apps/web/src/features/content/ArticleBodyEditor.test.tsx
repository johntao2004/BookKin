import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ArticleBodyEditor } from "./ArticleBodyEditor";

const base = { markdown: "前文待替换后文", html: "<p>正文</p>", preview: false, disabled: false, onPreviewChange: vi.fn() };

it("pastes images at the source selection instead of pasting clipboard HTML", async () => {
  const file = new File(["image"], "粘贴.png", { type: "image/png" });
  const onChange = vi.fn();
  const onImportImages = vi.fn().mockResolvedValue("![图片](/api/v1/articles/assets/image)");
  render(<ArticleBodyEditor {...base} onChange={onChange} onImportImages={onImportImages} />);
  const editor = screen.getByRole("textbox", { name: "文章正文" }) as HTMLTextAreaElement;
  editor.setSelectionRange(2, 5);
  fireEvent.paste(editor, { clipboardData: { files: [file], getData: () => "<p>剪贴板 HTML</p>" } });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("前文\n\n![图片](/api/v1/articles/assets/image)\n\n后文"));
  expect(onImportImages).toHaveBeenCalledWith([file]);
});

it("drops images into the editor and blocks file insertion while disabled", async () => {
  const file = new File(["image"], "拖入.webp", { type: "image/webp" });
  const onChange = vi.fn();
  const onImportImages = vi.fn().mockResolvedValue("![拖入图片](internal)");
  const view = render(<ArticleBodyEditor {...base} onChange={onChange} onImportImages={onImportImages} />);
  fireEvent.drop(screen.getByRole("textbox", { name: "文章正文" }), { dataTransfer: { files: [file] } });
  await waitFor(() => expect(onImportImages).toHaveBeenCalledOnce());
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("前文待替换后文\n\n![拖入图片](internal)"));
  view.rerender(<ArticleBodyEditor {...base} disabled onChange={onChange} onImportImages={onImportImages} />);
  fireEvent.drop(screen.getByRole("textbox", { name: "文章正文" }), { dataTransfer: { files: [file] } });
  expect(onImportImages).toHaveBeenCalledOnce();
});

it("keeps rich text paste as editable Markdown", () => {
  const onChange = vi.fn();
  render(<ArticleBodyEditor {...base} onChange={onChange} onImportImages={vi.fn()} />);
  const editor = screen.getByRole("textbox", { name: "文章正文" }) as HTMLTextAreaElement;
  editor.setSelectionRange(2, 5);
  fireEvent.paste(editor, { clipboardData: { files: [], getData: () => "<strong>加粗</strong>" } });
  expect(onChange).toHaveBeenCalledWith("前文**加粗**后文");
});
