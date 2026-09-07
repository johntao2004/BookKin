import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { Menu, MenuItem } from "./index";

afterEach(() => vi.restoreAllMocks());
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
