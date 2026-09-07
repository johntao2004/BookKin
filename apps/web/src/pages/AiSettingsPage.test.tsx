import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { api } from "../api/client";
import { AiSettingsPage } from "./AiSettingsPage";

vi.mock("../api/client", () => ({
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
    { id: "deepseek", label: "DeepSeek", type: "OPENAI_COMPATIBLE" as const, enabled: false, baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", configured: false, available: false, apiKeyConfigured: false },
  ],
};

beforeEach(() => {
  vi.mocked(api.getAiSettings).mockResolvedValue(settings);
  vi.mocked(api.updateAiSettings).mockResolvedValue(settings);
});

it("renders AI strategy and provider settings", async () => {
  render(<TestProviders><AiSettingsPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "匹配策略" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "OpenAI" })).toBeInTheDocument();
  expect(screen.getByText("入库时自动查找未匹配书目")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存设置" })).toBeInTheDocument();
  expect(screen.getByText("GPT-4o mini")).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择厂商" }));
  fireEvent.click(await screen.findByText("DeepSeek"));
  expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
  await waitFor(() => expect(api.getAiSettings).toHaveBeenCalledTimes(1));
});
