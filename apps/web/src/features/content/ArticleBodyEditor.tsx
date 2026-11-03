import { MarkdownEditor } from "./MarkdownEditor";

export function ArticleBodyEditor({ markdown, onChange, disabled, onImportImages }: {
  markdown: string;
  onChange: (value: string) => void;
  disabled: boolean;
  onImportImages: (files: File[]) => Promise<string | undefined>;
}) {
  return <section aria-label="正文编辑器" className="bk-article-body-editor bk-content-stack">
    <span className="bk-field-label">正文</span>
    <MarkdownEditor value={markdown} onChange={onChange} label="文章正文" mode="article" disabled={disabled} onImportFiles={onImportImages} />
    <span className="bk-field-helper">可直接编辑正文，支持上传、粘贴或拖入图片。JPEG、PNG、WebP，每张不超过 5 MB。</span>
  </section>;
}
