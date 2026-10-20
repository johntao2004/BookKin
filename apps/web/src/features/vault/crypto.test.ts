// 覆盖错误密钥、篡改、分块重排/截断和笔记归属认证，区分保密性与完整性校验。
// Covers wrong keys, tampering, reordered/truncated chunks and note ownership authentication, separating secrecy from integrity.
import { describe, it, expect, vi, afterAll } from "vitest";
import { webcrypto } from "node:crypto";
vi.stubGlobal("crypto", webcrypto);
afterAll(() => vi.unstubAllGlobals());
import { seal, open, sealJson, openJson, fileKey, chunkAad } from "./crypto";
describe("vault authenticated encryption", () => {
  it("round trips and rejects the wrong password key, tampering, reordered or truncated chunks", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const aad = chunkAad("id", 0, 2, 1500000),
      plain = new TextEncoder().encode("私有正文");
    const box = await seal(key, plain, aad);
    expect(Array.from(await open(key, box, aad))).toEqual(Array.from(plain));
    await expect(open(new Uint8Array(32), box, aad)).rejects.toThrow();
    await expect(
      open(key, box, chunkAad("id", 1, 2, 1500000)),
    ).rejects.toThrow();
    await expect(
      open(key, box, chunkAad("id", 0, 1, 1500000)),
    ).rejects.toThrow();
    await expect(open(key, box.slice(0, -1), aad)).rejects.toThrow();
    box[15] ^= 1;
    await expect(open(key, box, aad)).rejects.toThrow();
  });
  it("uses random nonces, separates file keys, and authenticates note ownership", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    expect(await sealJson(key, {}, "a")).not.toEqual(
      await sealJson(key, {}, "a"),
    );
    expect(await fileKey(key, "a")).not.toEqual(await fileKey(key, "b"));
    const note = await sealJson(key, { note: "私人笔记" }, "state:a");
    expect(await openJson(key, note, "state:a")).toEqual({ note: "私人笔记" });
    await expect(openJson(key, note, "state:b")).rejects.toThrow();
  });
});
