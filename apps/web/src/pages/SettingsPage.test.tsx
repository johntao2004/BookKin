import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { TestProviders } from "../test/TestProviders";
import { SettingsPage } from "./SettingsPage";

const authState = vi.hoisted(() => ({ role: "OWNER" as "OWNER" | "ADMIN" | "MEMBER" }));
vi.mock("../auth/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/AuthContext")>();
  return { ...actual, useAuth: () => ({ user: { role: authState.role } }),
    RequireAuth: ({ children, roles }: any) => roles?.includes(authState.role) ? children : <p role="alert">权限不足</p> };
});
vi.mock("./UsersPage", () => ({ UsersPage: () => <p>用户面板</p> }));
vi.mock("./ActiveSessionsPage", () => ({ ActiveSessionsPage: () => <p>会话面板</p> }));
vi.mock("./LoginLogsPage", () => ({ LoginLogsPage: () => <p>登录面板</p> }));
vi.mock("./SecuritySettingsPage", () => ({ SecuritySettingsPage: () => <p>安全面板</p> }));
vi.mock("./FileOperationsPage", () => ({ FileOperationsPage: () => <p>任务面板</p> }));
vi.mock("./RecycleBinPage", () => ({ RecycleBinPage: () => <p>回收站面板</p> }));
vi.mock("./LibraryRootsPage", () => ({ LibraryRootsPage: () => <p>书库面板</p> }));
vi.mock("./ReaderFontsPage", () => ({ ReaderFontsPage: () => <p>字体面板</p> }));
vi.mock("./AiSettingsPage", () => ({ AiSettingsPage: () => <p>AI 面板</p> }));
vi.mock("./MailSettingsPage", () => ({ MailSettingsPage: () => <p>邮件面板</p> }));
vi.mock("./SiteSettingsPage", () => ({ SiteSettingsPage: () => <p>网站面板</p> }));

function History() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output data-testid="destination">{location.pathname}{location.hash}</output><button onClick={() => navigate(-1)}>后退</button></>;
}
function renderSettings(initialPath: string) {
  return render(<TestProviders initialPath={initialPath}><Routes>
    <Route path="/settings" element={<><SettingsPage /><History /></>} />
    <Route path="/profile" element={<History />} /><Route path="/library" element={<History />} />
  </Routes></TestProviders>);
}
beforeEach(() => { authState.role = "OWNER"; });

it("groups settings and mounts only the chosen panel while preserving browser history", async () => {
  renderSettings("/settings#reader-fonts");
  expect(await screen.findByText("字体面板")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "网站与阅读" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByText("书库面板")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "馆藏与文件" }));
  expect(await screen.findByText("书库面板")).toBeInTheDocument();
  expect(screen.getByTestId("destination")).toHaveTextContent("#catalog/library-roots");
  expect(screen.queryByText("字体面板")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("后退"));
  expect(await screen.findByText("字体面板")).toBeInTheDocument();
  expect(screen.getByTestId("destination")).toHaveTextContent("#services/reader-fonts");
});

it("places file tasks and the recycle bin under catalog management", async () => {
  renderSettings("/settings#users/operations");
  expect(await screen.findByText("任务面板")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "馆藏与文件" })).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("tab", { name: "回收站" }));
  expect(await screen.findByText("回收站面板")).toBeInTheDocument();
  expect(screen.queryByText("任务面板")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "用户与权限" }));
  expect(await screen.findByText("用户面板")).toBeInTheDocument();
  const group = screen.getByRole("region", { name: "用户与权限" });
  expect(within(group).getAllByRole("tab").map(tab => tab.textContent)).toEqual(["用户列表", "角色权限"]);
});

it("keeps owner-only services hidden from administrators including direct legacy hashes", async () => {
  const owner = renderSettings("/settings#mail");
  expect(await screen.findByText("邮件面板")).toBeInTheDocument(); owner.unmount();
  authState.role = "ADMIN";
  renderSettings("/settings#services/mail");
  expect(await screen.findByText("403 · 权限受限")).toBeInTheDocument();
  expect(screen.queryByText("邮件面板")).not.toBeInTheDocument();
  expect(screen.queryByText("字体面板")).not.toBeInTheDocument();
});

it("denies members without mounting administrative panels", async () => {
  authState.role = "MEMBER"; renderSettings("/settings#reader-fonts");
  expect(await screen.findByText("403 · 权限受限")).toBeInTheDocument();
  expect(screen.queryByText("字体面板")).not.toBeInTheDocument();
  expect(screen.queryByText("书库面板")).not.toBeInTheDocument();
});

it.each([
  ["#library-roots", "书库面板", "#catalog/library-roots"],
  ["#file-operations", "任务面板", "#catalog/operations"],
  ["#users/operations", "任务面板", "#catalog/operations"],
  ["#reader-fonts", "字体面板", "#services/reader-fonts"],
  ["#personalization", "网站面板", "#services/personalization"],
  ["#ai", "AI 面板", "#services/ai"],
  ["#users", "用户面板", "#users"],
  ["#users/sessions", "会话面板", "#users/sessions"],
  ["#users/logins", "登录面板", "#users/logins"],
  ["#users/security", "安全面板", "#users/security"],
])("retains bookmarked panel %s", async (hash, panel, canonical) => {
  renderSettings(`/settings${hash}`);
  expect(await screen.findByText(panel)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent(canonical));
});

it.each([["#recovery-email", "/profile"], ["#display-books", "/library"]])("preserves legacy account/catalog redirect %s", async (hash, destination) => {
  renderSettings(`/settings${hash}`);
  await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent(destination));
  expect(screen.queryByText("书库面板")).not.toBeInTheDocument();
});
it("opens catalog management by default", async () => {
  renderSettings("/settings");
  expect(await screen.findByText("书库面板")).toBeInTheDocument();
  expect(screen.getAllByRole("tab").slice(0, 5).map(tab => tab.textContent)).toEqual(["馆藏与文件", "用户与权限", "登录与安全", "网站与阅读", "外部服务"]);
});

it("separates security monitoring from user administration and groups external providers", async () => {
  renderSettings("/settings#users/sessions");
  expect(await screen.findByText("会话面板")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "登录与安全" })).toHaveAttribute("aria-selected", "true");
  expect(within(screen.getByRole("region", { name: "登录与安全" })).getAllByRole("tab").map(tab => tab.textContent)).toEqual(["安全策略", "在线会话", "登录日志"]);
  fireEvent.click(screen.getByRole("tab", { name: "外部服务" }));
  expect(await screen.findByText("AI 面板")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "外部服务" })).getAllByRole("tab").map(tab => tab.textContent)).toEqual(["AI 服务", "邮件服务"]);
  expect(screen.queryByText("网站面板")).not.toBeInTheDocument();
});
