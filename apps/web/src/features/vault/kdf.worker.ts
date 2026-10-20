// 在 Worker 执行 Argon2id 以避免阻塞 UI；回传后清零本地结果缓冲区。
// Runs Argon2id in a worker to avoid blocking UI and clears the local result buffer after posting it.
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
