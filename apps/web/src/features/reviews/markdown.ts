import DOMPurify from "dompurify";
import { marked } from "marked";
import { highlightSanitizedCodeHtml } from "../content/code-highlighting";

/** Render prose without scripts, embedded documents or cross-content asset requests. */
export function reviewMarkdownToHtml(markdown: string): string {
  const html = DOMPurify.sanitize(marked.parse(markdown, { async: false, gfm: true }), {
    FORBID_TAGS: ["style", "iframe", "form", "input", "button", "textarea", "select", "video", "audio", "svg", "object", "embed", "link", "meta", "base"],
    FORBID_ATTR: ["style", "srcset"],
    ALLOW_DATA_ATTR: false,
  });
  const document = new DOMParser().parseFromString(html, "text/html");
  // Long-form reviews do not reuse private article/vault assets or load remote images.
  // Keep image destinations as explicit links rather than issuing background requests.
  for (const image of document.querySelectorAll("img")) {
    const source = image.getAttribute("src") ?? "";
    const label = image.getAttribute("alt") || "图片";
    if (source.startsWith("https://")) {
      const link = document.createElement("a");
      link.href = source;
      link.textContent = label;
      image.replaceWith(link);
    } else image.replaceWith(document.createTextNode(label));
  }
  for (const link of document.querySelectorAll("a")) {
    const href = link.getAttribute("href") ?? "";
    if (!/^https?:\/\//i.test(href) && !href.startsWith("#")) link.removeAttribute("href");
    link.setAttribute("rel", "noreferrer noopener");
  }
  return highlightSanitizedCodeHtml(document.body.innerHTML);
}
