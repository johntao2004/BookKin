import { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { TestProviders } from "../test/TestProviders";
import { VaultPage } from "./VaultPage";
import { vaultApi } from "../features/vault/api";
import { ApiRequestError } from "../api/client";
import { deviceKeys } from "../features/vault/device-keys";
import * as files from "../features/vault/files";
import { b64 } from "../features/vault/crypto";
import { emptyReading } from "../features/content/api";
const vaultPermissions = vi.hoisted(() => new Set(["vault.read", "vault.upload", "vault.delete"]));

vi.mock("../features/vault/VaultAccessGate", () => ({ VaultAccessGate: ({ children }: { children: ReactNode }) => children }));
vi.mock("../auth/AuthContext", async original => ({ ...await original<object>(), useAuth: () => ({ user: { id: "qa-user" } }) }));
vi.mock("../features/vault/VaultReader", () => ({ VaultReader: () => <div>测试阅读器</div> }));
vi.mock("../auth/permissions", () => ({ usePermissions: () => ({ can: (permission: string) => vaultPermissions.has(permission) }) }));
const envelope = JSON.stringify({ version: 3, kind: "two-factor" });
const access = () => ({ key: b64(new Uint8Array(32).fill(19)), envelope, revision: 2 });
const legacyError = () => new ApiRequestError("旧版密文需要从原先可阅读的浏览器迁移密钥，现有书籍未被改动。", 409, "VAULT_LEGACY_KEY_REQUIRED");
beforeEach(() => {
  vi.restoreAllMocks(); vi.stubGlobal("crypto", webcrypto);
  vaultPermissions.clear(); ["vault.read", "vault.upload", "vault.delete"].forEach(permission => vaultPermissions.add(permission));
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  vi.spyOn(vaultApi, "open").mockResolvedValue(access());
  vi.spyOn(vaultApi, "migrateKey").mockResolvedValue(access());
  vi.spyOn(files, "unlockObjects").mockResolvedValue([]);
  vi.spyOn(deviceKeys, "remember").mockResolvedValue(undefined);
  vi.spyOn(deviceKeys, "restore").mockResolvedValue(null);
});
afterEach(() => vi.unstubAllGlobals());
const show = () => render(<TestProviders><VaultPage /></TestProviders>);

it("opens directly after 2FA without device storage or a separate password", async () => {
  show(); expect(await screen.findByText("秘阁暂无书籍")).toBeVisible();
  expect(vaultApi.open).toHaveBeenCalledOnce();
  expect(screen.queryByLabelText(/密码|恢复密钥/)).not.toBeInTheDocument();
  expect(screen.queryByText("完成一次本机授权")).not.toBeInTheDocument();
  expect(deviceKeys.remember).not.toHaveBeenCalled(); expect(deviceKeys.restore).not.toHaveBeenCalled();
});
it("opens a later browser visit by receiving the same gated content key", async () => {
  const first = show(); expect(await screen.findByText("秘阁暂无书籍")).toBeVisible();
  first.unmount(); show(); expect(await screen.findByText("秘阁暂无书籍")).toBeVisible();
  expect(vaultApi.open).toHaveBeenCalledTimes(2); expect(deviceKeys.restore).not.toHaveBeenCalled();
});
it("migrates an already-authorized legacy key only after decrypting its real objects", async () => {
  vi.spyOn(vaultApi, "open").mockRejectedValue(legacyError());
  vi.spyOn(vaultApi, "config").mockResolvedValue({ envelope: "legacy", revision: 1 });
  const master = new Uint8Array(32).fill(19); vi.spyOn(deviceKeys, "restore").mockResolvedValue({ master });
  show(); expect(await screen.findByText("秘阁暂无书籍")).toBeVisible();
  expect(vaultApi.migrateKey).toHaveBeenCalledWith(b64(new Uint8Array(32).fill(19)), 1);
  expect(vi.mocked(files.unlockObjects).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(vaultApi.migrateKey).mock.invocationCallOrder[0]);
  expect([...master].every(byte => byte === 0)).toBe(true);
});
it("does not replace nonempty legacy ciphertext when no old key is available", async () => {
  vi.spyOn(vaultApi, "open").mockRejectedValue(legacyError());
  vi.spyOn(vaultApi, "config").mockResolvedValue({ envelope: "legacy", revision: 1 }); show();
  expect(await screen.findByText(/旧版密文需要/)).toBeVisible();
  expect(vaultApi.migrateKey).not.toHaveBeenCalled(); expect(files.unlockObjects).not.toHaveBeenCalled();
  expect(screen.queryByLabelText(/密码/)).not.toBeInTheDocument();
});
it("fails closed when the fresh 2FA grant is rejected", async () => {
  vi.spyOn(vaultApi, "open").mockRejectedValue(new ApiRequestError("请验证身份", 403, "TWO_FACTOR_REQUIRED")); show();
  expect(await screen.findByText("请验证身份")).toBeVisible(); expect(files.unlockObjects).not.toHaveBeenCalled();
});
it("wipes the in-memory key on unmount", async () => {
  const page = show(); expect(await screen.findByText("秘阁暂无书籍")).toBeVisible();
  const master = vi.mocked(files.unlockObjects).mock.calls[0][0]; page.unmount();
  expect([...master].every(byte => byte === 0)).toBe(true);
});
it("never decrypts a key response arriving after leaving the page", async () => {
  let finish!: (value: ReturnType<typeof access>) => void;
  vi.spyOn(vaultApi, "open").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const page = show(); await waitFor(() => expect(vaultApi.open).toHaveBeenCalled()); page.unmount(); finish(access());
  await waitFor(() => expect(files.unlockObjects).not.toHaveBeenCalled());
});

it("does not open or decrypt the vault when reading is disabled", async () => {
  vaultPermissions.delete("vault.read");
  const list = vi.spyOn(vaultApi, "list");
  show();
  expect(await screen.findByText(/阅读与浏览权限未开启/)).toBeVisible();
  expect(vaultApi.open).not.toHaveBeenCalled();
  expect(list).not.toHaveBeenCalled();
  expect(files.unlockObjects).not.toHaveBeenCalled();
});

it("allows upload-only access to obtain a key on demand without decrypting existing objects", async () => {
  vaultPermissions.delete("vault.read");
  const importFile = vi.spyOn(files, "importVaultFile").mockResolvedValue(undefined);
  const { container } = show();
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["%PDF-"], "private.pdf")] } });
  await waitFor(() => expect(importFile).toHaveBeenCalledOnce());
  expect(vaultApi.open).toHaveBeenCalledOnce();
  expect(files.unlockObjects).not.toHaveBeenCalled();
});

it("does not expose or invoke deletion when its action grant is disabled", async () => {
  vaultPermissions.delete("vault.delete");
  vi.spyOn(files, "unlockObjects").mockResolvedValue([{
    id: "vault-book", manifest: "sealed", state: "sealed", revision: 1, chunk_count: 1,
    metadata: { version: 1, title: "秘阁书", format: "PDF", size: 5, chunks: 1 },
    reading: emptyReading(),
  }]);
  const remove = vi.spyOn(vaultApi, "remove");
  show();
  fireEvent.click(await screen.findByRole("button", { name: "秘阁书更多操作" }));
  expect(screen.queryByRole("menuitem", { name: "永久删除" })).not.toBeInTheDocument();
  expect(remove).not.toHaveBeenCalled();
});

it("does not invoke upload when its action grant is disabled, including a direct file input event", async () => {
  vaultPermissions.delete("vault.upload");
  const importFile = vi.spyOn(files, "importVaultFile");
  const { container } = show();
  await screen.findByText("秘阁暂无书籍");
  expect(screen.queryByRole("button", { name: "上传书籍" })).not.toBeInTheDocument();
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["%PDF-"], "private.pdf")] } });
  expect(importFile).not.toHaveBeenCalled();
});
it("wipes a delayed legacy-device restoration without decrypting or migrating after departure", async () => {
  vi.spyOn(vaultApi, "open").mockRejectedValue(legacyError());
  vi.spyOn(vaultApi, "config").mockResolvedValue({ envelope: "legacy", revision: 1 });
  let finish!: (value: { master: Uint8Array }) => void;
  vi.spyOn(deviceKeys, "restore").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const page = show(); await waitFor(() => expect(deviceKeys.restore).toHaveBeenCalled()); page.unmount();
  const master = new Uint8Array(32).fill(17); finish({ master });
  await waitFor(() => expect([...master].every(byte => byte === 0)).toBe(true));
  expect(files.unlockObjects).not.toHaveBeenCalled(); expect(vaultApi.migrateKey).not.toHaveBeenCalled();
});
