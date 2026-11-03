import { createSHA256 } from "hash-wasm";

/** Bounded reads also work over LAN HTTP, where SubtleCrypto is unavailable. */
export async function hashFileChunks(file: Blob, onProgress: (progress: number) => void, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  const hash = await createSHA256();
  hash.init();
  const chunkSize = 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    signal?.throwIfAborted();
    const bytes = new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
    signal?.throwIfAborted();
    hash.update(bytes);
    onProgress(Math.round(Math.min(offset + bytes.length, file.size) / file.size * 100));
    // Yield when used by the non-Worker fallback as well as while processing large files.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return `sha256:${hash.digest("hex")}`;
}
