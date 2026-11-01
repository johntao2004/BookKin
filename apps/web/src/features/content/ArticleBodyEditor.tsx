import { useRef, useState } from "react";
import { Button } from "../../ui/buttons";
import { TextField } from "../../ui/forms";
import { articleHtmlToMarkdown } from "./article-markdown";
import { safeHtml } from "./import";
import { highlightSanitizedCodeHtml } from "./code-highlighting";

export function ArticleBodyEditor({ markdown, onChange, html, preview, disabled, onPreviewChange, onImportImages }: {
  markdown: string;
  onChange: (value: string) => void;
  html: string;
  preview: boolean;
  disabled: boolean;
  onPreviewChange: (preview: boolean) => void;
  onImportImages: (files: File[]) => Promise<string | undefined>;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  const pending = useRef(false);
  const [dragging, setDragging] = useState(false);
  const rememberSelection = (input: HTMLTextAreaElement) => {
    selection.current = { start: input.selectionStart, end: input.selectionEnd };
  };
  const importImages = async (files: File[]) => {
    if (disabled || preview || pending.current || !files.length) return;
    pending.current = true;
    const start = Math.min(selection.current?.start ?? markdown.length, markdown.length);
    const end = Math.min(selection.current?.end ?? markdown.length, markdown.length);
    try {
      const inserted = await onImportImages(files);
      if (inserted) {
        const before = markdown.slice(0, start), after = markdown.slice(end);
        onChange(before + (before && !before.endsWith("\n\n") ? "\n\n" : "") + inserted
          + (after && !after.startsWith("\n\n") ? "\n\n" : "") + after);
        selection.current = null;
      }
    } finally { pending.current = false; }
  };
  return <section aria-label="正文编辑器" className="bk-article-body-editor bk-content-stack" data-dragging={dragging}
    onDragOver={event => {
      if (preview || disabled || !Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true);
    }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={event => {
      setDragging(false);
      if (!event.dataTransfer.files.length) return;
      event.preventDefault();
      void importImages(Array.from(event.dataTransfer.files));
    }}>
    <div className="bk-article-body-toolbar">
      <span className="bk-field-label">正文（Markdown）</span>
      <div className="bk-article-body-actions">
        <div role="group" aria-label="正文模式" className="bk-article-body-actions">
          <Button disabled={disabled} aria-pressed={!preview} variant={preview ? "text" : "outlined"} onClick={() => onPreviewChange(false)}>编辑</Button>
          <Button disabled={disabled} aria-pressed={preview} variant={preview ? "outlined" : "text"} onClick={() => onPreviewChange(true)}>预览</Button>
        </div>
        {!preview && <Button disabled={disabled} onClick={() => picker.current?.click()}>上传图片</Button>}
      </div>
    </div>
    <input ref={picker} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" aria-label="上传正文图片" disabled={disabled || preview}
      onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void importImages(files); }} />
    {preview ? <section aria-label="文章正文预览" className="bk-content-prose bk-markdown-prose bk-content-editor bk-article-markdown-preview" dangerouslySetInnerHTML={{ __html: highlightSanitizedCodeHtml(safeHtml(html)) }} />
      : <TextField fullWidth multiline minRows={14} maxRows={24} aria-label="文章正文"
    className="bk-article-markdown-editor" disabled={disabled} value={markdown}
    placeholder={"# 标题\n\n输入 Markdown 正文…"}
    onSelect={(event: React.SyntheticEvent<HTMLTextAreaElement>) => rememberSelection(event.currentTarget)}
    onFocus={(event: React.FocusEvent<HTMLTextAreaElement>) => rememberSelection(event.currentTarget)}
    onChange={event => { rememberSelection(event.target); onChange(event.target.value); }}
    onPaste={(event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (disabled) return;
      const images = Array.from(event.clipboardData.files ?? []).filter(file => file.type.startsWith("image/"));
      if (images.length) { event.preventDefault(); rememberSelection(event.currentTarget); void importImages(images); return; }
      const pasted = event.clipboardData.getData("text/html");
      if (!pasted) return;
      event.preventDefault();
      const input = event.target as HTMLTextAreaElement;
      onChange(markdown.slice(0, input.selectionStart) + articleHtmlToMarkdown(safeHtml(pasted)) + markdown.slice(input.selectionEnd));
    }}
  />}
    {!preview && <span className="bk-field-helper">支持 Markdown，可上传、粘贴或拖入图片。JPEG、PNG、WebP，每张不超过 5 MB。</span>}
  </section>;
}
