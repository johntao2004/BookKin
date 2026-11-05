import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DOMSerializer, Fragment } from "@tiptap/pm/model";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { Markdown, type MarkdownManager } from "@tiptap/markdown";
import { closeHistory } from "@tiptap/pm/history";
import { Schema } from "@tiptap/pm/model";
import Image from "@tiptap/extension-image";
import { renderTableToMarkdown, Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Button } from "../../ui/buttons";
import { safeHtml } from "./import";
import type { MarkdownEditorProps } from "./MarkdownEditor";
import "./markdown-editor.css";

const ARTICLE_IMAGE = /^\/api\/v1\/articles\/assets\/[0-9a-f-]{36}$/iu;
const MANAGED_IMAGE = "data-bk-markdown-image";

function markdownImageExtension(mode: MarkdownEditorProps["mode"]) {
  return Image.extend({
    parseHTML() {
      return [
        { tag: "img[src]", getAttrs: (element: HTMLElement) => ({ src: element.getAttribute("src"), alt: element.getAttribute("alt") ?? "", title: element.getAttribute("title") ?? "" }) },
        { tag: "img[data-src]", getAttrs: (element: HTMLElement) => ({ src: element.getAttribute("data-src"), alt: element.getAttribute("alt") ?? "", title: element.getAttribute("title") ?? "" }) },
      ];
    },
    renderHTML({ node }) {
      const src = String(node.attrs.src ?? "");
      const alt = String(node.attrs.alt ?? "");
      if (mode === "article" && ARTICLE_IMAGE.test(src)) return ["img", { src, alt, title: node.attrs.title ?? "" }];
      return ["span", { [MANAGED_IMAGE]: src, contenteditable: "false", "aria-label": alt || "图片", title: node.attrs.title ?? "" }, alt || "[图片]"];
    },
  });
}

function mergedTableExtension(inertSchemaRef: { current: Schema | null }) {
  return Table.extend({
    onBeforeCreate() {
      const schema = this.editor.schema;
      const imageSpec = schema.spec.nodes.get("image");
      if (!imageSpec) throw new Error("Markdown image node is not available.");
      inertSchemaRef.current = new Schema({
        nodes: schema.spec.nodes.update("image", {
          ...imageSpec,
          toDOM: node => ["img", { "data-src": String(node.attrs.src ?? ""), alt: String(node.attrs.alt ?? ""), title: String(node.attrs.title ?? "") }],
        }),
        marks: schema.spec.marks,
      });
    },
    renderMarkdown(node, helpers, context) {
      const merged = (node.content ?? []).some(row =>
        (row.content ?? []).some(cell => Number(cell.attrs?.rowspan ?? 1) > 1 || Number(cell.attrs?.colspan ?? 1) > 1));
      if (!merged) return renderTableToMarkdown(node, helpers);
      const schema = inertSchemaRef.current;
      if (!schema) throw new Error("Markdown table serializer is not ready.");
      const container = document.createElement("div");
      container.append(DOMSerializer.fromSchema(schema).serializeNode(schema.nodeFromJSON(node)));
      container.querySelectorAll("colgroup, col").forEach(column => column.remove());
      container.querySelectorAll("[style]").forEach(element => element.removeAttribute("style"));
      // The inert schema writes image URLs as data-src; restore HTML semantics
      // in the generated string without ever creating a live <img src> that can fetch.
      void context;
      return `${container.innerHTML.replace(/(<img\b[^>]*?)\sdata-src=("[^"]*"|'[^']*')/gu, "$1 src=$2")}\n\n`;
    },
  }).configure({ resizable: false });
}

export function markdownTableInputExtension() {
  return Extension.create({
    name: "silvaeMarkdownTableInput",
    addProseMirrorPlugins() {
      return [new Plugin({
        props: {
          handleTextInput: (view, from, to, text) => {
            if (view.composing || text !== " ") return false;
            const $from = view.state.doc.resolve(from);
            if (from !== to || !$from.parent.isTextblock || $from.parent.type.spec.code || $from.parentOffset !== $from.parent.content.size || $from.parent.textContent !== "[ ]" && $from.parent.textContent !== "[x]" && $from.parent.textContent !== "[X]") return false;
            const paragraphDepth = $from.depth;
            const itemDepth = paragraphDepth - 1;
            const listDepth = itemDepth - 1;
            const list = $from.node(listDepth);
            if (list.type.name !== "bulletList" || $from.index(itemDepth) !== 0) return false;
            const itemIndex = $from.index(listDepth);
            const currentItem = $from.node(itemDepth);
            const taskListType = view.state.schema.nodes.taskList;
            const taskItemType = view.state.schema.nodes.taskItem;
            // 只把当前项变成任务项；其余普通列表项保持原样，分别留在任务列表前后的两段列表里。
            // Convert only the current item; sibling plain items stay plain in lists before and after the task list.
            const siblings = list.content.content;
            const content = currentItem.content.content.map((child, childIndex) => childIndex === 0 ? $from.parent.copy(Fragment.empty) : child);
            const taskList = taskListType.create(null, taskItemType.create({ checked: $from.parent.textContent.toLowerCase() === "[x]" }, content));
            const before = siblings.slice(0, itemIndex);
            const after = siblings.slice(itemIndex + 1);
            const beforeList = before.length ? list.type.create(list.attrs, before) : null;
            const afterList = after.length ? list.type.create(list.attrs, after) : null;
            const listStart = $from.before(listDepth);
            view.dispatch(closeHistory(view.state.tr));
            const replacement = [beforeList, taskList, afterList].filter((node): node is NonNullable<typeof node> => node !== null);
            const transaction = view.state.tr.replaceWith(listStart, listStart + list.nodeSize, replacement);
            const taskListStart = listStart + (beforeList?.nodeSize ?? 0);
            transaction.setSelection(TextSelection.near(transaction.doc.resolve(taskListStart + 3)));
            view.dispatch(transaction);
            return true;
          },
        },
      })];
    },
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          const { state, view } = this.editor;
          const { $from } = state.selection;
          if (view.composing) return false;
          if (!$from.parent.isTextblock || $from.parent.type.name !== "paragraph" || $from.parentOffset !== $from.parent.content.size) return false;
          const rowText = $from.parent.textContent;
          const rowStart = $from.before();
          const previous = state.doc.resolve(rowStart).nodeBefore;
          if (!previous || previous.type.name !== "paragraph") return false;
          const headerDoc = state.schema.nodes.doc.create(null, previous);
          const headerText = this.editor.markdown?.serialize(headerDoc.toJSON()).trim() ?? previous.textContent;
          const parsed = this.editor.markdown?.parse(`${headerText}\n${rowText}\n`).content?.[0];
          if (!parsed || parsed.type !== "table" || !Array.isArray(parsed.content) || !parsed.content.length) return false;
          const parsedHeader = parsed.content[0];
          const bodyCells = parsedHeader.content?.map(cell => state.schema.nodes.tableCell.create(
            { align: cell.attrs?.align ?? null }, state.schema.nodes.paragraph.create(),
          ));
          if (!bodyCells?.length) return false;
          const bodyRow = state.schema.nodes.tableRow.create(null, bodyCells);
          const table = state.schema.nodeFromJSON({ ...parsed, content: [...parsed.content, bodyRow.toJSON()] });
          const from = rowStart - previous.nodeSize;
          const to = rowStart + $from.parent.nodeSize;
          view.dispatch(closeHistory(state.tr));
          let transaction = view.state.tr.replaceWith(from, to, table);
          const firstBodyCellPos = from + 1 + table.child(0).nodeSize + 3;
          transaction = transaction.setSelection(TextSelection.near(transaction.doc.resolve(firstBodyCellPos))).scrollIntoView();
          view.dispatch(transaction);
          return true;
        },
      };
    },
  });
}

export function handleMarkdownPaste(editor: Editor, event: ClipboardEvent, importImages?: (files: File[]) => Promise<void>) {
  const images = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith("image/"));
  if (images.length && importImages) {
    event.preventDefault();
    void importImages(images);
    return true;
  }
  if (!event.clipboardData || event.clipboardData.getData("text/html").trim() || editor.view.composing) return false;
  const text = event.clipboardData.getData("text/plain");
  if (!text) return false;
  const { $from } = editor.state.selection;
  if ($from.parent.type.spec.code || ($from.nodeBefore ?? $from.nodeAfter)?.marks.some(mark => mark.type.spec.code)) return false;
  event.preventDefault();
  editor.commands.insertContent(text, { contentType: "markdown" });
  return true;
}

export function mapMarkdownSelectionBookmark(
  bookmark: ReturnType<Editor["state"]["selection"]["getBookmark"]> | null,
  mapping: Parameters<ReturnType<Editor["state"]["selection"]["getBookmark"]>["map"]>[0],
) {
  return bookmark?.map(mapping) ?? null;
}

export function markdownLengthLimitExtension(
  maxLength: number | undefined,
  markdownManagerRef: { current: MarkdownManager | null },
  inertSchemaRef: { current: Schema | null },
) {
  return Extension.create({
    name: "silvaeMarkdownLengthLimit",
    addProseMirrorPlugins() {
      const schema = inertSchemaRef.current;
      return [new Plugin({
        props: schema ? { clipboardSerializer: DOMSerializer.fromSchema(schema) } : {},
        filterTransaction: (transaction, state) => {
          if (!transaction.docChanged || !markdownManagerRef.current || maxLength === undefined) return true;
          if (transaction.getMeta("preventUpdate")) return true;
          const nextLength = markdownManagerRef.current.serialize(transaction.doc.toJSON()).length;
          const currentLength = markdownManagerRef.current.serialize(state.doc.toJSON()).length;
          return nextLength <= maxLength || nextLength <= currentLength;
        },
      })];
    },
  });
}

export default function MarkdownEditorImpl({ value, onChange, label, mode, disabled = false, maxLength, placeholder, autoFocus = false, onImportFiles }: MarkdownEditorProps) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const importFilesRef = useRef<((files: File[], position?: number) => Promise<void>) | null>(null);
  const onChangeRef = useRef(onChange);
  const onImportFilesRef = useRef(onImportFiles);
  const lastSynced = useRef(value);
  const publishedValues = useRef<string[]>([]);
  const initialized = useRef(false);
  const pendingBookmark = useRef<ReturnType<Editor["state"]["selection"]["getBookmark"]> | null>(null);
  const pendingUpload = useRef(false);
  const [uploading, setUploading] = useState(false);
  const inertSchemaRef = useRef<Schema | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const markdownManagerRef = useRef<MarkdownManager | null>(null);

  onChangeRef.current = onChange;
  onImportFilesRef.current = onImportFiles;

  const extensions = useMemo(() => [
    StarterKit.configure({ link: { openOnClick: false, markdownLinks: true } }),
    mergedTableExtension(inertSchemaRef),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    markdownImageExtension(mode),
    markdownTableInputExtension(),
    Markdown.configure({ markedOptions: { gfm: true } }),
    markdownLengthLimitExtension(maxLength, markdownManagerRef, inertSchemaRef),
  ], [mode, maxLength]);

  const editor = useEditor({
    extensions,
    content: value,
    contentType: "markdown",
    autofocus: autoFocus,
    editable: !disabled,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        "aria-disabled": String(disabled),
        class: "bk-content-prose bk-markdown-prose bk-content-editor bk-article-markdown-preview bk-markdown-editor__surface",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
      transformPastedHTML: safeHtml,
      handlePaste: (_view, event) => {
        const current = editorRef.current;
        const importer = importFilesRef.current;
        return current ? handleMarkdownPaste(current, event, importer ? files => importer(files) : undefined) : false;
      },
      handleDrop: (view, event) => {
        const images = Array.from(event.dataTransfer?.files ?? []).filter(file => file.type.startsWith("image/"));
        if (!images.length) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void importFilesRef.current?.(images, position);
        return true;
      },
    },
    onCreate: ({ editor: created }) => {
      editorRef.current = created;
      markdownManagerRef.current = created.markdown ?? null;
      initialized.current = true;
    },
    onDestroy: () => {
      initialized.current = false;
      editorRef.current = null;
      inertSchemaRef.current = null;
      markdownManagerRef.current = null;
    },
    onTransaction: ({ transaction }) => {
      if (pendingBookmark.current && transaction.docChanged) pendingBookmark.current = mapMarkdownSelectionBookmark(pendingBookmark.current, transaction.mapping);
    },
    onUpdate: ({ editor: current }) => {
      if (!initialized.current) return;
      const markdown = current.getMarkdown();
      if (markdown === lastSynced.current) return;
      lastSynced.current = markdown;
      publishedValues.current.push(markdown);
      if (publishedValues.current.length > 64) publishedValues.current.shift();
      onChangeRef.current(markdown);
    },
  }, [extensions]);

  useEffect(() => {
    if (!editor) return;
    const publishedIndex = publishedValues.current.indexOf(value);
    if (publishedIndex !== -1) {
      publishedValues.current.splice(0, publishedIndex + 1);
      return;
    }
    if (value === lastSynced.current) {
      publishedValues.current = [];
      return;
    }
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    lastSynced.current = value;
    publishedValues.current = [];
  }, [editor, value]);

  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);

  const importImages = useCallback(async (files: File[], position?: number) => {
    const current = editorRef.current;
    if (!current || disabled || pendingUpload.current || !onImportFilesRef.current) return;
    const images = files.filter(file => file.type.startsWith("image/"));
    if (!images.length) return;
    if (position !== undefined) current.commands.setTextSelection(position);
    pendingBookmark.current = current.state.selection.getBookmark();
    pendingUpload.current = true;
    setUploading(true);
    try {
      const inserted = await onImportFilesRef.current(images);
      if (!current.isDestroyed) {
        const selection = pendingBookmark.current?.resolve(current.state.doc);
        if (inserted && selection) current.commands.insertContentAt({ from: selection.from, to: selection.to }, inserted, { contentType: "markdown" });
      }
    } finally {
      pendingBookmark.current = null;
      pendingUpload.current = false;
      setUploading(false);
    }
  }, [disabled]);
  importFilesRef.current = importImages;

  if (!editor) return <div className="bk-markdown-editor-loading" role="status" aria-label="正在加载编辑器" />;

  return <section className={`bk-markdown-editor bk-markdown-editor--${mode}`} aria-label={`${label}编辑区`}>
    {mode === "article" && onImportFiles && <Button size="small" disabled={disabled || uploading} aria-label="上传正文图片" onClick={() => uploadInput.current?.click()}>上传图片</Button>}
    {mode === "article" && onImportFiles && <input ref={uploadInput} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" aria-label="选择正文图片" disabled={disabled}
      onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void importImages(files); }} />}
    <EditorContent editor={editor} />
  </section>;
}
