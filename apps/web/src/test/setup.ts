import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: async () => undefined },
  configurable: true,
});

// Ant Design observes component bounds in the browser. jsdom does not expose
// ResizeObserver, so provide the smallest deterministic test double.
class TestResizeObserver {
  observe() { return undefined; }
  unobserve() { return undefined; }
  disconnect() { return undefined; }
}

Object.defineProperty(window, "ResizeObserver", { writable: true, configurable: true, value: TestResizeObserver });
(globalThis as unknown as { ResizeObserver?: typeof TestResizeObserver }).ResizeObserver = TestResizeObserver;
