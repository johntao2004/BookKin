import { createVirtualLibraryGpuTiming } from './virtual-library-gpu-timing';

it('polls completed GPU queries without blocking and releases pending queries on departure', () => {
  const ext = {TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2};
  const gl = {getExtension: () => ext, getParameter: () => false,
    createQuery: vi.fn(() => ({})), beginQuery: vi.fn(), endQuery: vi.fn(), deleteQuery: vi.fn(),
    QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4,
    getQueryParameter: vi.fn((_query, key) => key === 3 ? true : 12_500_000)};
  const timing = createVirtualLibraryGpuTiming(gl as unknown as WebGL2RenderingContext);
  timing.begin(); timing.end();
  timing.begin();
  expect(timing.milliseconds).toBe(12.5);
  expect(gl.deleteQuery).toHaveBeenCalledTimes(1);
  timing.dispose(); timing.dispose();
  expect(gl.deleteQuery).toHaveBeenCalledTimes(2);
  expect(gl.endQuery).toHaveBeenCalledTimes(2);
});

it('keeps rendering possible when GPU timers are unavailable', () => {
  const timing = createVirtualLibraryGpuTiming({getExtension: () => null} as unknown as WebGL2RenderingContext);
  timing.begin(); timing.end(); timing.dispose();
  expect(timing.milliseconds).toBeNull();
});
