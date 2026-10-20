// 验证翻页画布与折痕阴影为独立层；结构测试不等同于真实 WebGL 视觉验收。
// Checks separate page-turn canvas and fold-shadow layers; structure tests are not real WebGL visual acceptance.
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
