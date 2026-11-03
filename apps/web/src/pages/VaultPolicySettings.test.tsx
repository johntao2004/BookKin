import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TestProviders } from "../test/TestProviders";
import { VaultPolicySettings } from "./VaultPolicySettings";
import { vaultAccessApi } from "../features/vault/access-api";
let role = "OWNER";
vi.mock("../auth/AuthContext", async original => ({ ...await original<object>(), useAuth: () => ({ user: { id: "owner-1", role } }) }));
beforeEach(() => { vi.restoreAllMocks(); role = "OWNER"; });
it("saves the owner's switch using the policy revision", async () => {
  vi.spyOn(vaultAccessApi, "policy").mockResolvedValue({ enabled: false, configured: true, revision: 2 });
  const save = vi.spyOn(vaultAccessApi, "savePolicy").mockResolvedValue({ enabled: true, configured: true, revision: 3 });
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><VaultPolicySettings /></QueryClientProvider>); const toggle = await screen.findByRole("switch", { name: "启用禁书区" }); fireEvent.click(toggle);
  await waitFor(() => expect(save).toHaveBeenCalledWith(true, 2)); await waitFor(() => expect(toggle).toBeChecked());
  expect(client.getQueryData(["vault-navigation-status", "owner-1"])).toBe(true);
});
it("disables enabling when the server encryption key is not configured", async () => {
  vi.spyOn(vaultAccessApi, "policy").mockResolvedValue({ enabled: false, configured: false, revision: 0 }); render(<TestProviders><VaultPolicySettings /></TestProviders>);
  expect(await screen.findByRole("switch", { name: "启用禁书区" })).toBeDisabled();
});
it("keeps administrators read-only", async () => {
  role = "ADMIN"; vi.spyOn(vaultAccessApi, "policy").mockResolvedValue({ enabled: true, configured: true, revision: 1 }); render(<TestProviders><VaultPolicySettings /></TestProviders>);
  expect(await screen.findByRole("switch", { name: "启用禁书区" })).toBeDisabled();
});
