// 覆盖用户分区、失败保留、退出等待和串行写入，防止跨用户重放或旧响应覆盖新进度。
// Covers user partitioning, failure retention, exit flushing and serialized writes against cross-user replay or stale progress.
import { beforeEach, expect, it, vi } from "vitest";
import { persistPosition, replayPositions, setPersistenceUser, trackSessionSave, registerSessionSaver, prepareSessionExit } from "./session-save";
beforeEach(()=>{localStorage.clear();setPersistenceUser("reader-a");});
it("retains failed progress for the same user and never replays it for another user", async()=>{
 await expect(persistPosition("book","page-2",0.2,()=>Promise.reject(new Error("offline")))).rejects.toThrow();
 const send=vi.fn().mockResolvedValue({});setPersistenceUser("reader-b");await replayPositions(send);expect(send).not.toHaveBeenCalled();
 setPersistenceUser("reader-a");await replayPositions(send);expect(send).toHaveBeenCalledWith(expect.objectContaining({bookId:"book",locator:"page-2",progress:0.2}));
 expect(localStorage.getItem("bookkin-pending-progress:reader-a")).toBe("{}");
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
 await Promise.all([first,second]);expect(order).toEqual(["old","new"]);expect(localStorage.getItem("bookkin-pending-progress:reader-a")).toBe("{}");
});
