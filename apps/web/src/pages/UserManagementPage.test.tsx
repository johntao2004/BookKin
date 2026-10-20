// 验证登录日志锚点恢复与页签历史，避免内部切换破坏浏览器导航。
// Checks login-log anchor restoration and tab history without breaking browser navigation.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { TestProviders } from "../test/TestProviders";
import { EmbeddedSettingsContext } from "../components/PageHeader";
import { UserManagementPage } from "./UserManagementPage";
vi.mock('./UsersPage', () => ({UsersPage: () => <p>账户表格</p>}));
vi.mock('./FileOperationsPage', () => ({FileOperationsPage: () => <p>操作记录</p>}));
vi.mock('./LoginLogsPage', () => ({LoginLogsPage: () => <p>登录记录</p>}));
function History() { const location = useLocation(); const navigate = useNavigate(); return <><output>{location.hash}</output><button onClick={() => navigate(-1)}>后退</button></>; }
it('restores login anchors and preserves tab history', async () => {
 render(<TestProviders initialPath='/settings#users/logins'><EmbeddedSettingsContext.Provider value><UserManagementPage /></EmbeddedSettingsContext.Provider><History /></TestProviders>);
 expect(await screen.findByText('登录记录')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('tab',{name:'操作日志'}));
 expect(await screen.findByText('操作记录')).toBeInTheDocument();
 expect(screen.getByText('#users/operations')).toBeInTheDocument();
 fireEvent.click(screen.getByText('后退'));
 await waitFor(() => expect(screen.getByText('#users/logins')).toBeInTheDocument());
 expect(await screen.findByText('登录记录')).toBeInTheDocument();
});

it.each([["", "#users"], ["#users", "#users"], ["#operations", "#users/operations"], ["#logins", "#users/logins"], ["#security", "#users/security"]])("redirects the legacy user-management route %s", async (hash, destination) => {
 render(<TestProviders initialPath={`/admin/users${hash}`}><Routes><Route path="/admin/users" element={<UserManagementPage />} /><Route path="/settings" element={<History />} /></Routes></TestProviders>);
 expect(await screen.findByText(destination)).toBeInTheDocument();
});
