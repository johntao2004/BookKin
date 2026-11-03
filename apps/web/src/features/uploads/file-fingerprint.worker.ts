import { hashFileChunks } from "./file-fingerprint-core";

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  try {
    const fingerprint = await hashFileChunks(event.data.file, progress => self.postMessage({ progress }));
    self.postMessage({ fingerprint });
  } catch {
    self.postMessage({ error: "无法检查文件，请重新选择后重试" });
  }
};
