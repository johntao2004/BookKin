import { fireEvent,render,screen,within } from "@testing-library/react";
import { expect,it,vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { api } from "../api/client";
import { ActiveSessionsPage } from "./ActiveSessionsPage";
it("lists each active session without exposing its cookie identifier",async()=>{
 sessionStorage.setItem("bookkin-demo-session",JSON.stringify({id:"owner",role:"OWNER",username:"owner",displayName:"主人",mustChangePassword:false}));
 const sessions=vi.spyOn(api,"activeSessions").mockResolvedValue([{id:"internal-id",userId:"reader",username:"reader",displayName:"成员",role:"MEMBER",createdAt:"2026-10-20T00:00:00Z",lastAccessAt:"2026-10-20T00:01:00Z",expiresAt:"2026-10-21T00:00:00Z",current:false,ending:false}]);
 const revoke=vi.spyOn(api,"revokeUserSessions").mockResolvedValue();
 render(<TestProviders><ActiveSessionsPage/></TestProviders>);
 const table=await screen.findByRole("table",{name:"在线会话"});expect(await within(table).findByText("成员（reader）")).toBeInTheDocument();expect(table).not.toHaveTextContent("internal-id");
 fireEvent.click(within(table).getByRole("button",{name:"退出全部会话"}));expect(await screen.findByText(/确认退出“成员”的全部会话/)).toBeInTheDocument();expect(revoke).not.toHaveBeenCalled();
 sessions.mockRestore();revoke.mockRestore();
});
