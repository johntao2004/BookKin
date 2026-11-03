import { fireEvent, render, screen } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { SetupGate } from "./SetupGate";
import { setupStatusQueryOptions } from "./setup-status";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.hash}</output>;
}

describe("SetupGate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses a short cache without automatic retries or focus refetches", () => {
    expect(setupStatusQueryOptions.staleTime).toBe(60_000);
    expect(setupStatusQueryOptions.retry).toBe(false);
    expect(setupStatusQueryOptions.refetchOnWindowFocus).toBe(false);
  });

  it.each(["/login", "/library", "/anything-not-found"])("redirects %s to setup before initialization", async path => {
    vi.spyOn(api, "getSetupStatus").mockResolvedValue({ initialized: false });
    render(<TestProviders initialPath={path}><SetupGate><Routes><Route path="/setup" element={<div>setup</div>} /><Route path="*" element={<div>business page</div>} /></Routes></SetupGate></TestProviders>);
    expect(await screen.findByText("setup")).toBeInTheDocument();
    expect(screen.queryByText("business page")).not.toBeInTheDocument();
  });

  it("shows a request error and waits for manual retry when status cannot be fetched", async () => {
    const getSetupStatus = vi.spyOn(api, "getSetupStatus")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ initialized: true });
    render(<TestProviders initialPath="/login"><SetupGate><Routes><Route path="/setup" element={<div>setup</div>} /><Route path="*" element={<div>business page</div>} /></Routes></SetupGate></TestProviders>);

    expect(await screen.findByRole("alert", { name: "错误页面" })).toBeInTheDocument();
    expect(screen.getByText("原因：offline")).toBeInTheDocument();
    expect(screen.queryByText("business page")).not.toBeInTheDocument();
    expect(screen.queryByText("setup")).not.toBeInTheDocument();
    expect(getSetupStatus).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("business page")).toBeInTheDocument();
    expect(getSetupStatus).toHaveBeenCalledTimes(2);
  });

  it("keeps the requested route while initialization status is pending", async () => {
    let resolveStatus!: (value: { initialized: boolean }) => void;
    const getSetupStatus = vi.spyOn(api, "getSetupStatus").mockReturnValue(new Promise(resolve => { resolveStatus = resolve; }));
    render(<TestProviders initialPath="/settings#users/roles"><LocationProbe /><SetupGate><Routes><Route path="*" element={<div>business page</div>} /></Routes></SetupGate></TestProviders>);
    expect(screen.getByRole("status", { name: "正在确认系统初始化状态" })).toBeInTheDocument();
    expect(getSetupStatus).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(screen.getByTestId("location")).toHaveTextContent("/settings#users/roles");
    expect(screen.queryByText("business page")).not.toBeInTheDocument();

    resolveStatus({ initialized: true });
    expect(await screen.findByText("business page")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/settings#users/roles");
  });
});
