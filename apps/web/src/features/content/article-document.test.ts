import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { articleReaderTarget, buildArticleEpub } from "./article-document";

async function generatedZip(html: string, title = "知 & <书>", author = '作者 "A" & B') {
  const blob = await buildArticleEpub({ id: "article&1", title, author, html });
  return { blob, zip: await JSZip.loadAsync(await blob.arrayBuffer()) };
}

async function xmlFile(zip: JSZip, path: string) {
  const file = zip.file(path);
  if (!file) throw new Error(`Missing EPUB entry: ${path}`);
  const markup = await file.async("string");
  const parsed = new DOMParser().parseFromString(markup, "application/xml");
  expect(parsed.querySelector("parsererror")).toBeNull();
  return { markup, parsed };
}

describe("article EPUB adapter", () => {
  it("creates a valid EPUB package with escaped metadata, a real-title TOC, and preserved paragraph ids", async () => {
    const { blob, zip } = await generatedZip(
      '<p id="p-9">旧段落</p><p>新段落</p><h2>第二章 &amp; 后记</h2>',
    );
    expect(blob.type).toBe("application/epub+zip");
    expect(await zip.file("mimetype")?.async("string")).toBe("application/epub+zip");
    expect(zip.file("META-INF/container.xml")).toBeTruthy();

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const fileNameLength = header.getUint16(26, true);
    expect(header.getUint32(0, true)).toBe(0x04034b50);
    expect(header.getUint16(8, true)).toBe(0);
    expect(new TextDecoder().decode(bytes.slice(30, 30 + fileNameLength))).toBe("mimetype");
    await xmlFile(zip, "META-INF/container.xml");

    const { parsed: opf } = await xmlFile(zip, "EPUB/package.opf");
    const dc = "http://purl.org/dc/elements/1.1/";
    expect(opf.getElementsByTagNameNS(dc, "title")[0]?.textContent).toBe("知 & <书>");
    expect(opf.getElementsByTagNameNS(dc, "creator")[0]?.textContent).toBe('作者 "A" & B');
    expect(opf.getElementsByTagNameNS(dc, "identifier")[0]?.textContent).toBe("urn:bookkin:article:article&1");

    const { parsed: article } = await xmlFile(zip, "EPUB/article.xhtml");
    expect(article.querySelector('[id="p-9"]')?.textContent).toBe("旧段落");
    expect(article.querySelector('[id="p-2"]')?.textContent).toBe("新段落");
    expect(article.querySelector("script")).toBeNull();

    const { parsed: nav } = await xmlFile(zip, "EPUB/nav.xhtml");
    const links = Array.from(nav.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "a"));
    expect(links.map((link) => link.textContent)).toEqual(["知 & <书>", "第二章 & 后记"]);
    expect(links[1]?.getAttribute("href")).toMatch(/^article\.xhtml#article-heading-1$/u);
  });

  it("keeps same-origin article images and data images while dropping external image loads and scripts", async () => {
    const assetId = "123e4567-e89b-12d3-a456-426614174000";
    const { parsed } = await xmlFile(
      (await generatedZip(
        `<p>图文</p><img src="/api/v1/articles/assets/${assetId}" alt="内部图"><img src="https://outside.invalid/pixel.png"><img src="data:image/png;base64,aGVsbG8=" alt="内嵌图"><script>fetch('https://outside.invalid')</script>`,
      )).zip,
      "EPUB/article.xhtml",
    );
    const images = Array.from(parsed.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "img"));
    expect(images[0]?.getAttribute("src")).toBe(`${window.location.origin}/api/v1/articles/assets/${assetId}`);
    expect(images[1]?.hasAttribute("src")).toBe(false);
    expect(images[1]?.hasAttribute("data-src")).toBe(false);
    expect(images[2]?.getAttribute("src")).toBe("data:image/png;base64,aGVsbG8=");
    expect(parsed.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "script")).toHaveLength(0);
  });

  it("packages controlled responsive rules, strips source CSS, and retains article media", async () => {
    const assetId = "123e4567-e89b-12d3-a456-426614174000";
    const { zip } = await generatedZip(
      `<p style="color:red;white-space:nowrap">https://example.invalid/a-very-long-unbroken-address</p><pre style="font-family:monospace">long unbroken code</pre><table style="width:1200px"><tr><td>long cell value</td></tr></table><img src="/api/v1/articles/assets/${assetId}" alt="保留图片">`,
    );
    const css = await zip.file("EPUB/article.css")?.async("string");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("img {");
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("height: auto");
    expect(css).toContain("white-space: pre-wrap");
    expect(css).toContain("table-layout: fixed");
    expect(css).not.toMatch(/font-family|color\s*:/iu);

    const { parsed: article } = await xmlFile(zip, "EPUB/article.xhtml");
    expect(article.querySelector("[style]")).toBeNull();
    expect(article.querySelector('link[rel="stylesheet"]')?.getAttribute("href")).toBe("article.css");
    expect(article.querySelector("img")?.getAttribute("alt")).toBe("保留图片");
    expect(article.querySelector("img")?.getAttribute("src")).toBe(
      `${window.location.origin}/api/v1/articles/assets/${assetId}`,
    );
  });

  it("maps legacy paragraph locators and preserves CFI locators", () => {
    expect(articleReaderTarget()).toBeUndefined();
    expect(articleReaderTarget("p-12")).toBe("article.xhtml#p-12");
    expect(articleReaderTarget("article.xhtml#p-12")).toBe("article.xhtml#p-12");
    expect(articleReaderTarget("epubcfi(/6/2!/4/2)")).toBe("epubcfi(/6/2!/4/2)");
    expect(articleReaderTarget("somewhere-else")).toBeUndefined();
  });

  it("reuses a captured opening title once in the reader and TOC without shifting source nodes", async () => {
    const title = "一次 OOMKilled 背后的 28 万个幽灵协程";
    const { zip } = await generatedZip(`<section><h1 id="p-2">一次 <strong>OOMKilled</strong> 背后的 28 万个幽灵协程</h1><p id="p-4">正文</p><h2 id="p-5">下一节</h2></section>`, title);
    const { parsed } = await xmlFile(zip, "EPUB/article.xhtml");
    const main = parsed.querySelector("main")!;
    expect(main.children[0].id).toBe("bookkin-article-title");
    expect(main.children[0].getAttribute("hidden")).toBe("hidden");
    expect(main.children[0].getAttribute("aria-hidden")).toBe("true");
    expect(main.children[1].querySelector("h1")?.id).toBe("p-2");
    expect(parsed.querySelectorAll("h1:not([hidden])")).toHaveLength(1);
    expect(parsed.querySelector("#p-4")?.textContent).toBe("正文");
    const { parsed: nav } = await xmlFile(zip, "EPUB/nav.xhtml");
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.map(link => link.textContent)).toEqual([title, "下一节"]);
    expect(links[0].getAttribute("href")).toBe("article.xhtml#p-2");
  });

  it("ignores formatting whitespace in an opening title but retains a matching later section title", async () => {
    const opening = await generatedZip('<p> </p><h2>知&nbsp;与 <em>行</em></h2><p>正文</p>', "知与行");
    const { parsed: deduplicated } = await xmlFile(opening.zip, "EPUB/article.xhtml");
    expect(deduplicated.querySelector("[data-bk-duplicate-title]")).not.toBeNull();
    const later = await generatedZip('<p>正文介绍</p><h2 id="chapter">知与行</h2>', "知与行");
    const { parsed: preserved } = await xmlFile(later.zip, "EPUB/article.xhtml");
    expect(preserved.querySelector("[data-bk-duplicate-title]")).toBeNull();
    expect(preserved.querySelector("h1")?.textContent).toBe("知与行");
    expect(preserved.querySelector("#chapter")?.textContent).toBe("知与行");
  });
});
