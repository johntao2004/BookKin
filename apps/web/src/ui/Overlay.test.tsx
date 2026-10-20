// 覆盖页面缩放、底边翻转与滚动跟随，弹出层坐标必须与可视视口一致。
// Covers page scaling, bottom-edge flipping and scroll tracking so portal positions match the viewport.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { Menu, MenuItem } from "./index";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  document.documentElement.style.removeProperty("zoom");
  document.documentElement.style.removeProperty("--app-viewport-width");
  document.documentElement.style.removeProperty("--app-viewport-height");
});

it("positions a portalled menu in logical coordinates when the page is enlarged", () => {
  document.documentElement.style.zoom = "1.25";
  const anchor = document.createElement("button");
  document.body.append(anchor);
  vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({ left: 500, top: 100, width: 50, height: 50 } as DOMRect);
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("bk-overlay") ? { width: 250, height: 125 } as DOMRect : original.call(this);
  });
  const { unmount } = render(<TestProviders><Menu open anchorEl={anchor}><MenuItem>编辑元信息</MenuItem></Menu></TestProviders>);
  const menu = screen.getByRole("menu");
  expect(menu.style.left).toBe("240px");
  expect(menu.style.top).toBe("128px");
  unmount();
  anchor.remove();
});

it.each([
  ["phone", 320, 568, 1],
  ["short landscape", 844, 390, 1],
  ["tablet portrait", 768, 1024, 1],
  ["tablet landscape", 1024, 768, 1],
  ["4K ordinary-page scale", 3840, 2160, 1.25],
  ["5K ordinary-page scale", 5120, 2880, 1.4167],
])("keeps a portalled menu inside the %s viewport", async (_label, viewportWidth, viewportHeight, scale) => {
  vi.stubGlobal("innerWidth", viewportWidth);
  vi.stubGlobal("innerHeight", viewportHeight);
  vi.stubGlobal("visualViewport", {
    width: viewportWidth,
    height: viewportHeight,
    offsetLeft: 0,
    offsetTop: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  document.documentElement.style.zoom = String(scale);
  document.documentElement.style.setProperty("--app-viewport-width", `${viewportWidth / scale}px`);
  document.documentElement.style.setProperty("--app-viewport-height", `${viewportHeight / scale}px`);

  const anchor = document.createElement("button");
  document.body.append(anchor);
  vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
    left: viewportWidth - 40,
    top: viewportHeight - 40,
    right: viewportWidth,
    bottom: viewportHeight,
    width: 40,
    height: 40,
  } as DOMRect);
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("bk-overlay")
      ? { width: 200 * scale, height: 100 * scale } as DOMRect
      : original.call(this);
  });

  const { unmount } = render(<TestProviders><Menu open anchorEl={anchor}><MenuItem>编辑元信息</MenuItem></Menu></TestProviders>);
  const menu = screen.getByRole("menu");
  await waitFor(() => expect(menu.style.left).not.toBe(""));

  const logicalWidth = viewportWidth / scale;
  const logicalHeight = viewportHeight / scale;
  const left = parseFloat(menu.style.left);
  const top = parseFloat(menu.style.top);
  expect(left).toBeGreaterThanOrEqual(8);
  expect(left + 200).toBeLessThanOrEqual(logicalWidth - 8 + 0.01);
  expect(top).toBeGreaterThanOrEqual(8);
  expect(top + 100).toBeLessThanOrEqual(logicalHeight - 8 + 0.01);
  expect(parseFloat(menu.style.maxWidth)).toBeCloseTo(logicalWidth - 16, 4);
  expect(parseFloat(menu.style.maxHeight)).toBeCloseTo(logicalHeight - 16, 4);

  unmount();
  anchor.remove();
});

it("opens above a bottom-edge anchor and tracks scrolling without leaving the viewport", async () => {
  const anchor = document.createElement('button');
  document.body.append(anchor);
  let bottom = 740;
  vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => ({ top: bottom - 40, bottom, left: 800, right: 840, width: 40, height: 40 } as DOMRect));
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('bk-overlay') ? { width: 220, height: 230 } as DOMRect : original.call(this);
  });
  const close = vi.fn();
  const { unmount } = render(<TestProviders><Menu open anchorEl={anchor} onClose={close}><MenuItem>编辑元信息</MenuItem></Menu></TestProviders>);
  const menu = screen.getByRole('menu');
  await waitFor(() => expect(parseFloat(menu.style.top)).toBeLessThan(bottom - 230));
  expect(parseFloat(menu.style.left) + 220).toBeLessThanOrEqual(window.innerWidth);
  const old = menu.style.top;
  bottom = 400;
  fireEvent.scroll(window);
  await waitFor(() => expect(menu.style.top).not.toBe(old));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalled();
  unmount(); anchor.remove();
});
