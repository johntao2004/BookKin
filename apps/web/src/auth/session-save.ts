import { randomId } from "../utils/random-id";
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
