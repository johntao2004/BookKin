import { randomId } from "../../utils/random-id";
import JSZip from "jszip";
import DOMPurify from "dompurify";
import {
  CHUNK_SIZE,
  chunkAad,
  fileKey,
  seal,
  open,
  sealJson,
  openJson,
} from "./crypto";
import { vaultApi, type VaultObject } from "./api";
import { emptyReading, type ReadingState } from "../content/api";
export interface Manifest {
  version: 1;
  title: string;
  format: "EPUB" | "PDF";
  size: number;
  chunks: number;
}
export interface UnlockedObject extends VaultObject {
  metadata: Manifest;
  reading: ReadingState;
}
export async function importVaultFile(
  file: File,
  master: Uint8Array,
  onProgress: (n: number) => void,
  signal: AbortSignal,
) {
  if (
    !/\.(epub|pdf)$/i.test(file.name) ||
    file.size === 0 ||
    file.size > 100 * 1024 * 1024
  )
    throw new Error("请选择不超过 100 MB 的 EPUB 或 PDF。");
  const format = /\.pdf$/i.test(file.name) ? "PDF" : "EPUB";
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (
    (format === "PDF" && new TextDecoder().decode(head) !== "%PDF-") ||
    (format === "EPUB" && (head[0] !== 80 || head[1] !== 75))
  )
    throw new Error("文件内容与格式不一致。");
  const id = randomId(),
    chunks = Math.ceil(file.size / CHUNK_SIZE);
  const metadata: Manifest = {
    version: 1,
    title: file.name.replace(/\.[^.]+$/, ""),
    format,
    size: file.size,
    chunks,
  };
  const derived = await fileKey(master, id);
  try {
    signal.throwIfAborted();
    await vaultApi.create(
      id,
      await sealJson(master, metadata, `manifest:${id}`),
      await sealJson(master, emptyReading(), `state:${id}`),
      chunks,
    );
    for (let index = 0; index < chunks; index++) {
      signal.throwIfAborted();
      const plain = new Uint8Array(
        await file
          .slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
          .arrayBuffer(),
      );
      try {
        const bytes = await seal(
          derived,
          plain,
          chunkAad(id, index, chunks, file.size),
        );
        signal.throwIfAborted();
        await vaultApi.chunk(id, index, bytes);
      } finally {
        plain.fill(0);
      }
      onProgress((index + 1) / chunks);
    }
  } catch (error) {
    await vaultApi.remove(id).catch(() => undefined);
    throw error;
  } finally {
    derived.fill(0);
  }
}
export async function unlockObjects(master: Uint8Array) {
  return Promise.all(
    (await vaultApi.list()).map(async (x) => {
      const metadata = await openJson<Manifest>(
        master,
        x.manifest,
        `manifest:${x.id}`,
      );
      if (
        metadata.version !== 1 ||
        !["EPUB", "PDF"].includes(metadata.format) ||
        metadata.size < 1 ||
        metadata.size > 100 * 1024 * 1024 ||
        metadata.chunks !== Math.ceil(metadata.size / CHUNK_SIZE) ||
        metadata.chunks !== x.chunk_count
      )
        throw new Error("加密文件清单无效。");
      return {
        ...x,
        metadata,
        reading: await openJson<ReadingState>(master, x.state, `state:${x.id}`),
      };
    }),
  );
}
export async function decryptChunk(
  item: UnlockedObject,
  master: Uint8Array,
  index: number,
  signal: AbortSignal,
) {
  const response = await fetch(
    `/api/v1/vault/objects/${item.id}/chunks/${index}`,
    { credentials: "include", cache: "no-store", signal },
  );
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("bookkin:session-expired"));
    throw new Error("无法读取密文分块，请重新登录或重新导入。");
  }
  const derived = await fileKey(master, item.id);
  try {
    const plain = await open(
      derived,
      new Uint8Array(await response.arrayBuffer()),
      chunkAad(item.id, index, item.metadata.chunks, item.metadata.size),
    );
    const expected = Math.min(
      CHUNK_SIZE,
      item.metadata.size - index * CHUNK_SIZE,
    );
    if (plain.length !== expected) throw new Error("密文长度校验失败。");
    return plain;
  } finally {
    derived.fill(0);
  }
}
export async function decryptFile(
  item: UnlockedObject,
  master: Uint8Array,
  signal: AbortSignal,
) {
  const bytes = new Uint8Array(item.metadata.size);
  try {
    for (let index = 0; index < item.metadata.chunks; index++) {
      const part = await decryptChunk(item, master, index, signal);
      bytes.set(part, index * CHUNK_SIZE);
      part.fill(0);
    }
    return bytes;
  } catch (error) {
    bytes.fill(0);
    throw error;
  }
}
// EPUB 内的主动内容及外部引用不得逃出加密阅读器边界。
/** EPUB's own active/external content must not escape the encrypted reader. */
export async function privateEpub(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files).filter((x) => !x.dir);
  let expanded = 0;
  if (entries.length > 5000) throw new Error("EPUB 文件数量过多。");
  for (const entry of entries) {
    const size =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data
        ?.uncompressedSize ?? 0;
    expanded += size;
    if (size > 20 * 1024 * 1024 || expanded > 200 * 1024 * 1024)
      throw new Error("EPUB 解压大小超限。");
  }
  for (const entry of entries) {
    if (/\.(x?html?|svg)$/i.test(entry.name)) {
      const html = DOMPurify.sanitize(await entry.async("string"), {
        WHOLE_DOCUMENT: true,
        FORBID_TAGS: [
          "script",
          "iframe",
          "form",
          "object",
          "embed",
          "svg",
          "video",
          "audio",
          "base",
        ],
        FORBID_ATTR: ["srcset"],
      });
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("[href],[src]").forEach((el) => {
        for (const attr of ["href", "src"]) {
          const value = el.getAttribute(attr);
          if (
            value &&
            (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(value) || value.startsWith("/"))
          )
            el.removeAttribute(attr);
        }
      });
      doc
        .querySelectorAll("style,link[rel=stylesheet]")
        .forEach((el) => el.remove());
      doc
        .querySelectorAll("[style]")
        .forEach((el) => el.removeAttribute("style"));
      zip.file(entry.name, "<!DOCTYPE html>" + doc.documentElement.outerHTML);
    } else if (/\.(css|js)$/i.test(entry.name)) {
      zip.file(entry.name, "");
    }
  }
  return zip.generateAsync({ type: "uint8array" });
}
