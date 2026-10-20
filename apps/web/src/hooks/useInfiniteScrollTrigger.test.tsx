// 用可控观察器验证哨兵接近视口时触发加载；真实滚动仍需浏览器验收。
// Uses a controlled observer to check sentinel-triggered loading; real scrolling still needs browser verification.
import { act, render } from "@testing-library/react";
import { useInfiniteScrollTrigger } from "./useInfiniteScrollTrigger";

class IntersectionObserverMock {
  static instance: IntersectionObserverMock | undefined;
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(private readonly callback: IntersectionObserverCallback) {
    IntersectionObserverMock.instance = this;
  }

  intersect() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function Harness({ onLoadMore }: { onLoadMore: () => void }) {
  const { triggerRef } = useInfiniteScrollTrigger({ enabled: true, onLoadMore });
  return <div ref={triggerRef}>加载触发点</div>;
}

describe("useInfiniteScrollTrigger", () => {
  const originalObserver = window.IntersectionObserver;

  beforeEach(() => {
    IntersectionObserverMock.instance = undefined;
    window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalObserver;
  });

  it("loads the next page when the sentinel approaches the viewport", () => {
    const onLoadMore = vi.fn();
    render(<Harness onLoadMore={onLoadMore} />);

    expect(IntersectionObserverMock.instance?.observe).toHaveBeenCalled();
    act(() => IntersectionObserverMock.instance?.intersect());
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
