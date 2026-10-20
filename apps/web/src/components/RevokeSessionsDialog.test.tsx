// 验证明确确认才撤销会话，取消路径必须没有撤销请求。
// Checks session revocation requires confirmation and cancellation sends no revocation request.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect,it,vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { api } from "../api/client";
import { RevokeSessionsDialog } from "./RevokeSessionsDialog";
it("requires an explicit confirmation and sends nothing when cancelled",async()=>{
 const revoke=vi.spyOn(api,"revokeUserSessions").mockResolvedValue();const close=vi.fn();const done=vi.fn();
 render(<TestProviders><RevokeSessionsDialog target={{id:"member-id",displayName:"成员"}} onClose={close} onRevoked={done}/></TestProviders>);
 expect(revoke).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"取消"}));expect(revoke).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"确认退出全部会话"}));await waitFor(()=>expect(revoke).toHaveBeenCalledWith("member-id"));expect(done).toHaveBeenCalledOnce();revoke.mockRestore();
});
