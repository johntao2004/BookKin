import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const highlighter = hljs.newInstance();
const languages = { bash, cpp, css, go, java, javascript, json, python, sql, typescript, xml, yaml };
for (const [name, grammar] of Object.entries(languages)) highlighter.registerLanguage(name, grammar);
highlighter.registerAliases(["shell", "zsh"], { languageName: "bash" });
const MAX_CODE_LENGTH = 50_000;
const MAX_RANGES = 12_000;
const groups = ["keyword", "string", "number", "title", "comment", "meta"] as const;
type Group = typeof groups[number];
const tokenGroups: Record<string, Group> = {
  keyword: "keyword", literal: "keyword", built_in: "keyword", operator: "keyword",
  string: "string", regexp: "string", addition: "string", number: "number", symbol: "number",
  title: "title", type: "title", attr: "title", attribute: "title", property: "title", name: "title",
  section: "title", "selector-tag": "title", "selector-class": "title", "selector-id": "title",
  comment: "comment", doctag: "comment", meta: "meta", deletion: "meta", variable: "meta",
};
interface Segment { node: Text; start: number; end: number }
interface Token { start: number; end: number; group: Group }
const cache = new WeakMap<Element, { source: string; language: string; html: string; detectedLanguage?: string }>();
const languageLabels: Record<string, string> = {
  bash: "Bash", shell: "Bash", sh: "Bash", zsh: "Bash", cpp: "C++", "c++": "C++", css: "CSS",
  go: "Go", golang: "Go", java: "Java", javascript: "JavaScript", js: "JavaScript", json: "JSON",
  python: "Python", py: "Python", sql: "SQL", typescript: "TypeScript", ts: "TypeScript",
  xml: "XML", html: "HTML", yaml: "YAML", yml: "YAML", text: "纯文本", plaintext: "纯文本", none: "纯文本",
};

// 保留捕获代码中的换行、空格与原节点；BR 仅在词法分析输入中代表换行。
// Preserve captured text and nodes; BR contributes a newline only to the lexer input.
function codeSource(code: Element) {
  let source = "";
  const segments: Segment[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      const start = source.length;
      source += node.nodeValue ?? "";
      segments.push({ node: node as Text, start, end: source.length });
    } else if (node.nodeType === 1 && (node as Element).localName === "br") source += "\n";
    else node.childNodes.forEach(visit);
  };
  visit(code);
  return { source, segments };
}

function highlighted(code: Element, source: string) {
  const classes = `${code.className} ${code.parentElement?.className ?? ""}`;
  if (/\b(?:no-highlight|nohighlight|language-(?:text|plaintext|none))\b/iu.test(classes) || source.length > MAX_CODE_LENGTH || !source.trim()) return undefined;
  const language = /\b(?:language|lang)-([\w+-]+)/iu.exec(classes)?.[1].toLowerCase() ?? "";
  const previous = cache.get(code);
  if (previous?.source === source && previous.language === language) return previous.html;
  if (language && !highlighter.getLanguage(language)) return undefined;
  try {
    const result = language ? highlighter.highlight(source, { language, ignoreIllegals: true })
      : highlighter.highlightAuto(source, Object.keys(languages));
    cache.set(code, { source, language, html: result.value, detectedLanguage: result.relevance >= 3 ? result.language : undefined });
    return result.value;
  } catch { return undefined; }
}

// Header labels use attributes and CSS, preserving the nodes referenced by saved reading CFIs.
function labelCodeBlocks(document: Document) {
  for (const pre of document.querySelectorAll("pre")) {
    const code = pre.querySelector(":scope > code");
    const target = code ?? pre;
    const source = codeSource(target).source;
    const result = highlighted(target, source);
    const classes = `${target.className} ${pre.className}`;
    const declared = /\b(?:language|lang)-([\w+-]+)/iu.exec(classes)?.[1].toLowerCase();
    const language = declared ?? (result !== undefined ? cache.get(target)?.detectedLanguage : undefined) ?? "plaintext";
    pre.setAttribute("data-bk-code-language", languageLabels[language] ?? language);
    // Captured three-dot toolbar images precede the code in an otherwise empty wrapper.
    // Keep the original image/wrapper in the DOM; ordinary body and inline code images are untouched.
    const header = pre.firstElementChild;
    if (!header || header === code) continue;
    const imageOnly = header.localName === "img" || header.children.length === 1
      && header.firstElementChild?.localName === "img" && !header.textContent?.trim();
    const before = Array.from(pre.childNodes).slice(0, Array.from(pre.childNodes).indexOf(header));
    if (imageOnly && before.every(node => node.nodeType === 3 && !node.textContent?.trim()))
      header.setAttribute("data-bk-code-decoration", "true");
  }
}

function tokens(document: Document, html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  let offset = 0;
  const result: Token[] = [];
  const visit = (node: Node, inherited?: Group) => {
    if (node.nodeType === 3) {
      const end = offset + (node.nodeValue?.length ?? 0);
      if (inherited && end > offset) result.push({ start: offset, end, group: inherited });
      offset = end;
    } else {
      const group = node.nodeType === 1 ? Array.from((node as Element).classList)
        .map(name => tokenGroups[name.replace(/^hljs-/u, "")]).find(Boolean) ?? inherited : inherited;
      node.childNodes.forEach(child => visit(child, group));
    }
  };
  visit(template.content);
  return result;
}

/** Only call with already-sanitized display HTML; saved article HTML stays unchanged. */
export function highlightSanitizedCodeHtml(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  labelCodeBlocks(document);
  for (const code of document.querySelectorAll("pre > code")) {
    const result = highlighted(code, codeSource(code).source);
    if (result !== undefined) { code.innerHTML = result; code.classList.add("hljs"); }
  }
  return document.body.innerHTML;
}

// 阅读器使用原生范围着色，不插入 token 包装节点，避免改动已保存的 CFI 路径。
// Native range painting keeps the reader DOM and saved CFI paths intact.
export function highlightReaderCode(document: Document, excludedSelector?: string) {
  labelCodeBlocks(document);
  const view = document.defaultView as (Window & typeof globalThis) | null;
  const registry = view?.CSS?.highlights;
  const HighlightClass = view?.Highlight;
  if (!registry || !HighlightClass) return false;
  const ranges: Record<Group, Range[]> = { keyword: [], string: [], number: [], title: [], comment: [], meta: [] };
  let count = 0;
  for (const code of document.querySelectorAll("pre > code")) {
    const { source, segments } = codeSource(code);
    const html = highlighted(code, source);
    if (html === undefined) continue;
    let cursor = 0;
    for (const token of tokens(document, html)) {
      while (cursor < segments.length && segments[cursor].end <= token.start) cursor += 1;
      for (let index = cursor; index < segments.length && segments[index].start < token.end; index += 1) {
        const segment = segments[index];
        if (count >= MAX_RANGES || (excludedSelector && segment.node.parentElement?.closest(excludedSelector))) continue;
        const start = Math.max(token.start, segment.start) - segment.start;
        const end = Math.min(token.end, segment.end) - segment.start;
        if (end <= start) continue;
        const range = document.createRange();
        range.setStart(segment.node, start);
        range.setEnd(segment.node, end);
        ranges[token.group].push(range);
        count += 1;
      }
    }
    if (count >= MAX_RANGES) break;
  }
  for (const group of groups) {
    const key = `bk-code-${group}`;
    if (ranges[group].length) registry.set(key, new HighlightClass(...ranges[group]));
    else registry.delete(key);
  }
  return true;
}
