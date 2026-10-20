import { argon2id } from "hash-wasm";
self.onmessage = async (
  event: MessageEvent<{ password: string; salt: Uint8Array }>,
) => {
  try {
    const bytes = await argon2id({
      password: event.data.password,
      salt: event.data.salt,
      parallelism: 1,
      iterations: 3,
      memorySize: 65536,
      hashLength: 32,
      outputType: "binary",
    });
    self.postMessage({ bytes });
    bytes.fill(0);
  } catch {
    self.postMessage({ error: "无法派生加密密钥。" });
  }
};
