import { b64, unb64 } from "./crypto";

interface DeviceRecord {
  id: string;
  userId: string;
  wrappingKey: CryptoKey;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}
export interface DeviceKeyStore {
  read(id: string): Promise<DeviceRecord | undefined>;
  write(record: DeviceRecord): Promise<void>;
  removeUser(userId: string): Promise<void>;
}

// Only encrypted key material and a non-exportable device key are persisted, never a visit grant.
class IndexedDbDeviceKeyStore implements DeviceKeyStore {
  private async database() {
    if (typeof indexedDB === "undefined") throw new Error("当前浏览器无法保存本机授权，请允许站点存储后重试。");
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("bookkin-vault-device", 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("keys", { keyPath: "id" });
        store.createIndex("userId", "userId");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("无法读取本机授权，请检查浏览器的站点存储设置。"));
      request.onblocked = () => reject(new Error("本机授权存储被其他页面占用，请关闭旧页面后重试。"));
    });
  }
  async read(id: string) {
    const db = await this.database();
    try {
      return await new Promise<DeviceRecord | undefined>((resolve, reject) => {
        const tx = db.transaction("keys", "readonly");
        const request = tx.objectStore("keys").get(id);
        tx.oncomplete = () => resolve(request.result as DeviceRecord | undefined);
        tx.onerror = tx.onabort = () => reject(new Error("读取本机授权失败。"));
      });
    } finally { db.close(); }
  }
  async write(record: DeviceRecord) {
    const db = await this.database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("keys", "readwrite");
        tx.objectStore("keys").put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(new Error("无法保存本机授权，请允许站点存储后重试。"));
      });
    } finally { db.close(); }
  }
  async removeUser(userId: string) {
    const db = await this.database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("keys", "readwrite");
        const cursor = tx.objectStore("keys").index("userId").openCursor(IDBKeyRange.only(userId));
        cursor.onsuccess = () => { if (cursor.result) { cursor.result.delete(); cursor.result.continue(); } };
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(new Error("清除本机授权失败。"));
      });
    } finally { db.close(); }
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
async function identity(userId: string, envelope: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical(JSON.parse(envelope)))));
  return `${userId}:${b64(new Uint8Array(hash))}`;
}
export function createDeviceKeyAccess(store: DeviceKeyStore) {
  return {
    async remember(userId: string, envelope: string, master: Uint8Array, recovery?: string, signal?: AbortSignal) {
      signal?.throwIfAborted();
      if (master.length !== 32) throw new Error("解密密钥格式无效。");
      const id = await identity(userId, envelope);
      const wrappingKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plain = new TextEncoder().encode(JSON.stringify({ master: b64(master), recovery }));
      try {
        const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`bookkin:vault:device:v1:${id}`) }, wrappingKey, plain);
        signal?.throwIfAborted();
        await store.write({ id, userId, wrappingKey, iv, ciphertext });
      } finally { plain.fill(0); }
    },
    async restore(userId: string, envelope: string, signal?: AbortSignal): Promise<{ master: Uint8Array; recovery?: string } | null> {
      signal?.throwIfAborted();
      const id = await identity(userId, envelope), record = await store.read(id);
      if (!record) return null;
      if (record.userId !== userId || record.id !== id || record.wrappingKey.extractable) throw new Error("本机授权格式无效，请重新授权。");
      let plain: Uint8Array;
      try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(record.iv), additionalData: new TextEncoder().encode(`bookkin:vault:device:v1:${id}`) }, record.wrappingKey, record.ciphertext)); }
      catch { throw new Error("本机授权已损坏，请使用原加密密码或解密恢复密钥重新授权。"); }
      try {
        signal?.throwIfAborted();
        const value = JSON.parse(new TextDecoder().decode(plain)) as { master: string; recovery?: string };
        const master = unb64(value.master);
        if (master.length !== 32) { master.fill(0); throw new Error("本机解密密钥无效，请重新授权。"); }
        return { master, recovery: value.recovery };
      } finally { plain.fill(0); }
    },
    forget: (userId: string) => store.removeUser(userId),
  };
}
export const deviceKeys = createDeviceKeyAccess(new IndexedDbDeviceKeyStore());
