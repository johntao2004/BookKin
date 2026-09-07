import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useLocation, useNavigate } from "react-router-dom";
import { TestProviders } from "../test/TestProviders";
import { UserManagementPage } from "./UserManagementPage";
vi.mock('./UsersPage', () => ({UsersPage: () => <p>账户表格</p>}));
vi.mock('./FileOperationsPage', () => ({FileOperationsPage: () => <p>操作记录</p>}));
vi.mock('./LoginLogsPage', () => ({LoginLogsPage: () => <p>登录记录</p>}));
function History() { const location = useLocation(); const navigate = useNavigate(); return <><output>{location.hash}</output><button onClick={() => navigate(-1)}>后退</button></>; }
it('restores login anchors and preserves tab history', async () => {
 render(<TestProviders initialPath='/admin/users#logins'><UserManagementPage /><History /></TestProviders>);
 expect(await screen.findByText('登录记录')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('tab',{name:'操作日志'}));
 expect(await screen.findByText('操作记录')).toBeInTheDocument();
 expect(screen.getByText('#operations')).toBeInTheDocument();
 fireEvent.click(screen.getByText('后退'));
 await waitFor(() => expect(screen.getByText('#logins')).toBeInTheDocument());
 expect(await screen.findByText('登录记录')).toBeInTheDocument();
});
