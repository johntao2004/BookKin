import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { MailSettingsPage } from "./MailSettingsPage";
import { RecoveryPage } from "./RecoveryPage";
afterEach(()=>vi.restoreAllMocks());
it("saves SMTP before enabling test delivery and preserves a saved secret", async()=>{
 const settings={enabled:true,host:"smtp.example.com",port:587,security:"STARTTLS",username:"library",password:"",sender:"library@example.com",publicUrl:"https://books.example.com",passwordConfigured:true};
 vi.spyOn(api,"mailSettings").mockResolvedValue(settings);
 const save=vi.spyOn(api,"saveMailSettings").mockResolvedValue(settings);
 const send=vi.spyOn(api,"testMail").mockResolvedValue();
 render(<TestProviders><MailSettingsPage /></TestProviders>);
 fireEvent.change(await screen.findByLabelText("SMTP 主机"),{target:{value:"smtp2.example.com"}});
 expect(screen.getByRole("button",{name:"发送测试邮件"})).toBeDisabled();
 fireEvent.click(screen.getByRole("button",{name:"保存邮件配置"}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({host:"smtp2.example.com",password:""})));
 await waitFor(()=>expect(screen.getByRole("button",{name:"发送测试邮件"})).toBeEnabled());
 fireEvent.change(screen.getByLabelText("测试收件邮箱"),{target:{value:"qa@example.com"}});
 fireEvent.click(screen.getByRole("button",{name:"发送测试邮件"}));
 await waitFor(()=>expect(send).toHaveBeenCalledWith("qa@example.com"));
});
it("does not consume verification links before explicit confirmation",async()=>{
 const verify=vi.spyOn(api,"verifyRecoveryEmail").mockResolvedValue();
 const token="a".repeat(43);
 render(<TestProviders initialPath={'/recover#bind='+token}><RecoveryPage /></TestProviders>);
 expect(verify).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"确认绑定邮箱"}));
 await waitFor(()=>expect(verify).toHaveBeenCalledWith(token));
});
it("refuses mismatched passwords without sending a reset request",async()=>{
 const reset=vi.spyOn(api,"resetPassword").mockResolvedValue();
 render(<TestProviders initialPath={'/recover#reset='+'a'.repeat(43)}><RecoveryPage /></TestProviders>);
 fireEvent.change(screen.getByLabelText("新密码"),{target:{value:"A-valid-password-1"}});
 fireEvent.change(screen.getByLabelText("确认新密码"),{target:{value:"A-valid-password-2"}});
 fireEvent.click(screen.getByRole("button",{name:"重置密码"}));
 expect(reset).not.toHaveBeenCalled();
});
