import { randomId } from "../utils/random-id";
// 保存钩子在凭据有效时执行，并保留按用户隔离的持久检查点供离线或过期后恢复。
// Save hooks run while credentials are still valid. Progress also has a per-user
// durable checkpoint so an offline/expired session can recover on the next login.
const savers = new Set<() => void | Promise<unknown>>();
const pending = new Set<Promise<unknown>>();
export function registerSessionSaver(save: () => void | Promise<unknown>) { savers.add(save); return () => { savers.delete(save); }; }
export function trackSessionSave<T>(promise: Promise<T>): Promise<T> {
  pending.add(promise);
  void promise.finally(() => pending.delete(promise)).catch(() => undefined);
  return promise;
}
// 单个保存失败不阻断其余保存；调用方可另外限制等待时长。
// One save failure does not block other savers; callers may impose a separate wait deadline.
export async function prepareSessionExit() {
  await Promise.allSettled([...savers].map(save => Promise.resolve().then(save)));
  await Promise.allSettled([...pending]);
}
let persistenceUser: string | null = null;
let chain: Promise<unknown> = Promise.resolve();
type Checkpoint = { bookId: string; locator: string; progress: number; revision: string };
function key(user: string) { return `bookkin-pending-progress:${user}`; }
function read(user: string): Record<string, Checkpoint> { try { return JSON.parse(localStorage.getItem(key(user)) ?? "{}"); } catch { return {}; } }
export function setPersistenceUser(user: string | null) { persistenceUser=user; }
export function pendingPosition(bookId: string) { return persistenceUser ? read(persistenceUser)[bookId] : undefined; }
// 先保存按用户分区的检查点，再串行发送；仅匹配当前修订号的成功响应才能清除检查点。
// Store a per-user checkpoint before serialized sending; only an acknowledgement for the current revision clears it.
export function persistPosition<T>(bookId: string, locator: string, progress: number, send: () => Promise<T>): Promise<T> {
  const user=persistenceUser;
  const entry={bookId,locator,progress,revision:randomId()};
  if(user) localStorage.setItem(key(user),JSON.stringify({...read(user),[bookId]:entry}));
  const task=chain.catch(()=>undefined).then(()=>{ if(user && persistenceUser!==user) throw new Error("登录用户已变化，进度保留待原用户登录后同步。"); return send(); }).then(result=>{
    if(user) { const records=read(user); if(records[bookId]?.revision===entry.revision) { delete records[bookId]; localStorage.setItem(key(user),JSON.stringify(records)); } }
    return result;
  });
  chain=task;
  return trackSessionSave(task);
}
export async function replayPositions(send: (entry: Checkpoint) => Promise<unknown>) {
  const user=persistenceUser;
  if(!user) return;
  for(const entry of Object.values(read(user))) {
    if(persistenceUser!==user) break;
    await persistPosition(entry.bookId,entry.locator,entry.progress,()=>send(entry));
  }
}
