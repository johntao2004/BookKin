// 在独立 Worker 烘焙静态批次，只转移新生成缓冲区并把失败返回调用方。
// Bakes static batches in a worker, transferring only generated buffers and reporting errors to the caller.
import { bakeStaticBatch, type StaticBatchInput } from './staticBatchData';

self.onmessage = (event: MessageEvent<StaticBatchInput[]>) => {
  try {
    const geometry = bakeStaticBatch(event.data);
    const buffers = geometry ? [...Object.values(geometry.attributes), ...(geometry.index ? [geometry.index] : [])]
      .map(attribute => attribute.array.buffer as ArrayBuffer) : [];
    self.postMessage({geometry}, {transfer: [...new Set(buffers)]});
  } catch (error) {
    self.postMessage({error: error instanceof Error ? error.message : 'Static batch worker failed'});
  }
};
