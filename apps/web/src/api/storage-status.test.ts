import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

it("uses real storage endpoints even when other features allow demo mode", async () => {
  vi.resetModules();
  vi.stubEnv("VITE_DEMO_MODE", "true");
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
    .mockResolvedValueOnce(new Response(JSON.stringify([])))
    .mockRejectedValueOnce(new TypeError("Network unavailable"));
  vi.stubGlobal("fetch", fetch);
  const { api } = await import("./client");
  await expect(api.listLiveLibraryRoots()).resolves.toEqual([]);
  await expect(api.listContentStorage()).resolves.toEqual([]);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/library-roots");
  expect(fetch.mock.calls[1][0]).toBe("/api/v1/library-roots/content-storage");
  await expect(api.listContentStorage()).rejects.toThrow();
});
