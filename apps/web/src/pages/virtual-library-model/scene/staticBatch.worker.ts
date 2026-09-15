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
