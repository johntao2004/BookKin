import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useLocation, useNavigate } from "react-router-dom";
import { TestProviders } from "../test/TestProviders";
import { SettingsPage } from "./SettingsPage";
vi.mock('../auth/AuthContext', async importOriginal => ({ ...await importOriginal<object>(), useAuth: () => ({ user: { role: 'OWNER' } }), RequireAuth: ({children}: any) => children }));
vi.mock('./LibraryRootsPage', () => ({ LibraryRootsPage: () => <p>书库面板</p> }));
vi.mock('./UsersPage', () => ({ UsersPage: () => <p>用户面板</p> }));
vi.mock('./ReaderFontsPage', () => ({ ReaderFontsPage: () => <p>字体面板</p> }));
function History() { const l = useLocation(); const n = useNavigate(); return <><output>{l.hash}</output><button onClick={() => n(-1)}>后退</button></>; }
it('restores anchored tabs and supports browser history', async () => {
 render(<TestProviders initialPath='/settings#reader-fonts'><SettingsPage /><History /></TestProviders>);
 expect(await screen.findByText('字体面板')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('tab', {name:'书库状态'}));
 expect(await screen.findByText('书库面板')).toBeInTheDocument();
 expect(screen.getByText('#library-roots')).toBeInTheDocument();
 fireEvent.click(screen.getByText('后退'));
 await waitFor(() => expect(screen.getByText('#reader-fonts')).toBeInTheDocument());
 expect(await screen.findByText('字体面板')).toBeInTheDocument();
});
