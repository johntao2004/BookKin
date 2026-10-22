// 内容保持加密；仅在当前会话通过 2FA 后领取用户隔离的内容密钥，禁止持久缓存授权或明文密钥。
import { request as sharedRequest, ApiRequestError } from "../../api/client";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try { return await sharedRequest<T>(path, init); }
  catch (error) {
    if (error instanceof ApiRequestError && (error.status === 403 || error.code === "TWO_FACTOR_UNCONFIGURED" || error.code === "TWO_FACTOR_KEY_UNAVAILABLE"))
      window.dispatchEvent(new Event("bookkin:vault-access-required"));
    throw error;
  }
}
export interface VaultObject {
  id: string;
  manifest: string;
  state: string;
  revision: number;
  chunk_count: number;
}
export const vaultApi = {
  open: () => request<{ key: string; envelope: string; revision: number }>("/vault/key/open", { method: "POST" }),
  migrateKey: (key: string, revision: number) => request<{ key: string; envelope: string; revision: number }>("/vault/key/migrate", {
    method: "POST", body: JSON.stringify({ key, revision }),
  }),
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
