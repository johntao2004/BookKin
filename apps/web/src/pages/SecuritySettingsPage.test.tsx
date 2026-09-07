import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { api } from "../api/client";
import { SecuritySettingsPage } from "./SecuritySettingsPage";
let role="OWNER";
vi.mock('../auth/AuthContext',async importOriginal=>({...await importOriginal<object>(),useAuth:()=>({user:{role}})}));
beforeEach(()=>{role="OWNER";vi.restoreAllMocks();});
it('saves registration policy and displays the persisted response',async()=>{
 vi.spyOn(api,'securitySettings').mockResolvedValue({registrationEnabled:false});
 const save=vi.spyOn(api,'updateSecuritySettings').mockResolvedValue({registrationEnabled:true});
 render(<TestProviders><SecuritySettingsPage /></TestProviders>);
 const toggle=await screen.findByRole('switch',{name:'开放注册'});
 fireEvent.click(toggle);
 await waitFor(()=>expect(save).toHaveBeenCalledWith(true));
 await waitFor(()=>expect(toggle).toBeChecked());
});
it('makes policy read-only for administrators',async()=>{
 role="ADMIN";vi.spyOn(api,'securitySettings').mockResolvedValue({registrationEnabled:false});
 render(<TestProviders><SecuritySettingsPage /></TestProviders>);
 expect(await screen.findByRole('switch',{name:'开放注册'})).toBeDisabled();
});
