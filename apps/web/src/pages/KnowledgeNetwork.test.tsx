import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { KnowledgeNetwork } from './KnowledgeNetwork';
const graphState = vi.hoisted(() => ({create: vi.fn(), destroy: vi.fn(), render: vi.fn()}));
vi.mock('@ant-design/graphs', () => ({G6: {Graph: class {
  destroyed = false;
  constructor() { graphState.create(); }
  render() { return graphState.render(); }
  destroy() { this.destroyed = true; graphState.destroy(); }
}}}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 1));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  graphState.create.mockClear(); graphState.destroy.mockClear(); graphState.render.mockReset();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('does not destroy an in-flight renderer or deliver a ready callback after unmount', async () => {
  let finish!: () => void;
  graphState.render.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  const ready = vi.fn();
  const view = render(<StrictMode><KnowledgeNetwork options={{data: {nodes: [{id: 'concept'}]}, onReady: ready}} /></StrictMode>);
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(graphState.create).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(graphState.destroy).not.toHaveBeenCalled();
  await act(async () => { finish(); await Promise.resolve(); });
  expect(graphState.destroy).toHaveBeenCalledTimes(1);
  expect(ready).not.toHaveBeenCalled();
});
it('does not allocate a graph after the page is closed before its first frame', async () => {
  const view = render(<KnowledgeNetwork options={{data: {nodes: [{id: 'concept'}]}}} />);
  view.unmount();
  await act(async () => { vi.runAllTimers(); });
  expect(graphState.create).not.toHaveBeenCalled();
});
