import { lazy, Suspense } from "react";

export type MarkdownEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  label: string;
  mode: "article" | "note";
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  onImportFiles?: (files: File[]) => Promise<string | undefined>;
};

const MarkdownEditorImpl = lazy(() => import("./MarkdownEditorImpl"));

export function MarkdownEditor(props: MarkdownEditorProps) {
  return <Suspense fallback={<div className="bk-markdown-editor-loading" role="status" aria-label="正在加载编辑器" />}>
    <MarkdownEditorImpl {...props} />
  </Suspense>;
}
