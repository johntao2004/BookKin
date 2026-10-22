import { afterEach, describe, expect, it, vi } from "vitest";
import { EpubCFI } from "epubjs";
import { highlightReaderCode, highlightSanitizedCodeHtml } from "./code-highlighting";
import { safeHtml } from "./import";

class TestHighlight {
  constructor(...ranges: Range[]) { this.ranges = ranges; }
  ranges: Range[];
}
function nativeHighlights() {
  const registry = new Map<string, TestHighlight>();
  vi.stubGlobal("CSS", { highlights: registry });
  vi.stubGlobal("Highlight", TestHighlight);
  return registry;
}
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

describe("shared code highlighting", () => {
  it("highlights declared aliases while preserving escaped source and inline code", () => {
    const html = highlightSanitizedCodeHtml(safeHtml('<p><code>inline</code></p><pre><code class="language-ts">const text = "&lt;script&gt;";\nconst answer = 42;\n</code></pre>'));
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("pre code")?.textContent).toBe('const text = "<script>";\nconst answer = 42;\n');
    expect(doc.querySelector(".hljs-keyword")?.textContent).toBe("const");
    expect(doc.querySelector(".hljs-string")?.textContent).toBe('"<script>"');
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.querySelector("p code")?.innerHTML).toBe("inline");
  });

  it("keeps code with unknown, plain or excessive input intact", () => {
    for (const language of ["unknown-language", "plaintext"]) {
      const html = `<pre><code class="language-${language}">const answer = 42;</code></pre>`;
      const doc = new DOMParser().parseFromString(highlightSanitizedCodeHtml(html), "text/html");
      expect(doc.querySelector("pre")?.getAttribute("data-bk-code-language")).toBe(language === "plaintext" ? "纯文本" : language);
      expect(doc.querySelector("code")?.outerHTML).toBe(`<code class="language-${language}">const answer = 42;</code>`);
    }
    const text = "a".repeat(50_001);
    const doc = new DOMParser().parseFromString(highlightSanitizedCodeHtml(`<pre><code>${text}</code></pre>`), "text/html");
    expect(doc.querySelector("code")?.textContent).toBe(text);
    expect(doc.querySelector(".hljs")).toBeNull();
  });

  it("retains captured BR line boundaries in sanitized previews", () => {
    const doc = new DOMParser().parseFromString(highlightSanitizedCodeHtml('<pre><span>toolbar</span><code class="language-go"><span>package main</span><br><span>func main() {}</span></code></pre>'), "text/html");
    expect(doc.querySelector("pre > code")?.textContent).toBe("package main\nfunc main() {}");
    expect(doc.querySelector("pre > span")?.textContent).toBe("toolbar");
  });

  it("paints reader ranges without changing original nodes, text or CFIs", () => {
    const registry = nativeHighlights();
    document.body.innerHTML = '<pre id="saved-code"><span>toolbar</span><code class="language-go"><span>package main</span><br><span>func main() {}</span></code></pre>';
    const before = document.querySelector("pre")!.innerHTML;
    const textNode = document.querySelector("code span")!.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 0); range.setEnd(textNode, 7);
    const cfi = new EpubCFI(range, "/6/2").toString();
    expect(highlightReaderCode(document)).toBe(true);
    expect(registry.get("bk-code-keyword")?.ranges.map(item => item.toString())).toContain("package");
    expect(document.querySelector("pre")!.innerHTML).toBe(before);
    expect(document.querySelector("pre")?.getAttribute("data-bk-code-language")).toBe("Go");
    expect(document.querySelector("code span")!.firstChild).toBe(textNode);
    expect(new EpubCFI(range, "/6/2").toString()).toBe(cfi);
    highlightReaderCode(document);
    expect(registry.size).toBeLessThanOrEqual(6);
    expect(registry.get("bk-code-keyword")?.ranges.filter(item => item.toString() === "package")).toHaveLength(1);
  });

  it("does not override the user's own annotation text colors or retain stale ranges", () => {
    const registry = nativeHighlights();
    document.body.innerHTML = '<pre><code class="language-js"><span class="page-annotation-inline">const</span> answer = 42;</code></pre>';
    highlightReaderCode(document, ".page-annotation-inline");
    expect(registry.get("bk-code-keyword")).toBeUndefined();
    expect(registry.get("bk-code-number")?.ranges[0].toString()).toBe("42");
    document.body.innerHTML = '<pre><code class="language-text">const answer = 42;</code></pre>';
    highlightReaderCode(document);
    expect(registry.size).toBe(0);
  });

  it("retains the language label and original code nodes if native range painting is unavailable", () => {
    vi.stubGlobal("Highlight", undefined);
    document.body.innerHTML = '<pre id="saved"><code>const answer = 42;</code></pre>';
    const html = document.querySelector("pre")!.innerHTML;
    expect(highlightReaderCode(document)).toBe(false);
    expect(document.querySelector("pre")!.innerHTML).toBe(html);
    expect(document.querySelector("pre")?.hasAttribute("data-bk-code-language")).toBe(true);
  });

  it("replaces captured toolbar decoration with a language-only header in previews", () => {
    const doc = new DOMParser().parseFromString(highlightSanitizedCodeHtml('<p><img src="body.png"></p><pre><span><img src="dots.png"></span><code class="language-ts">const count = 1;</code></pre>'), "text/html");
    expect(doc.querySelector("pre")?.getAttribute("data-bk-code-language")).toBe("TypeScript");
    expect(doc.querySelector("pre > span")?.getAttribute("data-bk-code-decoration")).toBe("true");
    expect(doc.querySelector("p img")?.closest("[data-bk-code-decoration]")).toBeNull();
    expect(doc.querySelector("pre code")?.textContent).toBe("const count = 1;");
  });

  it("detects captured Go code and keeps toolbar nodes and saved CFIs intact", () => {
    nativeHighlights();
    document.body.innerHTML = '<pre id="code"><span><img src="dots.png"></span><code><span>package diagnostics</span><br><span>func Start() {}</span></code></pre><pre id="plain">plain text</pre>';
    const header = document.querySelector("#code > span")!;
    const code = document.querySelector("code")!;
    const text = code.firstChild!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0); range.setEnd(text, 7);
    const cfi = new EpubCFI(range, "/6/2").toString();
    const original = code.innerHTML;
    highlightReaderCode(document);
    expect(document.querySelector("#code")?.getAttribute("data-bk-code-language")).toBe("Go");
    expect(document.querySelector("#code > span")).toBe(header);
    expect(header.getAttribute("data-bk-code-decoration")).toBe("true");
    expect(code.innerHTML).toBe(original);
    expect(new EpubCFI(range, "/6/2").toString()).toBe(cfi);
    expect(document.querySelector("#plain")?.getAttribute("data-bk-code-language")).toBe("纯文本");
  });

  it("keeps code-content images and textual headers visible", () => {
    const doc = new DOMParser().parseFromString(highlightSanitizedCodeHtml('<pre><span>说明<img src="meaningful.png"></span><code class="language-plaintext">text</code></pre><pre>text before image<img src="inline.png"></pre>'), "text/html");
    expect(doc.querySelector("[data-bk-code-decoration]")).toBeNull();
    expect(doc.querySelectorAll("img")).toHaveLength(2);
  });
});
