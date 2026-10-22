import { useId, useRef } from "react";
import { Button } from "../../ui/buttons";

export function ArticleCoverField({ value, disabled, readOnly, onImport, onRemove }: {
  value?: string;
  disabled: boolean;
  readOnly: boolean;
  onImport: (file: File) => Promise<void>;
  onRemove: () => void;
}) {
  const labelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const safeSource = value && (/^\/api\/v1\/articles\/assets\/[0-9a-f-]{36}$/iu.test(value)
    || /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/iu.test(value)) ? value : undefined;
  const preview = safeSource ? <img className="bk-article-cover-preview" src={safeSource} alt="文章封面预览" />
    : <span className="bk-field-helper">{readOnly ? "暂无封面" : "点击上传封面"}</span>;
  return <section className="bk-article-cover-field" aria-labelledby={labelId}>
    <span id={labelId} className="bk-field-label">封面</span>
    {readOnly ? <div className="bk-article-cover-frame">{preview}</div>
      : <button type="button" className="bk-article-cover-frame bk-article-cover-upload" disabled={disabled}
        aria-label={safeSource ? "替换封面" : "上传封面"} onClick={() => input.current?.click()}>{preview}</button>}
    {!readOnly && <>
      {safeSource && <div className="bk-article-cover-actions"><Button disabled={disabled} aria-label="移除封面" onClick={onRemove}>移除</Button></div>}
      <input ref={input} hidden type="file" aria-label="上传文章封面" accept="image/jpeg,image/png,image/webp" disabled={disabled}
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && !disabled) void onImport(file);
        }} />
    </>}
  </section>;
}
