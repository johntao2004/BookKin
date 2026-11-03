import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TocItem } from "./types";

// 直接使用原文件目录标题，仅隔离损坏的导航目标。
// Keep source outline titles and isolate malformed navigation destinations.
export async function pdfNavigation(document: PDFDocumentProxy): Promise<TocItem[]> {
  const outline = await document.getOutline();
  const flatten = async (entries: NonNullable<typeof outline>, depth = 0): Promise<TocItem[]> => (await Promise.all(entries.map(async entry => {
    const children = await flatten(entry.items ?? [], depth + 1);
    let pageNumber: number | undefined;
    try {
      const destination = typeof entry.dest === "string" ? await document.getDestination(entry.dest) : entry.dest;
      const page = destination?.[0];
      pageNumber = page === undefined ? undefined : typeof page === "number" ? page + 1 : (await document.getPageIndex(page)) + 1;
      if (!Number.isInteger(pageNumber) || pageNumber! < 1 || pageNumber! > document.numPages) pageNumber = undefined;
    } catch { /* 单个目标损坏不丢弃有效节点。 Keep valid siblings and children when a source destination is broken. */ }
    const locator = pageNumber ? `pdf:page=${pageNumber}` : children[0]?.locator;
    const label = entry.title;
    return [...(locator && label ? [{ href: locator, locator, label, depth }] : []), ...children];
  }))).flat();
  return outline ? await flatten(outline) : [];
}
