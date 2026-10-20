// 专区 API 仅传输信封、密文和修订信息；解密与口令派生在浏览器执行。
// Vault APIs transport envelopes, ciphertext and revisions; decryption and password derivation stay in the browser.
import { request } from "../../api/client";
export interface VaultObject {
  id: string;
  manifest: string;
  state: string;
  revision: number;
  chunk_count: number;
}
export const vaultApi = {
  config: () =>
    request<{ envelope: string; revision: number }>("/vault/config"),
  saveConfig: (envelope: unknown, revision: number) =>
    request<void>("/vault/config", {
      method: "PUT",
      body: JSON.stringify({ envelope: JSON.stringify(envelope), revision }),
    }),
  list: () => request<VaultObject[]>("/vault/objects"),
  create: (id: string, manifest: string, state: string, chunkCount: number) =>
    request<void>(`/vault/objects/${id}`, {
      method: "POST",
      body: JSON.stringify({ manifest, state, chunkCount }),
    }),
  chunk: (id: string, index: number, bytes: Uint8Array) =>
    request<void>(`/vault/objects/${id}/chunks/${index}`, {
      method: "PUT",
      body: new Blob([new Uint8Array(bytes)], {
        type: "application/octet-stream",
      }),
    }),
  state: (id: string, state: string, revision: number) =>
    request<void>(`/vault/objects/${id}/state`, {
      method: "PUT",
      body: JSON.stringify({ state, revision }),
    }),
  remove: (id: string) =>
    request<void>(`/vault/objects/${id}`, { method: "DELETE" }),
};
