// 以脚本、事件、可执行 URL、ZIP 逃逸和外链图片作为负例，保护确认前的导入预览。
// Uses scripts, handlers, executable URLs, ZIP escape and external images as negative cases for safe import previews.
import { it, expect } from "vitest";
import { safeHtml, importArticle } from "./import";
import JSZip from "jszip";
it("removes scripts, event handlers and executable URLs", () => {
  const html = safeHtml(
    '<p onclick="alert(1)">正文</p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">链接</a>',
  );
  expect(html).toContain("正文");
  expect(html).not.toContain("onclick");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onerror");
  expect(html).not.toContain("javascript:");
});
it("rejects ZIP traversal before importing any assets", async () => {
  const zip = new JSZip();
  zip.file("../unsafe.md", "# unsafe");
  const data = await zip.generateAsync({ type: "uint8array" });
  // jsdom File lacks arrayBuffer; JSZip accepts the ArrayBuffer through this test fixture.
  const file = Object.assign(new Uint8Array(data), {
    name: "unsafe.zip",
    size: data.length,
  }) as unknown as File;
  await expect(importArticle(file)).rejects.toThrow("不安全路径");
});

it('blocks CSS overlays and external image loading before confirmation',()=>{const html=safeHtml('<p style="position:fixed;inset:0;text-align:center;background:url(https://example.com/track)">内容</p><img src="https://example.com/track"><input type="password">');expect(html).not.toContain('position:fixed');expect(html).not.toContain('background');expect(html).not.toContain('<input');expect(html).toContain('text-align:center');const doc=new DOMParser().parseFromString(html,'text/html');expect(doc.querySelector('img')?.getAttribute('src')).toBeNull();expect(doc.querySelector('img')?.getAttribute('data-src')).toBe('https://example.com/track');});
