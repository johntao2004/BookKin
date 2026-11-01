import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../ui/buttons";
import { articleHtmlToMarkdown, articleMarkdownToHtml } from "./article-markdown";
import { safeHtml } from "./import";

export function ArticleBodyEditor({ markdown, onChange, html, disabled, onImportImages }: {
  markdown: string;
  onChange: (value: string) => void;
  html: string;
  disabled: boolean;
  onImportImages: (files: File[]) => Promise<string | undefined>;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const emitted = useRef<string | null>(null);
  const pending = useRef(false);
  const [dragging, setDragging] = useState(false);
  useLayoutEffect(() => {
    if (editor.current && emitted.current !== markdown) {
      editor.current.innerHTML = safeHtml(emitted.current === null ? html : articleMarkdownToHtml(markdown));
      emitted.current = markdown;
      selection.current = null;
    }
  }, [markdown, html]);
  const rememberSelection = () => {
    const selected = window.getSelection();
    if (selected?.rangeCount && editor.current?.contains(selected.anchorNode) && editor.current.contains(selected.focusNode)) {
      selection.current = selected.getRangeAt(0).cloneRange();
    }
  };
  const publish = () => {
    if (!editor.current || disabled) return;
    const value = articleHtmlToMarkdown(editor.current.innerHTML);
    emitted.current = value;
    onChange(value);
    rememberSelection();
  };
  const insertHtml = (value: string) => {
    const host = editor.current;
    if (!host) return;
    host.focus();
    const range = selection.current && host.contains(selection.current.commonAncestorContainer)
      ? selection.current : document.createRange();
    if (!selection.current || !host.contains(range.commonAncestorContainer)) {
      range.selectNodeContents(host); range.collapse(false);
    }
    const selected = window.getSelection();
    selected?.removeAllRanges(); selected?.addRange(range);
    const cleaned = safeHtml(value);
    // Native insertion keeps the browser's editing undo history intact.
    if (!document.execCommand?.("insertHTML", false, cleaned)) {
      range.deleteContents();
      const fragment = range.createContextualFragment(cleaned);
      const last = fragment.lastChild;
      range.insertNode(fragment);
      if (last) { range.setStartAfter(last); range.collapse(true); }
      selected?.removeAllRanges(); selected?.addRange(range);
    }
    publish();
  };
  const importImages = async (files: File[]) => {
    if (disabled || pending.current || !files.length) return;
    pending.current = true;
    try {
      const inserted = await onImportImages(files);
      if (inserted) insertHtml(articleMarkdownToHtml(inserted));
    } finally { pending.current = false; }
  };
  return <section aria-label="正文编辑器" className="bk-article-body-editor bk-content-stack" data-dragging={dragging}
    onDragOver={event => {
      if (disabled || !Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true);
    }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={event => {
      setDragging(false);
      if (!event.dataTransfer.files.length) return;
      event.preventDefault();
      if (disabled) return;
      void importImages(Array.from(event.dataTransfer.files));
    }}>
    <div className="bk-article-body-toolbar">
      <span className="bk-field-label">正文</span>
      <Button disabled={disabled} onMouseDown={(event: React.MouseEvent) => event.preventDefault()} onClick={() => picker.current?.click()}>上传图片</Button>
    </div>
    <input ref={picker} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" aria-label="上传正文图片" disabled={disabled}
      onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void importImages(files); }} />
    <div ref={editor} role="textbox" aria-label="文章正文" aria-multiline="true" aria-disabled={disabled}
      contentEditable={!disabled} suppressContentEditableWarning
      className="bk-content-prose bk-markdown-prose bk-content-editor bk-article-markdown-preview"
      onInput={publish} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onBlur={rememberSelection}
      onPaste={event => {
        if (disabled) return;
        event.preventDefault(); rememberSelection();
        const images = Array.from(event.clipboardData.files ?? []).filter(file => file.type.startsWith("image/"));
        if (images.length) { void importImages(images); return; }
        const pasted = event.clipboardData.getData("text/html");
        if (pasted) insertHtml(pasted);
        else {
          const container = document.createElement("div");
          container.textContent = event.clipboardData.getData("text/plain");
          insertHtml(container.innerHTML.replace(/\n/g, "<br>"));
        }
      }} />
    <span className="bk-field-helper">可直接编辑正文，支持上传、粘贴或拖入图片。JPEG、PNG、WebP，每张不超过 5 MB。</span>
  </section>;
}
