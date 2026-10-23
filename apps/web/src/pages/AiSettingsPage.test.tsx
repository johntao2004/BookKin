// 验证提供商选择与保存后恢复，避免多个提供商被意外同时启用。
// Checks provider selection and restored saved state without unintentionally enabling multiple providers.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { api, request } from "../api/client";
import { AiSettingsPage } from "./AiSettingsPage";

vi.mock("../api/client", () => ({
  request: vi.fn(),
  api: {
    isDemo: true,
    getAiSettings: vi.fn(),
    updateAiSettings: vi.fn(),
  },
}));

const settings = {
  enabled: false,
  autoMatch: true,
  maxCandidates: 4,
  timeoutSeconds: 20,
  providers: [
    { id: "openai", label: "OpenAI", type: "OPENAI_COMPATIBLE" as const, enabled: false, baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", configured: false, available: false, apiKeyConfigured: false },
    { id: "deepseek", label: "DeepSeek", type: "OPENAI_COMPATIBLE" as const, enabled: false, baseUrl: "https://api.deepseek.com", model: "deepseek-flash", configured: false, available: false, apiKeyConfigured: false },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "admin", username: "admin", displayName: "管理员", role: "ADMIN", mustChangePassword: false }));
  vi.mocked(api.getAiSettings).mockResolvedValue(settings);
  vi.mocked(api.updateAiSettings).mockResolvedValue(settings);
  vi.mocked(request).mockReset();
});

it("tests saved provider settings without saving or sending the unsaved draft", async () => {
  vi.mocked(request).mockResolvedValue({ provider: "DeepSeek", model: "deepseek-flash", elapsedMs: 320 });
  render(<TestProviders><AiSettingsPage /></TestProviders>);
  fireEvent.change(await screen.findByRole("textbox", { name: "显示名称" }), { target: { value: "尚未保存的名称" } });
  fireEvent.click(screen.getByRole("button", { name: "测试已保存配置" }));
  expect(await screen.findByText(/连接成功/)).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith("/ai/test", { method: "POST" }, { timeoutMs: 150000 });
  expect(api.updateAiSettings).not.toHaveBeenCalled();
});

it("renders AI strategy and provider settings", async () => {
  render(<TestProviders><AiSettingsPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "匹配策略" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "OpenAI" })).toBeNull();
  expect(screen.getByText("入库时自动查找未匹配书目")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存策略" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存平台" })).toBeInTheDocument();
  expect(screen.getByText("GPT-4o mini")).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择厂商" }));
  fireEvent.click(await screen.findByText("DeepSeek"));
  expect(screen.getByText("deepseek-flash")).toBeInTheDocument();
  await waitFor(() => expect(api.getAiSettings).toHaveBeenCalledTimes(1));
});

it("saves only the selected provider as enabled without an extra switch", async () => {
  render(<TestProviders><AiSettingsPage /></TestProviders>);
  await screen.findByRole("textbox", { name: "显示名称" });
  expect(screen.queryByRole("switch", { name: /^启用$/ })).toBeNull();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择厂商" }));
  fireEvent.click(await screen.findByText("DeepSeek"));
  fireEvent.click(screen.getByRole("button", { name: "保存平台" }));
  await waitFor(() => expect(api.updateAiSettings).toHaveBeenCalledWith(expect.objectContaining({
    providers: [
      expect.objectContaining({ id: "openai", enabled: false }),
      expect.objectContaining({ id: "deepseek", enabled: true }),
    ],
  })));
});

it("restores the saved enabled provider on load", async () => {
  vi.mocked(api.getAiSettings).mockResolvedValue({ ...settings,
    providers: settings.providers.map(provider => ({ ...provider, enabled: provider.id === "deepseek" })) });
  render(<TestProviders><AiSettingsPage /></TestProviders>);
  expect(await screen.findByDisplayValue("DeepSeek")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "OpenAI" })).toBeNull();
});
