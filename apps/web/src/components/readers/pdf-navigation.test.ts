import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfNavigation } from "./pdf-navigation";

function documentWith(outline: unknown) {
  return { numPages: 500, getOutline: async () => outline, getDestination: async () => { throw new Error("broken destination"); } } as unknown as PDFDocumentProxy;
}
describe("PDF source navigation", () => {
  it("preserves source numeric titles and their destinations", async () => {
    const items = await pdfNavigation(documentWith([{ title: "目录", dest: [5] }, ...Array.from({ length: 340 }, (_, i) => ({ title: String(i + 1), dest: [i + 7] }))]));
    expect(items[0].label).toBe("目录");
    expect(items[1]).toMatchObject({ label: "1", locator: "pdf:page=8" });
    expect(items[340]).toMatchObject({ label: "340", locator: "pdf:page=347" });
  });
  it("returns no generated entries when the source has no outline", async () => {
    expect(await pdfNavigation(documentWith(null))).toEqual([]);
  });
  it("retains numeric chapter titles when destinations are not consecutive pages", async () => {
    const items = await pdfNavigation(documentWith(Array.from({ length: 12 }, (_, i) => ({ title: String(i + 1), dest: [i * 10] }))));
    expect(items.map(item => item.label)).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
  });
  it("keeps valid siblings and a parent with no destination when one destination is malformed", async () => {
    const items = await pdfNavigation(documentWith([{ title: "broken", dest: "missing" }, { title: "分部", items: [{ title: "章节", dest: [10] }] }, { title: "后记", dest: [40] }]));
    expect(items).toEqual([
      { label: "分部", href: "pdf:page=11", locator: "pdf:page=11", depth: 0 },
      { label: "章节", href: "pdf:page=11", locator: "pdf:page=11", depth: 1 },
      { label: "后记", href: "pdf:page=41", locator: "pdf:page=41", depth: 0 },
    ]);
  });
});
