import { createVirtualLibraryFrameTiming, virtualLibraryCameraEase } from './virtual-library-render-quality';

describe('virtual library frame timing', () => {
  it('reports sustained 60 fps cadence and frame percentiles without changing resolution', () => {
    const timing = createVirtualLibraryFrameTiming();
    for (let index = 0; index < 46; index++) timing.sample(1000 / 60);
    expect(timing.fps).toBeCloseTo(60);
    expect(timing.p95Ms).toBeCloseTo(1000 / 60);
    expect(timing.p50Ms).toBeCloseTo(1000 / 60);
  });

  it('includes ordinary dropped frames but excludes invalid and idle intervals', () => {
    const timing = createVirtualLibraryFrameTiming();
    for (let index = 0; index < 30; index++) timing.sample(20);
    timing.sample(150);
    expect(timing.fps).toBeCloseTo(1000 * 31 / 750);
    expect(timing.p95Ms).toBe(20);
    timing.resetSamples();
    for (const gap of [3000, Infinity, NaN, 0, -1]) timing.sample(gap);
    for (let index = 0; index < 46; index++) timing.sample(1000 / 60);
    expect(timing.fps).toBeCloseTo(60);
  });

  it('keeps camera interpolation consistent at 30 and 60 fps', () => {
    const at30 = virtualLibraryCameraEase(1000 / 30);
    const at60 = virtualLibraryCameraEase(1000 / 60);
    expect(at30).toBeCloseTo(0.16);
    expect(1 - (1 - at60) ** 2).toBeCloseTo(at30);
    expect(virtualLibraryCameraEase(3000)).toBe(virtualLibraryCameraEase(50));
  });
});
