// 只记录活动帧耗时，不再通过动态降低分辨率换取帧率。
// Measure active frames without dynamically reducing rendering resolution.
export function createVirtualLibraryFrameTiming() {
  let elapsed = 0;
  let samples: number[] = [];
  let fps = 0, p50Ms = 0, p95Ms = 0;
  return {
    sample(milliseconds: number) {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0 || milliseconds > 1000) {
        elapsed = 0; samples = []; return;
      }
      samples.push(milliseconds);
      elapsed += milliseconds;
      if (elapsed < 750 || samples.length < 8) return;
      fps = 1000 * samples.length / elapsed;
      const sorted = samples.sort((a, b) => a - b);
      p50Ms = sorted[Math.ceil(sorted.length * 0.5) - 1];
      p95Ms = sorted[Math.ceil(sorted.length * 0.95) - 1];
      elapsed = 0; samples = [];
    },
    resetSamples() { elapsed = 0; samples = []; },
    get fps() { return fps; },
    get p50Ms() { return p50Ms; },
    get p95Ms() { return p95Ms; },
  };
}

// 相同墙钟时间内保持原 30 帧插值的移动速度。
// Preserve the original 30 Hz easing duration at variable frame rates.
export function virtualLibraryCameraEase(milliseconds: number) {
  return 1 - Math.pow(0.84, Math.min(50, Math.max(0, milliseconds)) / (1000 / 30));
}
