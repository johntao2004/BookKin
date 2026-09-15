import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { passwordRequirements } from "./password-policy";
import { ChangePasswordPage } from "../pages/ChangePasswordPage";
import { PasswordPolicySettings } from "../pages/PasswordPolicySettings";
import { TestProviders } from "../test/TestProviders";
import { api } from "../api/client";
const change=vi.fn();
vi.mock("./AuthContext", async original=>({...await original<object>(),useAuth:()=>({user:{role:"OWNER"},changePassword:change})}));
const strict={minLength:12,requireUppercase:true,requireLowercase:true,requireDigit:true,requireSpecial:true};
afterEach(()=>{vi.restoreAllMocks();change.mockReset();});
it("checks enabled rules consistently including ASCII symbols",()=>{
 expect(passwordRequirements(strict,"Strong-Password1!").every(r=>r.met)).toBe(true);
 expect(passwordRequirements(strict,"aaaaaaaaaaaa").filter(r=>!r.met)).toHaveLength(3);
 expect(passwordRequirements(strict,"A1中文中文中文中文中文a").at(-1)?.met).toBe(false);
});
it("displays rules before submission and rejects weak passwords without native popup",async()=>{
 vi.spyOn(api,"passwordPolicy").mockResolvedValue(strict);
 render(<TestProviders><ChangePasswordPage /></TestProviders>);
 expect(await screen.findByText("长度为 12–200 个字符")).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText("新密码"),{target:{value:"abcdef"}});
 fireEvent.change(screen.getByLabelText("确认新密码"),{target:{value:"abcdef"}});
 expect(screen.getByText("未满足：包含大写字母 A–Z")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"保存密码"}));
 expect(change).not.toHaveBeenCalled();
 expect(screen.getByLabelText("新密码").closest("form")).toHaveAttribute("novalidate");
});
it("saves a scoped policy with length and complexity flags",async()=>{
 vi.spyOn(api,"passwordPolicy").mockResolvedValue(strict);
 const save=vi.spyOn(api,"savePasswordPolicy").mockResolvedValue({...strict,minLength:16});
 render(<TestProviders><PasswordPolicySettings /></TestProviders>);
 fireEvent.change(await screen.findByLabelText("密码最小长度"),{target:{value:"16"}});
 fireEvent.click(screen.getByRole("switch",{name:"要求数字"}));
 fireEvent.click(screen.getByRole("button",{name:"保存密码规则"}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith({...strict,minLength:16,requireDigit:false}));
});
