// 浏览器端信封与分块加密，AAD 绑定用途及对象；依赖安全上下文中的 Web Crypto。
// Browser envelope/chunk encryption binds purpose and objects through AAD and requires secure-context Web Crypto.
export const CHUNK_SIZE = 1024 * 1024;
const encoder = new TextEncoder();
const random = (size: number) => crypto.getRandomValues(new Uint8Array(size));
export function b64(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}
export function unb64(value: string) {
  return Uint8Array.from(atob(value), (x) => x.charCodeAt(0));
}
const buffer = (bytes: Uint8Array) => new Uint8Array(bytes).buffer;
async function key(bytes: Uint8Array) {
  return crypto.subtle.importKey("raw", buffer(bytes), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(raw: Uint8Array, bytes: Uint8Array, aad: string) {
  const iv = random(12);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: buffer(iv), additionalData: encoder.encode(aad) },
      await key(raw),
      buffer(bytes),
    ),
  );
  const out = new Uint8Array(12 + encrypted.length);
  out.set(iv);
  out.set(encrypted, 12);
  return out;
}
export async function open(raw: Uint8Array, bytes: Uint8Array, aad: string) {
  if (bytes.length < 28) throw new Error("密文格式无效。");
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: buffer(bytes.slice(0, 12)),
        additionalData: encoder.encode(aad),
      },
      await key(raw),
      buffer(bytes.slice(12)),
    ),
  );
}
export const sealJson = async (raw: Uint8Array, value: unknown, aad: string) =>
  b64(await seal(raw, encoder.encode(JSON.stringify(value)), aad));
export const openJson = async <T>(
  raw: Uint8Array,
  value: string,
  aad: string,
): Promise<T> =>
  JSON.parse(new TextDecoder().decode(await open(raw, unb64(value), aad))) as T;
export function derive(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./kdf.worker.ts", import.meta.url), {
      type: "module",
    });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("密钥派生超时，请重试。"));
    }, 60000);
    worker.onmessage = (
      event: MessageEvent<{ bytes?: Uint8Array; error?: string }>,
    ) => {
      clearTimeout(timeout);
      worker.terminate();
      if (event.data.bytes) resolve(event.data.bytes);
      else reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error("无法加载本地加密模块。"));
    };
    worker.postMessage({ password, salt });
  });
}
export interface Envelope {
  version: 1;
  kdf: "argon2id-64m-3-1";
  salt: string;
  passwordBox: string;
  recoveryBox: string;
}
export function checkPassword(password: string) {
  if (password.length < 12 || password.length > 256)
    throw new Error("二次密码需为 12–256 个字符，请使用独立长口令。");
}
export async function createEnvelope(
  password: string,
  master: Uint8Array = random(32),
) {
  checkPassword(password);
  const salt = random(16),
    derived = await derive(password, salt),
    recovery = random(32);
  try {
    const envelope: Envelope = {
      version: 1,
      kdf: "argon2id-64m-3-1",
      salt: b64(salt),
      passwordBox: b64(
        await seal(derived, master, "bookkin:vault:master:password:v1"),
      ),
      recoveryBox: b64(
        await seal(recovery, master, "bookkin:vault:master:recovery:v1"),
      ),
    };
    return { master, envelope, recovery: b64(recovery) };
  } finally {
    derived.fill(0);
    recovery.fill(0);
  }
}
export async function unlock(
  envelope: Envelope,
  password: string,
  recovery = false,
) {
  if (
    envelope.version !== 1 ||
    envelope.kdf !== "argon2id-64m-3-1" ||
    unb64(envelope.salt).length !== 16
  )
    throw new Error("不支持的密钥信封。");
  const derived = recovery
    ? unb64(password.trim())
    : await derive(password, unb64(envelope.salt));
  try {
    return await open(
      derived,
      unb64(recovery ? envelope.recoveryBox : envelope.passwordBox),
      `bookkin:vault:master:${recovery ? "recovery" : "password"}:v1`,
    );
  } catch {
    throw new Error("二次密码或恢复密钥不正确。");
  } finally {
    derived.fill(0);
  }
}
export async function fileKey(master: Uint8Array, id: string) {
  const base = await crypto.subtle.importKey(
    "raw",
    buffer(master),
    "HKDF",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encoder.encode(id),
        info: encoder.encode("bookkin:vault:file:v1"),
      },
      base,
      256,
    ),
  );
}
export const chunkAad = (
  id: string,
  index: number,
  count: number,
  size: number,
) => `bookkin:vault:chunk:v1:${id}:${index}:${count}:${size}`;
