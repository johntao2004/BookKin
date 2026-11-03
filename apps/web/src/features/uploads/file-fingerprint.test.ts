import { Blob as NodeBlob } from "node:buffer";
import { createHash } from "node:crypto";
import { expect, it, vi, afterEach } from "vitest";
import { hashFileChunks } from "./file-fingerprint-core";
import { fileFingerprint } from "./file-fingerprint";
afterEach(() => vi.unstubAllGlobals());
it("hashes multiple bounded slices with the standard SHA-256 digest on LAN HTTP", async () => {
  const data = new Uint8Array(2 * 1024 * 1024 + 17).fill(42);
  const file = new NodeBlob([data]);
  const slice = vi.spyOn(file, "slice"); const progress = vi.fn();
  expect(await hashFileChunks(file as unknown as Blob, progress)).toBe("sha256:" + createHash("sha256").update(data).digest("hex"));
  expect(slice).toHaveBeenCalledTimes(3);
  expect(progress).toHaveBeenLastCalledWith(100);
  expect(slice.mock.calls.every(([start, end]) => Number(end) - Number(start) <= 1024 * 1024)).toBe(true);
});
it("terminates an in-flight worker and rejects when its owner unmounts", async () => {
  const terminate = vi.fn();
  class PendingWorker { postMessage = vi.fn(); terminate = terminate; }
  vi.stubGlobal("Worker", PendingWorker);
  const controller = new AbortController();
  const pending = fileFingerprint(new File(["x"], "x.pdf"), vi.fn(), controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(terminate).toHaveBeenCalledOnce();
});
