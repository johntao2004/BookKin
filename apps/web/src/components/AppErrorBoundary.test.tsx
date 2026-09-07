import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { AppErrorBoundary } from "./AppErrorBoundary";
it("renders a recovery action instead of a blank page after a render failure", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  function Broken(): never { throw new Error("render failure"); }
  try {
    render(<TestProviders><AppErrorBoundary><Broken /></AppErrorBoundary></TestProviders>);
    expect(screen.getByRole("button", { name: "重新加载页面" })).toBeInTheDocument();
  } finally { error.mockRestore(); }
});
