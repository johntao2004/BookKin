import { marked } from "marked";
import TurndownService from "turndown";
import { safeHtml } from "./import";

const htmlToMarkdown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  fence: "```",
  linkStyle: "inlined",
});

// Markdown has no portable table model beyond GFM's limited syntax. Keep the
// sanitized table markup so merged cells and other table structure survive.
htmlToMarkdown.keep("table");

htmlToMarkdown.addRule("article-image", {
  filter: "img",
  replacement: (_content, image) => {
    const source = image.getAttribute("src") || image.getAttribute("data-src") || "";
    if (!source) return "";

    const alt = htmlToMarkdown.escape(image.getAttribute("alt") || "");
    const safeSource = source.replace(/([<>()])/g, "\\$1");
    const destination = safeSource.includes(" ") ? `<${safeSource}>` : safeSource;
    const title = image.getAttribute("title")?.replace(/"/g, '\\"');
    const titlePart = title ? ` "${title}"` : "";

    return `![${alt}](${destination}${titlePart})`;
  },
});

// Unknown/custom wrappers should still contribute their converted children.
htmlToMarkdown.addRule("custom-element-content", {
  filter: (node) => node.localName.includes("-"),
  replacement: (content) => content,
});

/** Convert sanitized article HTML into editable Markdown, retaining article images. */
export function articleHtmlToMarkdown(html: string): string {
  return htmlToMarkdown.turndown(safeHtml(html));
}

/** Render GFM Markdown and sanitize the resulting HTML using the article policy. */
export function articleMarkdownToHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true });
  return safeHtml(html);
}
