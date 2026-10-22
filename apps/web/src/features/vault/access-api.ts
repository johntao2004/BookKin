import { request } from "../../api/client";
export interface VaultPolicy { enabled: boolean; configured: boolean; revision: number }
export interface TwoFactorStatus { enabled: boolean; configured: boolean; bound: boolean; verified: boolean; expiresAt: number }
export interface Enrollment { id: string; secret: string; uri: string; expiresAt: number }
export const vaultAccessApi = {
  policy: () => request<VaultPolicy>("/users/vault-policy"),
  savePolicy: (enabled: boolean, revision: number) => request<VaultPolicy>("/users/vault-policy", { method: "PUT", body: JSON.stringify({ enabled, revision }) }),
  status: () => request<TwoFactorStatus>("/auth/two-factor/status"),
  begin: (password: string) => request<Enrollment>("/auth/two-factor/enrollment", { method: "POST", body: JSON.stringify({ password }) }),
  confirm: (id: string, code: string) => request<{ recoveryCodes: string[] }>("/auth/two-factor/confirm", { method: "POST", body: JSON.stringify({ id, code }) }),
  verify: (code: string, recovery: boolean) => request<TwoFactorStatus>("/auth/two-factor/verify", { method: "POST", body: JSON.stringify({ code, recovery }) }),
  lock: () => request<void>("/auth/two-factor/lock", { method: "POST" }),
  renew: () => request<TwoFactorStatus>("/auth/two-factor/renew", { method: "POST" }),
  reset: (password: string, code: string, recovery: boolean) => request<void>("/auth/two-factor/reset", { method: "POST", body: JSON.stringify({ password, code, recovery }) }),
};
