import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { b64 } from "./crypto";
import { createDeviceKeyAccess, type DeviceKeyStore } from "./device-keys";

type Record = NonNullable<Awaited<ReturnType<DeviceKeyStore["read"]>>>;
class MemoryStore implements DeviceKeyStore {
  records = new Map<string, Record>();
  async read(id: string) { const item = this.records.get(id); return item ? structuredClone(item) : undefined; }
  async write(record: Record) { this.records.set(record.id, structuredClone(record)); }
  async removeUser(userId: string) { for (const [id, item] of this.records) if (item.userId === userId) this.records.delete(id); }
}
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());
const envelope = JSON.stringify({ version: 2, kind: "device", recoveryBox: "ciphertext" });

it("persists encrypted per-device keys across clients without an exportable wrapping key", async () => {
  const store = new MemoryStore(), master = crypto.getRandomValues(new Uint8Array(32));
  await createDeviceKeyAccess(store).remember("a", envelope, master, "offline-recovery");
  const record = [...store.records.values()][0];
  expect(record.wrappingKey.extractable).toBe(false);
  await expect(crypto.subtle.exportKey("raw", record.wrappingKey)).rejects.toThrow();
  expect(new TextDecoder().decode(record.ciphertext)).not.toContain(b64(master));
  expect(new TextDecoder().decode(record.ciphertext)).not.toContain("offline-recovery");
  const restored = await createDeviceKeyAccess(store).restore("a", envelope);
  expect(restored?.master).toEqual(master); expect(restored?.recovery).toBe("offline-recovery");
});
it("binds entries to both account and canonical server envelope", async () => {
  const store = new MemoryStore(), access = createDeviceKeyAccess(store), master = crypto.getRandomValues(new Uint8Array(32));
  await access.remember("a", envelope, master);
  expect((await access.restore("a", '{ "recoveryBox":"ciphertext", "kind":"device", "version":2 }'))?.master).toEqual(master);
  expect(await access.restore("b", envelope)).toBeNull();
  expect(await access.restore("a", JSON.stringify({ version: 2, kind: "device", recoveryBox: "changed" }))).toBeNull();
});
it("rejects tampering and swapped identity records", async () => {
  const store = new MemoryStore(), access = createDeviceKeyAccess(store), master = crypto.getRandomValues(new Uint8Array(32));
  await access.remember("a", envelope, master);
  const record = [...store.records.values()][0]; new Uint8Array(record.ciphertext)[0] ^= 1;
  await expect(access.restore("a", envelope)).rejects.toThrow();
  record.userId = "b"; await expect(access.restore("a", envelope)).rejects.toThrow("本机授权格式无效");
});
it("does not overwrite concurrent envelopes and forgets only the selected user", async () => {
  const store = new MemoryStore(), access = createDeviceKeyAccess(store), master = crypto.getRandomValues(new Uint8Array(32));
  await Promise.all([access.remember("a", envelope, master), access.remember("a", '{"version":1}', master), access.remember("b", envelope, master)]);
  expect(store.records.size).toBe(3); await access.forget("a");
  expect(await access.restore("a", envelope)).toBeNull(); expect((await access.restore("b", envelope))?.master).toEqual(master);
});
it("does not persist an aborted or invalid key", async () => {
  const store = new MemoryStore(), access = createDeviceKeyAccess(store), controller = new AbortController(); controller.abort();
  await expect(access.remember("a", envelope, new Uint8Array(32), undefined, controller.signal)).rejects.toThrow();
  await expect(access.remember("a", envelope, new Uint8Array(12))).rejects.toThrow("解密密钥格式无效");
  expect(store.records.size).toBe(0);
});
