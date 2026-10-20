import type { GeometryData, StaticBatchInput } from './staticBatchData';

// 同一时刻仅处理一个批次，使源副本数量受控，并可立即取消。
/** One in-flight batch keeps source copies bounded and cancellation immediate. */
export function requestStaticBatch(worker: Worker, input: StaticBatchInput[], signal: AbortSignal): Promise<GeometryData | null> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError);
      worker.removeEventListener('messageerror', onError); signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => { cleanup(); reject(signal.reason); };
    const onError = () => { cleanup(); reject(new Error('Static batch worker unavailable')); };
    const onMessage = (event: MessageEvent<{geometry?: GeometryData | null; error?: string}>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.geometry ?? null);
    };
    if (signal.aborted) { reject(signal.reason); return; }
    worker.addEventListener('message', onMessage); worker.addEventListener('error', onError);
    worker.addEventListener('messageerror', onError); signal.addEventListener('abort', onAbort, {once: true});
    try {
      // 不要转移源缓冲区：在成功结果挂载前，它们仍归现有场景所有。浏览器原生结构化克隆会持有独立副本。
      // Do not transfer source buffers: they still belong to the live scene until
      // a successful result is attached. Browser-native structured clone owns copies.
      worker.postMessage(input);
    } catch (error) { cleanup(); reject(error); }
  });
}
