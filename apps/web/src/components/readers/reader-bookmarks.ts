import { EpubCFI } from "epubjs";
import type { TocItem } from "./types";

const cfi = new EpubCFI();

export function pdfBookmarkPosition(locator: string) {
  const match = /^pdf:page=(\d+)(?:&offset=(\d+))?$/u.exec(locator);
  return match ? { page: Number(match[1]), offset: Number(match[2] ?? 0) } : undefined;
}

export function compareBookmarkLocators(left: string, right: string): number | undefined {
  if (!left || !right) return undefined;
  const a = pdfBookmarkPosition(left);
  const b = pdfBookmarkPosition(right);
  if (a && b) return a.page - b.page || a.offset - b.offset;
  if (left.startsWith("epubcfi(") && right.startsWith("epubcfi(")) {
    try { return cfi.compare(left, right); } catch { return undefined; }
  }
  return left === right ? 0 : undefined;
}

export function bookmarkIsVisible(locator: string, start: string, end?: string) {
  const afterStart = compareBookmarkLocators(locator, start);
  if (afterStart === 0) return true;
  const beforeEnd = end ? compareBookmarkLocators(locator, end) : undefined;
  return afterStart !== undefined && afterStart > 0 && beforeEnd !== undefined && beforeEnd <= 0;
}

export function bookmarkTocIndex(locator: string, items: TocItem[]) {
  const exactHref = items.findIndex(item => item.href === locator);
  if (exactHref >= 0) return exactHref;
  let best = -1;
  for (let index = 0; index < items.length; index += 1) {
    const boundary = items[index].locator ?? items[index].href;
    const comparison = compareBookmarkLocators(boundary, locator);
    if (comparison === undefined || comparison > 0) continue;
    const previous = best >= 0 ? items[best].locator ?? items[best].href : "";
    const order = compareBookmarkLocators(boundary, previous);
    if (best < 0 || (order !== undefined && order >= 0)) best = index;
  }
  return best;
}

export function bookmarkLabel(locator: string, index: number) {
  const position = pdfBookmarkPosition(locator);
  return position ? `第 ${position.page} 页${position.offset ? ` · 分页 ${position.offset + 1}` : ""}` : `书签 ${index + 1}`;
}
