import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindAnnotationNoteActivation } from "./annotation-activation";

afterEach(() => { window.getSelection()?.removeAllRanges(); document.body.innerHTML = ""; });

function setup(note = "已有笔记") {
  document.body.innerHTML = '<div id="reader"><span data-annotation-id="note"><em>带笔记的文字</em></span><span data-annotation-id="plain">纯高亮</span></div>';
  const root = document.getElementById("reader")!;
  const activate = vi.fn();
  const cleanup = bindAnnotationNoteActivation(root, id => id === "note" ? { id, note } : { id, note: "" }, activate);
  return { root, marker: root.querySelector<HTMLElement>("[data-annotation-id='note']")!, activate, cleanup };
}

describe("annotation note activation", () => {
  it("activates note fragments and plain highlights for editing", () => {
    const { root, marker, activate, cleanup } = setup();
    fireEvent.click(marker.querySelector("em")!);
    expect(activate).toHaveBeenCalledWith("note", expect.any(DOMRect));
    fireEvent.click(root.querySelector("[data-annotation-id='plain']")!);
    expect(activate).toHaveBeenCalledTimes(2);
    cleanup();
    fireEvent.click(marker);
    expect(activate).toHaveBeenCalledTimes(2);
  });

  it("does not open a note while dragging a text selection", () => {
    const { marker, activate, cleanup } = setup();
    const range = document.createRange();
    range.selectNodeContents(marker);
    window.getSelection()!.addRange(range);
    fireEvent.click(marker);
    expect(activate).not.toHaveBeenCalled();
    window.getSelection()!.removeAllRanges();
    fireEvent.click(marker);
    expect(activate).toHaveBeenCalledWith("note", expect.any(DOMRect));
    cleanup();
  });

  it("dismisses on blank content clicks and Escape, including iframe documents", () => {
    const { root, marker, cleanup } = setup();
    cleanup();
    const activate = vi.fn();
    const dismiss = vi.fn();
    const unbind = bindAnnotationNoteActivation(root, id => ({ id, note: "" }), activate, dismiss);
    fireEvent.click(marker);
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent.click(root);
    fireEvent.keyDown(marker, { key: "Escape" });
    expect(dismiss).toHaveBeenCalledTimes(2);
    unbind();
    fireEvent.click(root);
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  it("dismisses on non-bubbling document and nested content scrolls, and removes listeners", () => {
    const { root, marker, cleanup } = setup();
    cleanup();
    const dismiss = vi.fn();
    const unbind = bindAnnotationNoteActivation(document, id => ({ id, note: "" }), vi.fn(), dismiss);
    fireEvent.scroll(document);
    fireEvent.scroll(root);
    fireEvent.scroll(marker);
    expect(dismiss).toHaveBeenCalledTimes(3);
    unbind();
    fireEvent.scroll(document);
    fireEvent.scroll(root);
    expect(dismiss).toHaveBeenCalledTimes(3);
  });

  it("supports Enter and Space without repeated activation on a held key", () => {
    const { marker, activate, cleanup } = setup();
    fireEvent.keyDown(marker, { key: "Enter" });
    fireEvent.keyDown(marker, { key: " " });
    fireEvent.keyDown(marker, { key: "Enter", repeat: true });
    fireEvent.keyDown(marker, { key: "ArrowRight" });
    expect(activate).toHaveBeenCalledTimes(2);
    cleanup();
  });
});
