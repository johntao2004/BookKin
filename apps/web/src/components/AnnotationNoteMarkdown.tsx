import { useMemo } from "react";
import { Box } from "../ui/primitives";
import { reviewMarkdownToHtml } from "../features/reviews/markdown";

/** Safe, no-fetch presentation shared by private annotation notes. */
export function AnnotationNoteMarkdown({ markdown, className, sx }: { markdown: string; className?: string; sx?: any }) {
  const html = useMemo(() => reviewMarkdownToHtml(markdown), [markdown]);
  return <Box className={className ?? "bk-content-prose bk-markdown-prose bk-article-markdown-preview"} sx={sx} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function annotationNotePlainText(markdown: string) {
  return new DOMParser().parseFromString(reviewMarkdownToHtml(markdown), "text/html").body.textContent?.replace(/\s+/gu, " ").trim() ?? "";
}
