import { afterEach, describe, expect, it, vi } from "vitest";
import { randomId } from "./random-id";

afterEach(() => vi.unstubAllGlobals());
describe("randomId", () => {
  it("works when LAN HTTP does not expose randomUUID", () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    const ids = Array.from({ length: 100 }, randomId);
    expect(new Set(ids).size).toBe(100);
    ids.forEach((id) => expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
  });
});
