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
  it("activates a nested note fragment but leaves plain highlights alone", () => {
    const { root, marker, activate, cleanup } = setup();
    fireEvent.click(marker.querySelector("em")!);
    expect(activate).toHaveBeenCalledExactlyOnceWith("note");
    fireEvent.click(root.querySelector("[data-annotation-id='plain']")!);
    expect(activate).toHaveBeenCalledTimes(1);
    cleanup();
    fireEvent.click(marker);
    expect(activate).toHaveBeenCalledTimes(1);
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
    expect(activate).toHaveBeenCalledExactlyOnceWith("note");
    cleanup();
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
