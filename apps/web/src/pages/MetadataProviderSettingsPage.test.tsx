import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { defaultGrants } from "../auth/permissions";
import { TestProviders } from "../test/TestProviders";
import { MetadataProviderSettingsPage } from "./MetadataProviderSettingsPage";
import type { MetadataProviderSettings } from "../domain/types";

vi.mock("../api/client", () => ({ api: { isDemo: true, getMetadataProviderSettings: vi.fn(), updateMetadataProviderSettings: vi.fn() } }));
const settings: MetadataProviderSettings = { providers: [
  { id: "OPEN_LIBRARY", label: "Open Library", enabled: true, available: true, description: "公开书目", homepage: "https://openlibrary.org/" },
  { id: "WIKIDATA", label: "Wikidata", enabled: false, available: true, description: "开放版本资料", homepage: "https://www.wikidata.org/" },
  { id: "GOOGLE_BOOKS", label: "Google Books", enabled: false, available: false, description: "需要密钥", homepage: "javascript:alert(1)" },
] };
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "owner", username: "owner", displayName: "主人", role: "OWNER", mustChangePassword: false }));
  vi.mocked(api.getMetadataProviderSettings).mockResolvedValue(structuredClone(settings));
  vi.mocked(api.updateMetadataProviderSettings).mockImplementation(async input => ({ providers: settings.providers.map(provider => ({ ...provider, enabled: input.providers.find(item => item.id === provider.id)?.enabled ?? provider.enabled })) }));
});
it("persists source switches without sending source URLs or API credentials", async () => {
  render(<TestProviders><MetadataProviderSettingsPage /></TestProviders>);
  fireEvent.click(await screen.findByRole("switch", { name: "Wikidata" }));
  expect(screen.getByRole("switch", { name: "Google Books" })).toBeDisabled();
  expect(screen.getAllByRole("link", { name: "查看来源" })).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  expect(await screen.findByRole("status")).toHaveTextContent("元数据来源已保存");
  expect(api.updateMetadataProviderSettings).toHaveBeenCalledWith({ providers: [
    { id: "OPEN_LIBRARY", enabled: true }, { id: "WIKIDATA", enabled: true }, { id: "GOOGLE_BOOKS", enabled: false },
  ] });
});
it("keeps metadata viewing separate from editing", async () => {
  const adminGrants = defaultGrants("ADMIN").filter(code => code !== "settings.metadata.edit");
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "admin", username: "admin", displayName: "管理员", role: "ADMIN", mustChangePassword: false }));
  sessionStorage.setItem("bookkin-demo-role-permissions", JSON.stringify({ revision: 1, grants: {
    OWNER: defaultGrants("OWNER"), ADMIN: adminGrants, MEMBER: defaultGrants("MEMBER"),
  } }));
  render(<TestProviders><MetadataProviderSettingsPage /></TestProviders>);
  expect(await screen.findByRole("switch", { name: "Open Library" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  expect(api.getMetadataProviderSettings).toHaveBeenCalled();
  expect(api.updateMetadataProviderSettings).not.toHaveBeenCalled();
});
it("keeps a failed save visible and preserves switches for retry", async () => {
  vi.mocked(api.updateMetadataProviderSettings).mockRejectedValueOnce(new Error("保存失败，请重试"));
  render(<TestProviders><MetadataProviderSettingsPage /></TestProviders>);
  fireEvent.click(await screen.findByRole("switch", { name: "Wikidata" }));
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("保存失败，请重试");
  expect(screen.getByRole("switch", { name: "Wikidata" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(api.updateMetadataProviderSettings).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole("status")).toHaveTextContent("元数据来源已保存");
});
it("recovers a failed load through the explicit retry action", async () => {
  vi.mocked(api.getMetadataProviderSettings).mockRejectedValueOnce(new Error("offline"));
  render(<TestProviders><MetadataProviderSettingsPage /></TestProviders>);
  fireEvent.click(await screen.findByRole("button", { name: "重试" }));
  expect(await screen.findByRole("switch", { name: "Open Library" })).toBeChecked();
});
