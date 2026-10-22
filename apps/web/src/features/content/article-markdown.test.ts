import { describe, expect, it } from "vitest";
import {
  articleHtmlToMarkdown,
  articleMarkdownToHtml,
} from "./article-markdown";

describe("article Markdown conversion", () => {
  it("renders GFM headings, lists, tables, and fenced code", () => {
    const html = articleMarkdownToHtml(
      [
        "# Heading",
        "",
        "- first",
        "- second",
        "",
        "1. ordered first",
        "2. ordered second",
        "",
        "| Name | Value |",
        "| --- | --- |",
        "| Book | 3 |",
        "",
        "```ts",
        "const answer = 42;",
        "```",
      ].join("\n"),
    );
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("h1")?.textContent).toBe("Heading");
    expect(document.querySelectorAll("ul > li")).toHaveLength(2);
    expect(document.querySelectorAll("ol > li")).toHaveLength(2);
    expect(document.querySelector("table tbody tr td")?.textContent).toBe("Book");
    expect(document.querySelector("pre code")?.textContent).toBe("const answer = 42;\n");
    expect(document.querySelector("pre code")?.className).toContain("language-ts");
  });

  it("round-trips internal and deferred external article images", () => {
    const internalSource = "/api/v1/articles/assets/123e4567-e89b-12d3-a456-426614174000";
    const externalSource = "https://cdn.example.test/article-photo.webp";
    const markdown = articleHtmlToMarkdown(
      `<p>Text <img alt="internal" src="${internalSource}"></p>` +
        `<p><img alt="external" data-src="${externalSource}"></p>`,
    );
    const html = articleMarkdownToHtml(markdown);
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(markdown).toContain(`](${internalSource})`);
    expect(markdown).toContain(`](${externalSource})`);
    expect(document.querySelector(`img[src="${internalSource}"]`)?.getAttribute("alt")).toBe("internal");
    expect(document.querySelector(`img[data-src="${externalSource}"]`)?.getAttribute("src")).toBeNull();
  });

  it("keeps HTML tables as HTML when converting the source body", () => {
    const markdown = articleHtmlToMarkdown(
      "<table><tr><th>Title</th><th>Author</th></tr>" +
        "<tr><td colspan=\"2\">A book</td></tr></table>",
    );
    const html = articleMarkdownToHtml(markdown);
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(markdown).toContain("<table>");
    expect(document.querySelector("td[colspan='2']")?.textContent).toBe("A book");
  });

  it("keeps body text inside nonstandard wrappers", () => {
    const markdown = articleHtmlToMarkdown(
      "<article-callout><p>正文需要保留</p></article-callout>",
    );

    expect(markdown).toContain("正文需要保留");
  });

  it("sanitizes scripts and javascript URLs", () => {
    const html = articleMarkdownToHtml(
      '<p>Safe <script>window.compromised = true</script> text</p>' +
        '\n\n[unsafe](javascript:alert%281%29)',
    );
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(document.body.textContent).toContain("Safe");
    expect(document.body.textContent).toContain("unsafe");

    const converted = articleHtmlToMarkdown(
      '<script>window.compromised = true</script>' +
        '<a href="javascript:alert(1)">unsafe link</a>',
    );
    expect(converted).not.toContain("window.compromised");
    expect(converted).not.toContain("javascript:");
    expect(converted).toContain("unsafe link");
  });
});
