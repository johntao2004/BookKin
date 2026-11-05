import { afterEach, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import type { MarkdownManager } from "@tiptap/markdown";
import { Schema } from "@tiptap/pm/model";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { handleMarkdownPaste, mapMarkdownSelectionBookmark, markdownLengthLimitExtension, markdownTableInputExtension } from "./MarkdownEditorImpl";

const editors: Editor[] = [];

function createEditor(markdown = "", contentType: "markdown" | "html" = "markdown", maxLength?: number) {
  const markdownManagerRef: { current: MarkdownManager | null } = { current: null };
  const inertSchemaRef: { current: Schema | null } = { current: null };
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, markdownLinks: true } }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      TaskList, TaskItem.configure({ nested: true }), markdownTableInputExtension(),
      Markdown.configure({ markedOptions: { gfm: true } }),
      markdownLengthLimitExtension(maxLength, markdownManagerRef, inertSchemaRef),
    ],
    content: markdown,
    contentType,
  });
  markdownManagerRef.current = editor.markdown ?? null;
  editors.push(editor);
  return editor;
}

function type(editor: Editor, text: string) {
  for (const character of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp("handleTextInput", handler => handler(editor.view, from, to, character, () => editor.state.tr.insertText(character, from, to)));
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(character, from, to));
  }
}

function dispatchTextInput(editor: Editor, position: number, text: string) {
  return editor.view.someProp("handleTextInput", handler => handler(editor.view, position, position, text, () => editor.state.tr.insertText(text, position)));
}

afterEach(() => {
  editors.splice(0).forEach(editor => editor.destroy());
});

it.each([
  ["# 标题 ", "heading"],
  ["**粗体** ", "bold"],
  ["[链接](https://example.test) ", "link"],
  ["```ts ", "fence"],
  ["- [ ] ", "task"],
] as const)("converts typed %s syntax in place", (input, kind) => {
  const editor = createEditor();
  type(editor, input);
  const doc = editor.state.doc;
  if (kind === "heading") expect(doc.firstChild?.type.name).toBe("heading");
  if (kind === "bold") expect(doc.firstChild?.firstChild?.marks.some(mark => mark.type.name === "bold")).toBe(true);
  if (kind === "link") expect(doc.firstChild?.firstChild?.marks.some(mark => mark.type.name === "link")).toBe(true);
  if (kind === "fence") expect(doc.firstChild?.type.name).toBe("codeBlock");
  if (kind === "task") expect(doc.firstChild?.type.name).toBe("taskList");
});

it("undo restores the literal Markdown typed before an input rule", () => {
  const editor = createEditor();
  type(editor, "**text** ");
  expect(editor.state.doc.firstChild?.firstChild?.marks.some(mark => mark.type.name === "bold")).toBe(true);
  editor.commands.undo();
  expect(editor.getMarkdown()).toContain("**text**");
});

it("turns the typed task marker into a task item and keeps subsequent text editable through undo", () => {
  const editor = createEditor();
  type(editor, "- [ ] Task title");
  expect(editor.state.doc.firstChild?.type.name).toBe("taskList");
  expect(editor.state.doc.textContent).toContain("Task title");
  editor.commands.undo();
  expect(editor.state.doc.content.content.some(node => node.type.name === "taskList")).toBe(false);
  expect(editor.state.doc.textContent).toContain("[ ]");
  editor.commands.redo();
  expect(editor.state.doc.content.content.some(node => node.type.name === "taskList")).toBe(true);
  editor.commands.redo();
  expect(editor.state.doc.textContent).toContain("Task title");
});

it("converts only the second bullet into a task item, keeps the caret there, leaves the first bullet plain, and preserves later paragraphs and nested lists", () => {
  const editor = createEditor("<ul><li><p>First</p></li><li><p>[ ]</p><p>keep me</p><ul><li><p>nested</p></li></ul></li></ul>", "html");
  let markerEnd = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "paragraph" && node.textContent === "[ ]") markerEnd = pos + node.nodeSize - 1;
  });
  expect(markerEnd).toBeGreaterThan(0);
  expect(dispatchTextInput(editor, markerEnd, " ")).toBe(true);
  expect(editor.state.doc.firstChild?.type.name).toBe("bulletList");
  expect(editor.state.doc.firstChild?.textContent).toBe("First");
  const taskList = editor.state.doc.child(1);
  expect(taskList.type.name).toBe("taskList");
  expect(taskList.childCount).toBe(1);
  expect(taskList.textContent).toContain("keep me");
  expect(taskList.textContent).toContain("nested");
  expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
  type(editor, "Second task");
  expect(editor.state.doc.textContent).toContain("Second task");
  expect(editor.state.doc.textContent).toContain("keep me");
  expect(editor.state.doc.textContent).toContain("nested");
});

it("keeps plain bullets before and after the converted item as plain bullets", () => {
  const editor = createEditor("<ul><li><p>甲</p></li><li><p>[ ]</p></li><li><p>丙</p></li></ul>", "html");
  let markerEnd = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "paragraph" && node.textContent === "[ ]") markerEnd = pos + node.nodeSize - 1;
  });
  expect(dispatchTextInput(editor, markerEnd, " ")).toBe(true);
  const kinds = editor.state.doc.content.content.filter(node => node.type.name !== "paragraph").map(node => `${node.type.name}:${node.textContent}`);
  expect(kinds).toEqual(["bulletList:甲", "taskList:", "bulletList:丙"]);
});

it("does not transform a task marker typed in the middle of a list paragraph", () => {
  const editor = createEditor("<ul><li><p>left[ ]right</p></li></ul>", "html");
  let markerStart = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "paragraph") markerStart = pos + 1 + "left".length;
  });
  expect(dispatchTextInput(editor, markerStart, " ")).toBeFalsy();
  editor.view.dispatch(editor.state.tr.insertText(" ", markerStart));
  expect(editor.state.doc.firstChild?.type.name).toBe("bulletList");
  expect(editor.state.doc.textContent).toContain("left [ ]right");
});

it("converts a pipe table on Enter, preserving inline header formatting and alignment, and places the cursor in the first body cell", () => {
  const editor = createEditor();
  type(editor, "| **Name** | Value |");
  editor.commands.keyboardShortcut("Enter");
  type(editor, "| :--- | ---: |");
  expect(editor.state.doc.content.content.some(node => node.type.name === "table")).toBe(false);
  expect(editor.commands.keyboardShortcut("Enter")).toBe(true);
  const table = editor.state.doc.firstChild;
  expect(table?.type.name).toBe("table");
  expect(table?.child(0).child(0).firstChild?.firstChild?.marks.some(mark => mark.type.name === "bold")).toBe(true);
  expect(table?.child(0).child(0).attrs.align).toBe("left");
  expect(table?.child(0).child(1).attrs.align).toBe("right");
  expect(editor.state.selection.$from.node(-1).type.name).toBe("tableCell");
});

it("leaves invalid pipe separators as text and allows undo of a table conversion", () => {
  const invalid = createEditor("<p>| A | B |</p><p>| --- | nope |</p>", "html");
  invalid.commands.setTextSelection(invalid.state.doc.content.size - 1);
  invalid.commands.keyboardShortcut("Enter");
  expect(invalid.state.doc.content.content.some(node => node.type.name === "table")).toBe(false);

  const valid = createEditor("<p>| A | B |</p><p>| --- | --- |</p>", "html");
  valid.commands.setTextSelection(valid.state.doc.content.size - 1);
  expect(valid.state.doc.content.content.some(node => node.type.name === "table")).toBe(false);
  valid.commands.keyboardShortcut("Enter");
  expect(valid.state.doc.firstChild?.type.name).toBe("table");
  valid.commands.undo();
  expect(valid.state.doc.content.content.some(node => node.type.name === "table")).toBe(false);
  expect(valid.state.doc.textContent).toContain("---");
  expect(valid.state.doc.textContent).toContain("A");
});

it("does not convert pipe syntax inside code blocks or while an IME composition is active", () => {
  const code = createEditor("```text\n| A | B |\n| --- | --- |\n```");
  code.commands.setTextSelection(code.state.doc.content.size - 2);
  code.commands.keyboardShortcut("Enter");
  expect(code.state.doc.content.content.some(node => node.type.name === "table")).toBe(false);

  const composing = createEditor("<p>| A | B |</p><p>| --- | --- |</p>", "html");
  composing.commands.setTextSelection(composing.state.doc.content.size - 1);
  Object.defineProperty(composing.view, "composing", { configurable: true, value: true });
  composing.commands.keyboardShortcut("Enter");
  expect(composing.state.doc.content.content.some(node => node.type.name === "table")).toBe(false);
});

function pasteEvent({ text = "", html = "", files = [] }: { text?: string; html?: string; files?: File[] }) {
  const preventDefault = vi.fn();
  const clipboardData = { files, getData: (type: string) => type === "text/html" ? html : text } as unknown as DataTransfer;
  return { event: { clipboardData, preventDefault } as unknown as ClipboardEvent, preventDefault };
}

it("parses plain Markdown clipboard text at the selection and leaves rich HTML to the safe HTML paste path", () => {
  const editor = createEditor("before after");
  editor.commands.setTextSelection(8);
  const plain = pasteEvent({ text: "**bold**\n\n- item" });
  expect(handleMarkdownPaste(editor, plain.event)).toBe(true);
  expect(plain.preventDefault).toHaveBeenCalledOnce();
  expect(editor.state.doc.textContent).toContain("before bolditemafter");
  expect(editor.state.doc.content.content.some(node => node.type.name === "bulletList")).toBe(true);

  const html = pasteEvent({ text: "plain", html: "<p><strong>rich</strong></p>" });
  expect(handleMarkdownPaste(editor, html.event)).toBe(false);
  expect(html.preventDefault).not.toHaveBeenCalled();
});

it("keeps image clipboard import and literal code block paste on their existing paths", async () => {
  const image = new File(["image"], "image.png", { type: "image/png" });
  const editor = createEditor();
  const importer = vi.fn(async () => undefined);
  const imagePaste = pasteEvent({ files: [image] });
  expect(handleMarkdownPaste(editor, imagePaste.event, importer)).toBe(true);
  expect(importer).toHaveBeenCalledWith([image]);
  expect(imagePaste.preventDefault).toHaveBeenCalledOnce();

  const code = createEditor("```text\n\n```");
  code.commands.setTextSelection(code.state.doc.content.size - 2);
  const codePaste = pasteEvent({ text: "**literal**" });
  expect(handleMarkdownPaste(code, codePaste.event)).toBe(false);
  expect(codePaste.preventDefault).not.toHaveBeenCalled();
});

it("maps a pending image insertion bookmark across text typed while the upload is in flight", () => {
  const editor = createEditor("before after");
  editor.commands.setTextSelection(7);
  const bookmark = editor.state.selection.getBookmark();
  const transaction = editor.state.tr.insertText(" meanwhile", 7);
  const mapped = mapMarkdownSelectionBookmark(bookmark, transaction.mapping);
  editor.view.dispatch(transaction);
  expect(mapped?.resolve(editor.state.doc).from).toBe(17);
});

it("blocks Markdown growth beyond maxLength while allowing edits that reduce an over-limit draft", () => {
  const editor = createEditor("abcdef", "markdown", 6);
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  editor.view.dispatch(editor.state.tr.insertText("g"));
  expect(editor.state.doc.textContent).toBe("abcdef");
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  editor.view.dispatch(editor.state.tr.delete(editor.state.selection.from - 1, editor.state.selection.from));
  expect(editor.state.doc.textContent).toBe("abcde");
  const overLimit = createEditor("longer than allowed", "markdown", 3);
  overLimit.commands.setTextSelection(overLimit.state.doc.content.size - 1);
  overLimit.view.dispatch(overLimit.state.tr.insertText("!"));
  expect(overLimit.state.doc.textContent).toBe("longer than allowed");
});
