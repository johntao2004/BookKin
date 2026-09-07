import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { RegisterPage } from "./RegisterPage";
import { api } from "../api/client";
vi.mock('../auth/AuthContext',async importOriginal=>({...await importOriginal<object>(),useAuth:()=>({user:null})}));
beforeEach(()=>vi.restoreAllMocks());
it('does not render a registration form when policy is closed',async()=>{
 vi.spyOn(api,'registrationStatus').mockResolvedValue({registrationEnabled:false});
 render(<TestProviders><RegisterPage /></TestProviders>);
 expect(await screen.findByText('当前未开放注册。')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'注册'})).not.toBeInTheDocument();
});
it('submits member registration only after passwords match',async()=>{
 vi.spyOn(api,'registrationStatus').mockResolvedValue({registrationEnabled:true});
 const submit=vi.spyOn(api,'register').mockResolvedValue({registered:true});
 render(<TestProviders><RegisterPage /></TestProviders>);
 fireEvent.change(await screen.findByLabelText('昵称'),{target:{value:'Reader'}});
 fireEvent.change(screen.getByLabelText('用户名'),{target:{value:'reader'}});
 fireEvent.change(screen.getByLabelText('密码',{exact:true}),{target:{value:'long-password-123'}});
 fireEvent.change(screen.getByLabelText('确认密码',{exact:true}),{target:{value:'mismatch-password'}});
 fireEvent.click(screen.getByRole('button',{name:'注册'}));
 expect(await screen.findByText('两次密码不一致')).toBeInTheDocument();expect(submit).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('确认密码',{exact:true}),{target:{value:'long-password-123'}});
 fireEvent.click(screen.getByRole('button',{name:'注册'}));
 await waitFor(()=>expect(submit).toHaveBeenCalledWith({username:'reader',displayName:'Reader',password:'long-password-123'}));
});
