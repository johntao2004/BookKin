/** Schedule only work that can change the displayed scene. No permanent rAF loop. */
export function createDemandLoop(tick, {
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id),
  hidden = () => typeof document !== 'undefined' && document.hidden,
} = {}) {
  let pending = null, stopped = false;
  const stats = { callbacks: 0, requests: 0 };
  function request() {
    if (stopped || pending !== null || hidden()) return;
    stats.requests++;
    pending = requestFrame(time => {
      pending = null;
      if (stopped || hidden()) return;
      stats.callbacks++;
      if (tick(time)) request();
    });
  }
  return { request, stats, get pending() { return pending !== null; },
    suspend() { if (pending !== null) cancelFrame(pending); pending = null; },
    dispose() { stopped = true; this.suspend(); },
  };
}

/** Yield an actual browser task; a resolved Promise would not permit painting. */
export function yieldToBrowser() {
  if (typeof scheduler !== 'undefined' && scheduler.yield) return scheduler.yield();
  return new Promise(resolve => setTimeout(resolve, 0));
}

/** Adapt pixel cost from sustained *active* frames, without dropping geometry. */
export class AdaptiveResolution {
  constructor({ coarse = false, fallback = false } = {}) {
    this.steps = fallback ? [.45, .6, .8, 1] : [.65, .8, 1, 1.25];
    this.index = fallback ? 1 : coarse ? 2 : 3;
    this.slow = 0; this.fast = 0; this.lastChange = -Infinity;
    this.averageMs = 0; this.samples = 0;
  }
  get ratio() { return this.steps[this.index]; }
  reset() { this.slow = 0; this.fast = 0; this.averageMs = 0; this.samples = 0; }
  sample(milliseconds, time) {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return false;
    this.averageMs = this.samples++ ? this.averageMs * .85 + milliseconds * .15 : milliseconds;
    this.slow = this.averageMs > 30 ? this.slow + 1 : 0;
    this.fast = this.averageMs < 18 ? this.fast + 1 : 0;
    if (time - this.lastChange < 2500) return false;
    if (this.slow >= 18 && this.index > 0) {
      this.index--; this.lastChange = time; this.reset(); return true;
    }
    if (this.fast >= 120 && this.index < this.steps.length - 1) {
      this.index++; this.lastChange = time; this.reset(); return true;
    }
    return false;
  }
}
