import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageTurnShade } from "./PageTurnShade";

describe("PageTurnShade", () => {
  it("provides a WebGL canvas and a separate moving fold shadow", () => {
    const { container } = render(<PageTurnShade />);

    expect(container.querySelector("[data-page-turn-overlay]")).toBeInstanceOf(HTMLCanvasElement);
    expect(container.querySelector("[data-page-turn-shade]")).toBeInTheDocument();
  });
});
