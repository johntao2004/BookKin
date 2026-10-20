import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { registerSessionSaver } from "./session-save";
const mock=vi.hoisted(()=>({getSession:vi.fn(),sessionStatus:vi.fn(),logout:vi.fn().mockResolvedValue(undefined)}));
vi.mock("../api/client",()=>({api:{isDemo:false,...mock,replayReadingProgress:vi.fn().mockResolvedValue(undefined)}}));
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();});
it.each([false,true])("saves before logout on maximum duration or revocation (revoked=%s)",async(revoked)=>{
 vi.useFakeTimers();const now=Date.now();
 mock.getSession.mockResolvedValue({id:"reader",username:"reader",role:"MEMBER"});
 mock.sessionStatus.mockImplementation(async()=>({serverTime:Date.now(),expiresAt:now+60000,revocationRequested:revoked}));
 let finish!:()=>void;const save=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));const unregister=registerSessionSaver(save);
 try {
 render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AuthProvider><p>reader</p></AuthProvider></MemoryRouter></QueryClientProvider>);
 await act(async()=>{await Promise.resolve();await Promise.resolve();});
 await act(async()=>{await vi.advanceTimersByTimeAsync(revoked?10:50010);});
 expect(save).toHaveBeenCalled();expect(mock.logout).not.toHaveBeenCalled();
 await act(async()=>{finish();await vi.advanceTimersByTimeAsync(1);});
 expect(mock.logout).toHaveBeenCalledOnce();
 } finally {unregister();}
});

it("does not overflow the browser timer for a 30-day policy",async()=>{
 vi.useFakeTimers();mock.getSession.mockResolvedValue({id:"reader",username:"reader",role:"MEMBER"});
 mock.sessionStatus.mockImplementation(async()=>({serverTime:Date.now(),expiresAt:Date.now()+30*86400000,revocationRequested:false}));
 render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AuthProvider><p>reader</p></AuthProvider></MemoryRouter></QueryClientProvider>);
 await act(async()=>{await Promise.resolve();await Promise.resolve();});await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(mock.logout).not.toHaveBeenCalled();
});
