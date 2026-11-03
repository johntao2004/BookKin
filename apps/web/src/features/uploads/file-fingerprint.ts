import { hashFileChunks } from "./file-fingerprint-core";

export async function fileFingerprint(file: File, onProgress: (progress: number) => void, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  if (typeof Worker === "undefined") return hashFileChunks(file, onProgress, signal);
  const worker = new Worker(new URL("./file-fingerprint.worker.ts", import.meta.url), { type: "module" });
  let abort: (() => void) | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      abort = () => reject(new DOMException("文件检查已取消", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      worker.onmessage = (event: MessageEvent<{ fingerprint?: string; progress?: number; error?: string }>) => {
        if (event.data.error) reject(new Error(event.data.error));
        else if (event.data.fingerprint) resolve(event.data.fingerprint);
        else if (event.data.progress !== undefined) onProgress(event.data.progress);
      };
      worker.onerror = () => reject(new Error("无法检查文件，请重新选择后重试"));
      worker.postMessage({ file });
    });
  } finally {
    if (abort) signal?.removeEventListener("abort", abort);
    worker.terminate();
  }
}
