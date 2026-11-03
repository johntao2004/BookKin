import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { DOMSerializer } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { Markdown, type MarkdownManager } from "@tiptap/markdown";
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

export default function MarkdownEditorImpl({ value, onChange, label, mode, disabled = false, maxLength, placeholder, onImportFiles }: MarkdownEditorProps) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const importFilesRef = useRef<((files: File[], position?: number) => Promise<void>) | null>(null);
  const onChangeRef = useRef(onChange);
  const onImportFilesRef = useRef(onImportFiles);
  const lastSynced = useRef(value);
  const lastPublished = useRef<string | null>(null);
  const initialized = useRef(false);
  const pendingBookmark = useRef<ReturnType<Editor["state"]["selection"]["getBookmark"]> | null>(null);
  const pendingUpload = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("");
  const inertSchemaRef = useRef<Schema | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const markdownManagerRef = useRef<MarkdownManager | null>(null);

  onChangeRef.current = onChange;
  onImportFilesRef.current = onImportFiles;

  const extensions = useMemo(() => [
    StarterKit.configure({ link: { openOnClick: false } }),
    mergedTableExtension(inertSchemaRef),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    markdownImageExtension(mode),
    Markdown.configure({ markedOptions: { gfm: true } }),
    Extension.create({
      name: "bookkinMarkdownLengthLimit",
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
        } })];
      },
    }),
  ], [mode, maxLength]);

  const editor = useEditor({
    extensions,
    content: value,
    contentType: "markdown",
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
        const images = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith("image/"));
        if (!images.length) return false;
        event.preventDefault();
        void importFilesRef.current?.(images);
        return true;
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
      if (pendingBookmark.current && transaction.docChanged) pendingBookmark.current = pendingBookmark.current.map(transaction.mapping);
    },
    onUpdate: ({ editor: current }) => {
      if (!initialized.current) return;
      const markdown = current.getMarkdown();
      if (markdown === lastSynced.current) return;
      lastSynced.current = markdown;
      lastPublished.current = markdown;
      onChangeRef.current(markdown);
    },
  }, [extensions]);

  useEffect(() => {
    if (!editor) return;
    if (lastPublished.current === value) {
      lastPublished.current = null;
      lastSynced.current = value;
      return;
    }
    if (value !== lastSynced.current) {
      editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
      lastSynced.current = value;
      lastPublished.current = null;
    }
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

  const run = (action: (instance: Editor) => void) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!disabled && editor) action(editor);
  };

  const applyLink = run(instance => {
    const href = linkHref.trim();
    if (!href) instance.chain().focus().extendMarkRange("link").unsetLink().run();
    else if (/^(?:https?:\/\/|mailto:|\/|#)/iu.test(href)) instance.chain().focus().extendMarkRange("link").setLink({ href }).run();
  });

  if (!editor) return <div className="bk-markdown-editor-loading" role="status" aria-label="正在加载编辑器" />;

  return <section className={`bk-markdown-editor bk-markdown-editor--${mode}`} aria-label={`${label}编辑区`}>
    <div className="bk-markdown-editor__toolbar" role="toolbar" aria-label="Markdown格式工具">
      <Button size="small" disabled={disabled} aria-label="一级标题" title="一级标题" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().toggleHeading({ level: 1 }).run())}>H1</Button>
      <Button size="small" disabled={disabled} aria-label="二级标题" title="二级标题" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().toggleHeading({ level: 2 }).run())}>H2</Button>
      <Button size="small" disabled={disabled} aria-label="加粗" title="加粗" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().toggleBold().run())}><strong>B</strong></Button>
      <Button size="small" disabled={disabled} aria-label="斜体" title="斜体" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().toggleItalic().run())}><em>I</em></Button>
      <Button size="small" disabled={disabled} aria-label="无序列表" title="无序列表" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().toggleBulletList().run())}>• 列表</Button>
      <Button size="small" disabled={disabled} aria-label="有序列表" title="有序列表" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().toggleOrderedList().run())}>1. 列表</Button>
      <Button size="small" disabled={disabled} aria-label="任务列表" title="任务列表" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().toggleTaskList().run())}>☑ 任务</Button>
      <Button size="small" disabled={disabled} aria-label="引用" title="引用" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().toggleBlockquote().run())}>引用</Button>
      <Button size="small" disabled={disabled} aria-label="代码块" title="代码块" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().toggleCodeBlock().run())}>{"</>"}</Button>
      <input className="bk-markdown-editor__control-input" aria-label="代码语言" value={codeLanguage} disabled={disabled} placeholder="语言" onChange={event => setCodeLanguage(event.target.value)} />
      <Button size="small" disabled={disabled} aria-label="设置代码语言" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().updateAttributes("codeBlock", { language: codeLanguage.trim() || null }).run())}>代码语言</Button>
      <input className="bk-markdown-editor__link-input" aria-label="链接地址" value={linkHref} disabled={disabled} placeholder="https:// 或 /路径" onChange={event => setLinkHref(event.target.value)} />
      <Button size="small" disabled={disabled} aria-label="插入或编辑链接" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={applyLink}>链接</Button>
      <Button size="small" disabled={disabled} aria-label="插入表格" title="插入 2 × 2 表格" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run())}>表格</Button>
      <Button size="small" disabled={disabled} aria-label="上方插入行" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().addRowBefore().run())}>+ 行↑</Button>
      <Button size="small" disabled={disabled} aria-label="下方插入行" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().addRowAfter().run())}>+ 行↓</Button>
      <Button size="small" disabled={disabled} aria-label="删除表格行" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().deleteRow().run())}>删行</Button>
      <Button size="small" disabled={disabled} aria-label="左侧插入列" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().addColumnBefore().run())}>+ 列←</Button>
      <Button size="small" disabled={disabled} aria-label="右侧插入列" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().addColumnAfter().run())}>+ 列→</Button>
      <Button size="small" disabled={disabled} aria-label="删除表格列" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().deleteColumn().run())}>删列</Button>
      <Button size="small" disabled={disabled} aria-label="合并单元格" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().mergeCells().run())}>合并单元格</Button>
      <Button size="small" disabled={disabled} aria-label="拆分单元格" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().splitCell().run())}>拆分单元格</Button>
      <Button size="small" disabled={disabled} aria-label="撤销" title="撤销" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().undo().run())}>撤销</Button>
      <Button size="small" disabled={disabled} aria-label="重做" title="重做" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={run(instance => instance.chain().focus().redo().run())}>重做</Button>
      {mode === "article" && onImportFiles && <Button size="small" disabled={disabled || uploading} aria-label="上传正文图片" onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={() => uploadInput.current?.click()}>上传图片</Button>}
    </div>
    {mode === "article" && onImportFiles && <input ref={uploadInput} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" aria-label="选择正文图片" disabled={disabled}
      onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void importImages(files); }} />}
    <EditorContent editor={editor} />
    {mode === "note" && <span className="bk-field-helper">支持粘贴 Markdown；常见标题、列表和代码块也可直接输入格式标记。</span>}
  </section>;
}
