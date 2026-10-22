// 模拟渲染异常并检查可恢复界面，避免组件失败后只留下空白页面。
// Simulates render failure and checks a recovery surface rather than a blank page.
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { AppErrorBoundary } from "./AppErrorBoundary";
it("renders a recovery action instead of a blank page after a render failure", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  function Broken(): never { throw new Error("render failure"); }
  try {
    render(<TestProviders><AppErrorBoundary><Broken /></AppErrorBoundary></TestProviders>);
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  } finally { error.mockRestore(); }
});
