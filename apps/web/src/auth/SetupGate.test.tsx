import { render, screen } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { SetupGate } from "./SetupGate";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.hash}</output>;
}

describe("SetupGate", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["/login", "/library", "/anything-not-found"])("redirects %s to setup before initialization", async path => {
    vi.spyOn(api, "getSetupStatus").mockResolvedValue({ initialized: false });
    render(<TestProviders initialPath={path}><SetupGate><Routes><Route path="/setup" element={<div>setup</div>} /><Route path="*" element={<div>business page</div>} /></Routes></SetupGate></TestProviders>);
    expect(await screen.findByText("setup")).toBeInTheDocument();
    expect(screen.queryByText("business page")).not.toBeInTheDocument();
  });

  it("fails closed to setup when status cannot be fetched", async () => {
    vi.spyOn(api, "getSetupStatus").mockRejectedValue(new Error("offline"));
    render(<TestProviders initialPath="/login"><SetupGate><Routes><Route path="/setup" element={<div>setup</div>} /><Route path="*" element={<div>business page</div>} /></Routes></SetupGate></TestProviders>);
    expect(await screen.findByText("setup")).toBeInTheDocument();
    expect(screen.queryByText("business page")).not.toBeInTheDocument();
  });

  it("keeps the requested route while initialization status is pending", async () => {
    let resolveStatus!: (value: { initialized: boolean }) => void;
    vi.spyOn(api, "getSetupStatus").mockReturnValue(new Promise(resolve => { resolveStatus = resolve; }));
    render(<TestProviders initialPath="/settings#users/roles"><LocationProbe /><SetupGate><Routes><Route path="*" element={<div>business page</div>} /></Routes></SetupGate></TestProviders>);
    expect(screen.getByRole("status", { name: "正在确认系统初始化状态" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/settings#users/roles");
    expect(screen.queryByText("business page")).not.toBeInTheDocument();

    resolveStatus({ initialized: true });
    expect(await screen.findByText("business page")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/settings#users/roles");
  });
});
