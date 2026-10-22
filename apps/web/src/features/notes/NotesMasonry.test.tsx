import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TestProviders } from "../../test/TestProviders";
import { NotesMasonry } from "./NotesMasonry";

afterEach(() => vi.unstubAllGlobals());

it("continues observing pending cards after asynchronous data refresh and does not replay revealed cards", () => {
  const observers: { callback: IntersectionObserverCallback; observe: ReturnType<typeof vi.fn>; unobserve: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal("IntersectionObserver", class {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
    constructor(callback: IntersectionObserverCallback) { observers.push({ callback, observe: this.observe, unobserve: this.unobserve }); }
  });
  const cards = () => [{ key: "one", content: <article>我的笔记</article> }];
  const view = render(<TestProviders><NotesMasonry label="笔记" items={cards()} /></TestProviders>);
  const tile = screen.getByText("我的笔记").parentElement!;
  expect(tile).toHaveAttribute("data-note-visible", "false");
  view.rerender(<TestProviders><NotesMasonry label="笔记" items={cards()} /></TestProviders>);
  const latest = observers.at(-1)!;
  expect(latest.observe).toHaveBeenCalledWith(tile);
  act(() => latest.callback([{ target: tile, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(tile).toHaveAttribute("data-note-visible", "true");
  expect(latest.unobserve).toHaveBeenCalledWith(tile);
  view.rerender(<TestProviders><NotesMasonry label="笔记" items={cards()} /></TestProviders>);
  expect(observers.at(-1)!.observe).not.toHaveBeenCalled();
});
