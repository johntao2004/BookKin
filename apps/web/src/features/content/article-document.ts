import JSZip from "jszip";
import type { Article } from "./api";
import { safeHtml } from "./import";

const XHTML_NS = "http://www.w3.org/1999/xhtml";
const EPUB_NS = "http://www.idpf.org/2007/ops";
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const BLOCKED_ELEMENTS = new Set([
  "base",
  "embed",
  "form",
  "iframe",
  "object",
  "script",
  "style",
]);
const PARAGRAPH_LOCATOR = /^(?:article\.xhtml#)?(p-\d+)$/u;
const ARTICLE_CSS = `
html, body, main {
  max-width: 100%;
  overflow-wrap: anywhere;
}

img {
  max-width: 100%;
  height: auto;
}

pre {
  max-width: 100%;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

table {
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
}

th, td {
  overflow-wrap: anywhere;
}

[data-bk-duplicate-title] {
  display: none;
}
`;

function escapeXml(value: string) {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d
        || (codePoint >= 0x20 && codePoint <= 0xd7ff)
        || (codePoint >= 0xe000 && codePoint <= 0xfffd)
        || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    })
    .join("")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function articleImageSource(source: string | null) {
  if (!source) return undefined;
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/iu.test(source)) {
    return source;
  }
  if (!/^\/api\/v1\/articles\/assets\/[0-9a-f-]{36}$/iu.test(source)) {
    return undefined;
  }
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  return new URL(source, origin).href;
}

function serializeXhtmlNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeXml(node.nodeValue ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as Element;
  const tagName = element.localName.toLowerCase();
  if (BLOCKED_ELEMENTS.has(tagName)) return "";

  const attributes: string[] = [];
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (name.startsWith("on") || name === "data-src" || name === "srcset" || name === "style") continue;
    if (name === "src") {
      if (tagName !== "img") continue;
      const source = articleImageSource(attribute.value);
      if (source) attributes.push(`src="${escapeXml(source)}"`);
      continue;
    }
    if (name === "href" && /^\s*(?:javascript|vbscript|data):/iu.test(attribute.value)) continue;
    attributes.push(`${name}="${escapeXml(attribute.value)}"`);
  }

  const openingTag = `<${tagName}${attributes.length ? ` ${attributes.join(" ")}` : ""}`;
  if (VOID_ELEMENTS.has(tagName)) return `${openingTag} />`;
  const content = Array.from(element.childNodes).map(serializeXhtmlNode).join("");
  return `${openingTag}>${content}</${tagName}>`;
}

function uniqueId(document: Document, preferred: string) {
  let candidate = preferred;
  let suffix = 2;
  while (document.getElementById(candidate)) {
    candidate = `${preferred}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function prepareArticleBody(article: Pick<Article, "title" | "html">) {
  const parsed = new DOMParser().parseFromString(safeHtml(article.html), "text/html");
  const body = parsed.body;
  Array.from(body.querySelectorAll("p")).forEach((paragraph, index) => {
    if (!paragraph.id) paragraph.id = uniqueId(parsed, `p-${index + 1}`);
  });

  const titleId = uniqueId(parsed, "bookkin-article-title");
  const headings = Array.from(body.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = uniqueId(parsed, `article-heading-${index + 1}`);
  });

  const normalizeTitle = (value: string) => value.normalize("NFKC").replace(/[\s\u200B-\u200D\uFEFF]+/gu, "");
  const firstHeading = headings[0];
  let existingTitle: Element | undefined;
  if (firstHeading && normalizeTitle(article.title)
    && normalizeTitle(firstHeading.textContent ?? "") === normalizeTitle(article.title)) {
    const prefix = parsed.createRange();
    prefix.selectNodeContents(body);
    prefix.setEndBefore(firstHeading);
    if (!normalizeTitle(prefix.cloneContents().textContent ?? "")) existingTitle = firstHeading;
  }

  const title = parsed.createElement("h1");
  title.id = titleId;
  title.textContent = article.title;
  if (existingTitle) {
    // Keep the old generated node as a hidden locator placeholder, so existing body CFIs do not shift.
    title.setAttribute("data-bk-duplicate-title", "true");
    title.setAttribute("hidden", "hidden");
    title.setAttribute("aria-hidden", "true");
  }
  const contents = [serializeXhtmlNode(title), ...Array.from(body.childNodes).map(serializeXhtmlNode)].join("");
  const toc = [
    { id: existingTitle?.id ?? titleId, label: article.title },
    ...headings.filter(heading => heading !== existingTitle).map((heading) => ({ id: heading.id, label: heading.textContent?.trim() ?? "" })),
  ];

  return { contents, toc };
}

function articleXhtml(title: string, contents: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="${XHTML_NS}" xmlns:epub="${EPUB_NS}" lang="zh-CN" xml:lang="zh-CN">
  <head><title>${escapeXml(title)}</title><meta charset="utf-8" /><link rel="stylesheet" type="text/css" href="article.css" /></head>
  <body epub:type="bodymatter"><main>${contents}</main></body>
</html>`;
}

function navigationXhtml(title: string, toc: Array<{ id: string; label: string }>) {
  const entries = toc.map(({ id, label }) => {
    const href = `article.xhtml#${encodeURIComponent(id)}`;
    return `<li><a href="${escapeXml(href)}">${escapeXml(label)}</a></li>`;
  }).join("");
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="${XHTML_NS}" xmlns:epub="${EPUB_NS}" lang="zh-CN" xml:lang="zh-CN">
  <head><title>${escapeXml(title)}</title><meta charset="utf-8" /></head>
  <body><nav epub:type="toc" id="toc"><h1>目录</h1><ol>${entries}</ol></nav></body>
</html>`;
}

function packageOpf(article: Pick<Article, "id" | "title" | "author">) {
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="bookkin-article-id" xml:lang="zh-CN">
  <metadata>
    <dc:identifier id="bookkin-article-id">urn:bookkin:article:${escapeXml(article.id)}</dc:identifier>
    <dc:title>${escapeXml(article.title)}</dc:title>
    <dc:creator>${escapeXml(article.author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="article" href="article.xhtml" media-type="application/xhtml+xml" />
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="styles" href="article.css" media-type="text/css" />
  </manifest>
  <spine><itemref idref="article" /></spine>
</package>`;
}

export async function buildArticleEpub(article: Pick<Article, "id" | "title" | "author" | "html">): Promise<Blob> {
  const { contents, toc } = prepareArticleBody(article);
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="utf-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml" /></rootfiles>
</container>`);
  zip.file("EPUB/package.opf", packageOpf(article));
  zip.file("EPUB/article.xhtml", articleXhtml(article.title, contents));
  zip.file("EPUB/article.css", ARTICLE_CSS);
  zip.file("EPUB/nav.xhtml", navigationXhtml(article.title, toc));
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function articleReaderTarget(locator?: string): string | undefined {
  if (!locator) return undefined;
  if (locator.includes("epubcfi(")) return locator;
  const paragraph = PARAGRAPH_LOCATOR.exec(locator);
  if (paragraph?.[1]) return `article.xhtml#${paragraph[1]}`;
  return undefined;
}
