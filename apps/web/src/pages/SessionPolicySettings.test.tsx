// 覆盖时长输入边界、主人保存和管理员只读，客户端输入校验不替代服务端限制。
// Covers duration bounds, owner save and administrator read-only state without replacing server validation.
import { fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { api } from "../api/client";
import { SessionPolicySettings } from "./SessionPolicySettings";
afterEach(()=>vi.restoreAllMocks());
function identity(role:string){sessionStorage.setItem("bookkin-demo-session",JSON.stringify({id:"manager",username:"manager",role,displayName:"管理者",mustChangePassword:false}));}
it("validates maximum duration and persists an owner change",async()=>{
 identity("OWNER");vi.spyOn(api,"sessionPolicy").mockResolvedValue({maxMinutes:1440});const save=vi.spyOn(api,"saveSessionPolicy").mockResolvedValue({maxMinutes:60});
 render(<TestProviders><SessionPolicySettings/></TestProviders>);
 const field=await screen.findByRole("spinbutton",{name:"最长登录时长（分钟）"});
 fireEvent.change(field,{target:{value:"1"}});fireEvent.click(screen.getByRole("button",{name:"保存会话设置"}));expect(save).not.toHaveBeenCalled();
 fireEvent.change(field,{target:{value:"60"}});fireEvent.click(screen.getByRole("button",{name:"保存会话设置"}));await waitFor(()=>expect(save).toHaveBeenCalledWith(60));
});
it("keeps administrator policy controls read-only",async()=>{
 identity("ADMIN");vi.spyOn(api,"sessionPolicy").mockResolvedValue({maxMinutes:1440});
 render(<TestProviders><SessionPolicySettings/></TestProviders>);
 expect(await screen.findByRole("spinbutton",{name:"最长登录时长（分钟）"})).toBeDisabled();expect(screen.getByRole("button",{name:"保存会话设置"})).toBeDisabled();
});
