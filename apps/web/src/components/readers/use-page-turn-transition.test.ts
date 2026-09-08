import { describe, expect, it } from "vitest";
import { tokens } from "../../theme/generated-tokens";
import {
  pageCurlShadeKeyframes,
  pageTurnKeyframes,
  pageTurnShadeKeyframes,
  resolvePageSurfaceBackground,
} from "./use-page-turn-transition";

describe("pageTurnKeyframes", () => {
  it("folds the current page to a narrow paper edge and opens the next page from the other spine", () => {
    const exiting = pageTurnKeyframes("NEXT", "EXIT");
    const entering = pageTurnKeyframes("NEXT", "ENTER");

    expect(exiting[0]).toMatchObject({ transformOrigin: "left center", opacity: 1 });
    expect(exiting.at(-1)).toMatchObject({
      transform: expect.stringContaining("translateX(-1.8%) rotateY(-88deg)"),
      transformOrigin: "left center",
      opacity: 0.32,
      clipPath: expect.stringContaining("96.5% 98.5%"),
    });
    expect(entering[0]).toMatchObject({
      transform: expect.stringContaining("translateX(1.8%) rotateY(88deg)"),
      transformOrigin: "right center",
      opacity: 0.32,
    });
    expect(entering.at(-1)).toMatchObject({ transformOrigin: "right center", opacity: 1 });
  });

  it("reverses the spine and rotation when returning to the previous page", () => {
    const exiting = pageTurnKeyframes("PREVIOUS", "EXIT");
    const entering = pageTurnKeyframes("PREVIOUS", "ENTER");

    expect(exiting.at(-1)).toMatchObject({
      transform: expect.stringContaining("translateX(1.8%) rotateY(88deg)"),
      transformOrigin: "right center",
    });
    expect(entering[0]).toMatchObject({
      transform: expect.stringContaining("translateX(-1.8%) rotateY(-88deg)"),
      transformOrigin: "left center",
    });
  });

  it("moves the fold shadow from the outer edge toward the spine", () => {
    expect(pageTurnShadeKeyframes("NEXT", "EXIT")).toEqual([
      { opacity: 0, transform: "scaleX(1)", backgroundPosition: "100% 0" },
      { opacity: 0.26, transform: "scaleX(1)", backgroundPosition: "50% 0", offset: 0.38 },
      { opacity: 0.82, transform: "scaleX(1)", backgroundPosition: "0% 0" },
    ]);
    expect(pageTurnShadeKeyframes("PREVIOUS", "EXIT")[0]).toMatchObject({
      transform: "scaleX(-1)",
      backgroundPosition: "0% 0",
    });
  });

  it("keeps the cast shadow moving across the revealed page during a curl", () => {
    const next = pageCurlShadeKeyframes("NEXT");
    const previous = pageCurlShadeKeyframes("PREVIOUS");

    expect(next[0]).toMatchObject({ opacity: 0, backgroundPosition: "100% 0" });
    expect(next[2]).toMatchObject({ opacity: 0.46, backgroundPosition: "48% 0" });
    expect(next.at(-1)).toMatchObject({ opacity: 0, backgroundPosition: "0% 0" });
    expect(previous[0]).toMatchObject({ transform: "scaleX(-1)", backgroundPosition: "0% 0" });
  });

  it("fills transparent page surfaces from their nearest opaque reader background", () => {
    const reader = document.createElement("div");
    const page = document.createElement("div");
    reader.style.backgroundColor = tokens.color.primitive.cream100;
    page.style.backgroundColor = "transparent";
    reader.append(page);
    document.body.append(reader);

    expect(resolvePageSurfaceBackground(page)).toBe("rgb(250, 249, 245)");

    reader.remove();
  });

  it("falls back to the canvas token when every ancestor is transparent", () => {
    const page = document.createElement("div");

    expect(resolvePageSurfaceBackground(page)).toBe(tokens.color.semantic.canvas);
  });
});
