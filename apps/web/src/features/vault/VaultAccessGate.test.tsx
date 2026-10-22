import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { TestProviders } from "../../test/TestProviders";
import { vaultAccessApi, type TwoFactorStatus } from "./access-api";
import { VaultAccessGate } from "./VaultAccessGate";
import { ConfigProvider } from "../../ui/antd";

const state = (overrides: Partial<TwoFactorStatus> = {}): TwoFactorStatus => ({ enabled: true, configured: true, bound: true, verified: false, expiresAt: Date.now() + 300_000, ...overrides });
const fillCode = async (value: string) => {
  const group = await screen.findByRole("group", { name: "6 位动态码" });
  await waitFor(() => expect(group).toBeVisible());
  fireEvent.input(within(group).getAllByRole("textbox")[0], { target: { value } });
};
const show = () => render(<TestProviders><ConfigProvider theme={{ token: { motion: false } }}><VaultAccessGate><div>加密书库内容</div></VaultAccessGate></ConfigProvider></TestProviders>);
beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(vaultAccessApi, "lock").mockResolvedValue(undefined); vi.spyOn(vaultAccessApi, "renew").mockResolvedValue(state({ verified: true })); });
it("blocks an unconfigured or disabled feature without mounting vault content", async () => {
  vi.spyOn(vaultAccessApi, "status").mockResolvedValue(state({ enabled: false })); show();
  expect(await screen.findByText("秘藏阁尚未启用")).toBeVisible(); expect(screen.queryByText("加密书库内容")).not.toBeInTheDocument();
});
it("guides an unbound user through password, QR, confirmation and saved backup codes", async () => {
  const status = vi.spyOn(vaultAccessApi, "status").mockResolvedValue(state({ bound: false }));
  const begin = vi.spyOn(vaultAccessApi, "begin").mockResolvedValue({ id: "pending", secret: "MANUALSECRET", uri: "otpauth://totp/BookKin?secret=MANUALSECRET", expiresAt: Date.now() + 600_000 });
  const confirm = vi.spyOn(vaultAccessApi, "confirm").mockResolvedValue({ recoveryCodes: ["BACKUP-ONE", "BACKUP-TWO"] });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  show(); fireEvent.change(await screen.findByLabelText("当前登录密码"), { target: { value: "login-password" } });
  fireEvent.click(screen.getByRole("button", { name: "获取绑定二维码" }));
  expect(await screen.findByLabelText("身份验证器绑定密钥")).toHaveValue("MANUALSECRET"); expect(begin).toHaveBeenCalledWith("login-password");
  await fillCode("123456"); fireEvent.click(screen.getByRole("button", { name: "确认绑定" }));
  expect(await screen.findByLabelText("2FA 备用码")).toHaveValue("BACKUP-ONE\nBACKUP-TWO"); expect(confirm).toHaveBeenCalledWith("pending", "123456");
  expect(screen.getByRole("button", { name: "已保存，继续进入" })).toBeDisabled();
  status.mockResolvedValue(state({ verified: true })); fireEvent.click(screen.getByRole("button", { name: "下载备用码" })); fireEvent.click(screen.getByRole("button", { name: "已保存，继续进入" }));
  expect(await screen.findByText("加密书库内容")).toBeVisible();
});
it("keeps the gate closed for invalid codes and opens only after server confirmation", async () => {
  const status = vi.spyOn(vaultAccessApi, "status").mockResolvedValue(state()); const verify = vi.spyOn(vaultAccessApi, "verify").mockRejectedValueOnce(new Error("动态码无效"));
  show(); await fillCode("111111");
  await waitFor(() => expect(screen.getByText("动态码无效")).toBeVisible()); expect(screen.queryByText("加密书库内容")).not.toBeInTheDocument();
  verify.mockResolvedValue(state({ verified: true })); status.mockResolvedValue(state({ verified: true })); await fillCode("222222");
  expect(await screen.findByText("加密书库内容")).toBeVisible();
});
it("unmounts decrypted content and revokes server access on lock", async () => {
  const status = vi.spyOn(vaultAccessApi, "status").mockResolvedValue(state({ verified: true })); show();
  expect(await screen.findByText("加密书库内容")).toBeVisible(); status.mockResolvedValue(state());
  fireEvent(window, new Event("bookkin:vault-lock"));
  await waitFor(() => expect(screen.queryByText("加密书库内容")).not.toBeInTheDocument()); expect(vaultAccessApi.lock).toHaveBeenCalled(); await waitFor(() => expect(screen.getByRole("group", { name: "6 位动态码" })).toBeVisible());
});
it("does not reopen from a verification response arriving after lock", async () => {
  vi.spyOn(vaultAccessApi, "status").mockResolvedValue(state()); let finish!: (value: TwoFactorStatus) => void;
  vi.spyOn(vaultAccessApi, "verify").mockImplementation(() => new Promise(resolve => { finish = resolve; })); show();
  await fillCode("123456");
  await waitFor(() => expect(vaultAccessApi.verify).toHaveBeenCalled()); fireEvent(window, new Event("bookkin:vault-lock")); finish(state({ verified: true }));
  await waitFor(() => expect(within(screen.getByRole("group", { name: "6 位动态码" })).getAllByRole("textbox")[0]).toBeEnabled()); expect(screen.queryByText("加密书库内容")).not.toBeInTheDocument();
});
it("offers one-use recovery and authenticated rebinding", async () => {
  const status = vi.spyOn(vaultAccessApi, "status").mockResolvedValue(state()); const reset = vi.spyOn(vaultAccessApi, "reset").mockResolvedValue(undefined); show();
  const rebind = await screen.findByRole("button", { name: "重新绑定身份验证器" });
  expect(screen.queryByText("输入完整后自动验证")).not.toBeInTheDocument();
  expect(rebind).toHaveAttribute("data-intent", "normal");
  expect(screen.getByRole("button", { name: "设备丢失，使用备用码" })).toHaveAttribute("data-intent", "warning");
  fireEvent.click(rebind); fireEvent.click(screen.getByRole("button", { name: "设备丢失，使用备用码" }));
  expect(screen.getByRole("button", { name: "验证并重新绑定" })).toHaveClass("ant-btn-dangerous");
  const recoveryCells = within(screen.getByRole("group", { name: "32 位备用码" })).getAllByRole("textbox");
  expect(screen.getByRole("button", { name: "验证并重新绑定" })).toBeDisabled();
  fireEvent.paste(recoveryCells[0], { clipboardData: { getData: () => "01234567-89abcdef-01234567-89abcdef" } });
  fireEvent.change(screen.getByLabelText("当前登录密码"), { target: { value: "login-password" } });
  status.mockResolvedValue(state({ bound: false })); fireEvent.click(screen.getByRole("button", { name: "验证并重新绑定" }));
  expect(await screen.findByRole("button", { name: "获取绑定二维码" })).toBeVisible(); expect(reset).toHaveBeenCalledWith("login-password", "0123456789ABCDEF0123456789ABCDEF", true);
});

it("keeps recovery submission explicit and blocks incomplete codes", async () => {
  vi.spyOn(vaultAccessApi, "status").mockResolvedValue(state());
  const verify = vi.spyOn(vaultAccessApi, "verify").mockRejectedValue(new Error("备用码无效")); show();
  fireEvent.click(await screen.findByRole("button", { name: "设备丢失，使用备用码" }));
  await waitFor(() => expect(screen.getByText("请输入已保存的 32 位备用码，可整段粘贴")).toBeVisible());
  const group = screen.getByRole("group", { name: "32 位备用码" });
  await waitFor(() => expect(group).toBeVisible());
  fireEvent.input(within(group).getAllByRole("textbox")[0], { target: { value: "123456" } });
  expect(screen.getByRole("button", { name: "验证并进入" })).toBeDisabled();
  expect(verify).not.toHaveBeenCalled();
  fireEvent.paste(within(group).getAllByRole("textbox")[0], { clipboardData: { getData: () => "01234567-89abcdef-01234567-89abcdef" } });
  expect(screen.getByRole("button", { name: "验证并进入" })).toBeEnabled();
  expect(verify).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "验证并进入" }));
  await waitFor(() => expect(screen.getByText("备用码无效")).toBeVisible());
  expect(verify).toHaveBeenCalledWith("0123456789ABCDEF0123456789ABCDEF", true);
  await waitFor(() => expect(within(group).getAllByRole("textbox").every(input => !(input as HTMLInputElement).value)).toBe(true));
});
