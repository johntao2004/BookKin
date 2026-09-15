import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { ProfilePage } from "./ProfilePage";
const updateProfile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../auth/AuthContext', async importOriginal => ({ ...await importOriginal<object>(), useAuth: () => ({ user: {username:'member', displayName:'成员', role:'MEMBER'}, updateProfile }) }));
vi.mock('./RecoveryEmailPage', () => ({RecoveryEmailPage: () => <p>邮箱区域</p>}));
vi.mock('./ChangePasswordPage', () => ({ChangePasswordPage: () => <p>密码区域</p>}));
it('saves account fields separately and clears the confirmation password', async () => {
 render(<TestProviders><ProfilePage /></TestProviders>);
 fireEvent.change(screen.getByLabelText(/^用户名/), {target:{value:'renamed'}});
 fireEvent.change(screen.getByLabelText(/^账户名字/), {target:{value:'新名字'}});
 fireEvent.change(screen.getByLabelText(/^当前密码/), {target:{value:'confirmation'}});
 fireEvent.click(screen.getByRole('button',{name:'保存账户资料'}));
 await waitFor(()=>expect(updateProfile).toHaveBeenCalledWith({username:'renamed',displayName:'新名字',currentPassword:'confirmation'}));
 expect(await screen.findByText('账户资料已保存。')).toBeInTheDocument();
 expect(screen.getByLabelText(/^当前密码/)).toHaveValue('');
});
