import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { UserRoleControl } from "./UserRoleControl";
import { BookKinThemeProvider } from "../theme/BookKinThemeProvider";
import { request } from "../api/client";
import type { ManagedUser } from "../domain/types";
const access = vi.hoisted(() => ({ owner: true }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner", role: "OWNER" }, ready: true }) }));
vi.mock("../auth/permissions", () => ({ usePermissions: () => ({ can: () => access.owner }) }));
vi.mock("../api/client", () => ({ api: { isDemo: false }, request: vi.fn() }));
const user: ManagedUser = { id: "member-1", username: "reader", displayName: "成员", role: "MEMBER", status: "ACTIVE", mustChangePassword: false, createdAt: "2026-10-22T00:00:00Z" };
function setup(value = user) {
  const client = new QueryClient(); client.setQueryData(["users"], [value]);
  render(<QueryClientProvider client={client}><BookKinThemeProvider><UserRoleControl user={value} /></BookKinThemeProvider></QueryClientProvider>); return client;
}
beforeEach(() => { access.owner = true; vi.mocked(request).mockReset(); });
it("hides role assignment from delegated roles and never offers to change the owner", () => {
  access.owner = false; const client = setup(); expect(screen.queryByRole("button", { name: "调整角色" })).not.toBeInTheDocument(); client.clear();
});
it("does not expose an owner-role change action", () => {
  setup({ ...user, role: "OWNER" }); expect(screen.queryByRole("button", { name: "调整角色" })).not.toBeInTheDocument();
});
it("requires an explicit confirmation and leaves roles untouched on cancellation", () => {
  setup(); fireEvent.click(screen.getByRole("button", { name: "调整角色" }));
  const dialog = within(screen.getByRole("dialog", { name: "调整用户角色" }));
  expect(dialog.getByRole("button", { name: "确认调整" })).toBeDisabled();
  expect(dialog.getByText(/已登录设备会按新角色/)).toBeInTheDocument();
  fireEvent.click(dialog.getByRole("button", { name: "取消" })); expect(request).not.toHaveBeenCalled();
});
