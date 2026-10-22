import { describe, expect, it } from "vitest";
import { reviewMarkdownToHtml } from "./markdown";

describe("review Markdown", () => {
  it("renders GFM without executable HTML or cross-content asset requests", () => {
    const html = reviewMarkdownToHtml('# 标题\n\n> 引用\n\n- 项目\n\n<script>alert(1)</script><img src="/api/v1/articles/assets/private" onerror="alert(1)">\n\n![图示](https://example.com/image.png)\n\n[链接](javascript:alert(1))');
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("h1")?.textContent).toBe("标题");
    expect(doc.querySelector("blockquote")?.textContent).toContain("引用");
    expect(doc.querySelector("li")?.textContent).toBe("项目");
    expect(doc.querySelector("script, img, [onerror]")).toBeNull();
    expect([...doc.querySelectorAll("a")].some(link => link.getAttribute("href")?.startsWith("javascript:"))).toBe(false);
    expect(doc.querySelector('a[href="https://example.com/image.png"]')?.textContent).toBe("图示");
  });
});
