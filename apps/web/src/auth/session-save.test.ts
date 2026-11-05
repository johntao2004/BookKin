// 覆盖用户分区、失败保留、退出等待和串行写入，防止跨用户重放或旧响应覆盖新进度。
// Covers user partitioning, failure retention, exit flushing and serialized writes against cross-user replay or stale progress.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { persistPosition, replayPositions, setPersistenceUser, trackSessionSave, registerSessionSaver, prepareSessionExit } from "./session-save";
beforeEach(()=>{localStorage.clear();setPersistenceUser("reader-a");});
afterEach(()=>vi.restoreAllMocks());
it("retains failed progress for the same user and never replays it for another user", async()=>{
 await expect(persistPosition("book","page-2",0.2,()=>Promise.reject(new Error("offline")))).rejects.toThrow();
 const send=vi.fn().mockResolvedValue({});setPersistenceUser("reader-b");await replayPositions(send);expect(send).not.toHaveBeenCalled();
 setPersistenceUser("reader-a");await replayPositions(send);expect(send).toHaveBeenCalledWith(expect.objectContaining({bookId:"book",locator:"page-2",progress:0.2}));
 expect(localStorage.getItem("silvae-pending-progress:reader-a")).toBe("{}");
});
it("waits for reader save hooks and outstanding writes before exit",async()=>{
 let finish!:()=>void;let done=false;
 const unregister=registerSessionSaver(()=>trackSessionSave(new Promise<void>(resolve=>{finish=resolve;})));
 const saving=prepareSessionExit().then(()=>{done=true;});await Promise.resolve();expect(done).toBe(false);finish();await saving;expect(done).toBe(true);unregister();
});
it("serializes position writes so an older response cannot overwrite newer progress",async()=>{
 const order:string[]=[];
 const first=persistPosition("book","old",0.1,async()=>{order.push("old");});
 const second=persistPosition("book","new",0.2,async()=>{order.push("new");});
 await Promise.all([first,second]);expect(order).toEqual(["old","new"]);expect(localStorage.getItem("silvae-pending-progress:reader-a")).toBe("{}");
});
it("still sends an online position when the local checkpoint exceeds storage quota",async()=>{
 vi.spyOn(localStorage,"setItem").mockImplementation(()=>{throw new DOMException("quota exceeded","QuotaExceededError");});
 const response={saved:true};const send=vi.fn().mockResolvedValue(response);
 await expect(persistPosition("book","latest",0.8,send)).resolves.toBe(response);
 expect(send).toHaveBeenCalledOnce();
});
it("keeps an acknowledged server save successful when clearing its checkpoint fails",async()=>{
 const response={saved:true};const send=vi.fn().mockResolvedValue(response);
 const saving=persistPosition("book","latest",0.8,send);
 vi.spyOn(localStorage,"setItem").mockImplementation(()=>{throw new DOMException("quota exceeded","QuotaExceededError");});
 await expect(saving).resolves.toBe(response);
 expect(send).toHaveBeenCalledOnce();
});
