import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { request } from "../api/client";
import { BookKinThemeProvider } from "../theme/BookKinThemeProvider";
import { PermissionBoundary, usePermissions } from "./permissions";
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: { id: "admin", username: "admin", role: "ADMIN" }, ready: true }) }));
vi.mock("../api/client", () => ({ api: { isDemo: false }, request: vi.fn() }));
function setup(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/articles"]}><BookKinThemeProvider><PermissionBoundary>{children}</PermissionBoundary></BookKinThemeProvider></MemoryRouter></QueryClientProvider>);
  return client;
}
beforeEach(() => { vi.mocked(request).mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("does not mount private content while permission grants are pending", () => {
  vi.mocked(request).mockReturnValue(new Promise(() => undefined));
  const mounted = vi.fn(); function Private() { mounted(); return <p>私有内容</p>; }
  setup(<Private />); expect(mounted).not.toHaveBeenCalled(); expect(screen.getByRole("progressbar")).toBeInTheDocument();
});
it("fails closed when the permission service fails", async () => {
  vi.mocked(request).mockRejectedValue(new Error("offline"));
  const mounted = vi.fn(); function Private() { mounted(); return <p>私有内容</p>; }
  setup(<Private />);
  expect(await screen.findByText("无法确认功能权限。")).toBeInTheDocument(); expect(mounted).not.toHaveBeenCalled();
});
it("keeps the reason visible beyond notification expiry and during automatic recovery", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let resolveRetry!: (value: unknown) => void;
  const retry = new Promise(resolve => { resolveRetry = resolve; });
  vi.mocked(request).mockRejectedValueOnce(new Error("权限服务暂时不可用")).mockReturnValueOnce(retry);
  const mounted = vi.fn(); function Private() { mounted(); return <p>私有内容</p>; }
  setup(<Private />);
  expect(await screen.findByRole("alert")).toHaveTextContent("原因：权限服务暂时不可用");
  await act(async () => { vi.advanceTimersByTime(4_000); });
  expect(screen.getByRole("alert")).toHaveTextContent("每 5 秒自动重试");
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => { vi.advanceTimersByTime(1_000); });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("alert")).toHaveTextContent("原因：权限服务暂时不可用");
  expect(screen.getByRole("button", { name: "正在重试…" })).toBeDisabled();
  expect(mounted).not.toHaveBeenCalled();
  await act(async () => { resolveRetry({ role: "ADMIN", revision: 0, grants: ["articles.view"] }); });
  expect(await screen.findByText("私有内容")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("retains manual retry and enforces the fresh grants instead of bypassing access checks", async () => {
  vi.mocked(request).mockRejectedValueOnce(new Error("连接超时"))
    .mockResolvedValueOnce({ role: "ADMIN", revision: 1, grants: [] });
  const mounted = vi.fn(); function Private() { mounted(); return <p>私有内容</p>; }
  setup(<Private />);
  expect(await screen.findByRole("alert")).toHaveTextContent("连接超时");
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  expect(await screen.findByText("403 · 权限受限")).toBeInTheDocument();
  expect(mounted).not.toHaveBeenCalled();
});
it("unmounts revoked content and clears its cache when current grants change", async () => {
  vi.mocked(request).mockResolvedValue({ role: "ADMIN", revision: 0, grants: ["articles.view"] });
  const unmounted = vi.fn(); function Private() { useEffect(() => () => unmounted(), []); return <p>私有内容</p>; }
  const client = setup(<Private />); expect(await screen.findByText("私有内容")).toBeInTheDocument();
  client.setQueryData(["private-article"], { content: "private" });
  vi.mocked(request).mockResolvedValue({ role: "ADMIN", revision: 1, grants: [] });
  await act(async () => { await client.invalidateQueries({ queryKey: ["role-permissions-current"] }); });
  expect(await screen.findByText("403 · 权限受限")).toBeInTheDocument();
  await waitFor(() => expect(client.getQueryData(["private-article"])).toBeUndefined()); expect(unmounted).toHaveBeenCalledOnce();
});
it("deduplicates effective permission requests across controls and the route guard", async () => {
  vi.mocked(request).mockResolvedValue({ role: "ADMIN", revision: 0, grants: ["articles.view"] });
  function Control() { const access = usePermissions(); return <span>{String(access.can("articles.view"))}</span>; }
  setup(<><Control /><Control /></>);
  expect(await screen.findAllByText("true")).toHaveLength(2); expect(request).toHaveBeenCalledTimes(1);
});
