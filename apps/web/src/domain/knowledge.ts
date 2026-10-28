import type { BookKnowledgePoint } from "./types";

/** The server verifies excerpts; the UI never offers incomplete evidence entries. */
export function selectableKnowledgePoints(points: BookKnowledgePoint[]): BookKnowledgePoint[] {
  const seen = new Set<string>();
  return points.filter(point => {
    if (!point || typeof point.name !== "string" || !point.name.trim()
      || typeof point.quote !== "string" || !point.quote.trim()
      || typeof point.locator !== "string" || !point.locator.trim()) return false;
    const key = point.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
