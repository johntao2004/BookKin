// 本地文章文件先解析为可校对草稿，导入界面不跳过后续保存步骤。
// Parses local article files into reviewable drafts without bypassing the later save step.
import { useId, useRef, useState } from "react";

export function ArticleFileImport({ disabled, onImport, onError }: {
  disabled: boolean;
  onImport: (file: File) => Promise<void>;
  onError: (message: string) => void;
}) {
  const labelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [dragging, setDragging] = useState(false);
  const acceptFiles = async (files: File[]) => {
    if (disabled || pending.current || !files.length) return;
    if (files.length !== 1) { onError("每次只能导入一篇文章，请选择一个文件。"); return; }
    pending.current = true;
    try { await onImport(files[0]); }
    finally { pending.current = false; }
  };
  return <section className="bk-article-import-field" aria-labelledby={labelId}>
    <span id={labelId} className="bk-field-label">正文文件</span>
    <button type="button" className="bk-article-file-drop" data-dragging={dragging} disabled={disabled}
      onClick={() => input.current?.click()}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? "none" : "copy"; if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); void acceptFiles(Array.from(event.dataTransfer.files)); }}>
      <strong>{disabled ? "正在处理…" : "导入文件"}</strong>
      <span>HTML、Markdown、ZIP · 单个文件不超过 25 MB</span>
      <span>点击选择或拖入</span>
    </button>
    <input ref={input} hidden type="file" aria-label="导入文章文件" accept=".html,.htm,.md,.markdown,.zip" disabled={disabled}
      onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void acceptFiles(files); }} />
  </section>;
}
