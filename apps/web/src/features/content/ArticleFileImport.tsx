// 本地文章文件先解析为可校对草稿，导入界面不跳过后续保存步骤。
// Parses local article files into reviewable drafts without bypassing the later save step.
import { useRef, useState } from "react";

export function ArticleFileImport({ disabled, onImport, onError, kind = "article" }: {
  kind?: "article" | "image";
  disabled: boolean;
  onImport: (file: File) => Promise<void>;
  onError: (message: string) => void;
}) {
  const image = kind === "image";
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [dragging, setDragging] = useState(false);
  const acceptFiles = async (files: File[]) => {
    if (disabled || pending.current || !files.length) return;
    if (files.length !== 1) { onError(image ? "每次只能插入一张图片，请选择一个文件。" : "每次只能导入一篇文章，请选择一个文件。"); return; }
    pending.current = true;
    try { await onImport(files[0]); }
    finally { pending.current = false; }
  };
  return <div>
    <button type="button" className="bk-article-file-drop" data-dragging={dragging} disabled={disabled}
      onClick={() => input.current?.click()}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? "none" : "copy"; if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); void acceptFiles(Array.from(event.dataTransfer.files)); }}>
      <strong>{disabled ? "正在处理…" : image ? "点击选择图片，或拖拽图片到这里" : "点击选择文件，或拖拽文件到这里"}</strong>
      <span>{image ? "JPEG、PNG、WebP · 单张图片不超过 5 MB" : "HTML、Markdown、ZIP · 单个文件不超过 25 MB"}</span>
    </button>
    <input ref={input} hidden type="file" aria-label={image ? "插入文章图片" : "导入文章文件"} accept={image ? "image/png,image/jpeg,image/webp" : ".html,.htm,.md,.markdown,.zip"} disabled={disabled}
      onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void acceptFiles(files); }} />
  </div>;
}
