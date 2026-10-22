import DOMPurify from "dompurify";
import { marked } from "marked";
import JSZip from "jszip";
export function safeHtml(html: string) {
  const sanitized=DOMPurify.sanitize(html, {
    FORBID_TAGS:["style","iframe","form","input","button","textarea","select","option","video","audio","svg","object","embed","link","meta","base","picture","source"],
    FORBID_ATTR:["srcset"],ADD_ATTR:["style","data-src"],ALLOW_DATA_ATTR:false,
  });
  const doc=new DOMParser().parseFromString(sanitized,"text/html");
  for(const element of doc.querySelectorAll('[style]')){
    const rules=(element.getAttribute('style')??'').split(';').map(rule=>rule.trim()).filter(rule=>/^(?:text-align\s*:\s*(?:left|right|center|justify)|font-weight\s*:\s*(?:bold|normal|[1-9]00)|font-style\s*:\s*(?:italic|normal)|text-decoration\s*:\s*(?:underline|line-through)|white-space\s*:\s*(?:pre-wrap|normal))$/i.test(rule));
    element.removeAttribute('style');if(rules.length)element.setAttribute('style',rules.join(';'));
  }
  for(const image of doc.querySelectorAll('img')){
    const source=image.getAttribute('data-src')||image.getAttribute('src')||'';
    if(!/^\/api\/v1\/articles\/assets\/[0-9a-f-]{36}$/i.test(source)&&!/^data:image\/(?:png|jpeg|webp);base64,/i.test(source)){
      image.setAttribute('data-src',source);image.removeAttribute('src');if(!image.getAttribute('alt'))image.setAttribute('alt','图片将自动导入');
    }
  }
  return doc.body.innerHTML;
}

export async function importArticle(file: File): Promise<string> {
  if (file.size > 25 * 1024 * 1024) throw new Error("导入文件不能超过 25 MB。");
  if (/\.zip$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((x) => !x.dir);
    if (entries.length > 100) throw new Error("ZIP 文件数量不能超过 100 个。");
    // JSZip 提供其路径清理之前的原始名称，便于自行检查。
    // JSZip exposes original names before its own path cleanup.
    for (const entry of entries) {
      const original =
        (entry as typeof entry & { unsafeOriginalName?: string })
          .unsafeOriginalName ?? entry.name;
      if (original.startsWith("/") || original.split(/[\\/]/).includes(".."))
        throw new Error("ZIP 含不安全路径。");
    }
    const sources = entries.filter((x) =>
      /\.(html?|md|markdown)$/i.test(x.name),
    );
    if (sources.length !== 1)
      throw new Error("ZIP 中需要且只能有一份 HTML 或 Markdown 正文。");
    let total = 0;
    const data = new Map<string, Uint8Array>();
    for (const entry of entries) {
      const size = (
        entry as unknown as { _data?: { uncompressedSize?: number } }
      )._data?.uncompressedSize;
      if (
        size === undefined ||
        size > 25 * 1024 * 1024 ||
        total + size > 40 * 1024 * 1024
      )
        throw new Error("ZIP 解压大小超过限制。");
      total += size;
      data.set(entry.name, await entry.async("uint8array"));
    }
    const source = sources[0];
    const text = new TextDecoder().decode(data.get(source.name));
    const html = /\.html?$/i.test(source.name)
      ? text
      : await marked.parse(text);
    const doc = new DOMParser().parseFromString(safeHtml(html), "text/html");
    for (const image of doc.querySelectorAll("img")) {
      const path = new URL(
        image.getAttribute("src") || image.getAttribute("data-src") || "",
        `https://import.invalid/${source.name}`,
      ).pathname.slice(1);
      const bytes = data.get(decodeURIComponent(path));
      if (!bytes) continue;
      if (!/\.(png|jpe?g|webp)$/i.test(path))
        throw new Error("配套图片仅支持 PNG、JPEG、WebP。");
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      image.removeAttribute("data-src");
      image.src = `data:image/${/\.png$/i.test(path) ? "png" : /\.webp$/i.test(path) ? "webp" : "jpeg"};base64,${btoa(binary)}`;
    }
    return safeHtml(doc.body.innerHTML);
  }
  if (!/\.(html?|md|markdown)$/i.test(file.name))
    throw new Error("请选择 HTML、Markdown 或 ZIP 文件。");
  const text = await file.text();
  return safeHtml(
    /\.html?$/i.test(file.name) ? text : await marked.parse(text),
  );
}
