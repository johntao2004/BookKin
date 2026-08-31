import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { getLoginGreeting } from "./login-greeting";
import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("uses a playful greeting for each part of the day", () => {
    expect(getLoginGreeting(5)).toBe("早安，书房已经替你开灯啦。");
    expect(getLoginGreeting(10)).toBe("早安，书房已经替你开灯啦。");
    expect(getLoginGreeting(11)).toBe("午安，忙里偷闲翻两页吧。");
    expect(getLoginGreeting(17)).toBe("午安，忙里偷闲翻两页吧。");
    expect(getLoginGreeting(18)).toBe("晚安，今晚想和哪本书见面？");
    expect(getLoginGreeting(4)).toBe("晚安，今晚想和哪本书见面？");
  });

  it("logs into the demo owner account", async () => {
    render(
      <TestProviders initialPath="/login">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/library" element={<div>书库已打开</div>} />
        </Routes>
      </TestProviders>,
    );

    expect(screen.queryByText("登录后继续阅读、整理藏书，或管理家庭成员。")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(screen.getByText("书库已打开")).toBeInTheDocument());
    expect(sessionStorage.getItem("bookkin-demo-session")).toContain('"role":"OWNER"');
  });

  it("does not offer owner initialization after setup has completed", async () => {
    vi.spyOn(api, "getSetupStatus").mockResolvedValue({ initialized: true });

    render(<TestProviders initialPath="/login"><LoginPage /></TestProviders>);

    await waitFor(() => expect(api.getSetupStatus).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: "初始化主人账户" })).not.toBeInTheDocument();
  });

  it("offers owner initialization only when setup is still required", async () => {
    vi.spyOn(api, "getSetupStatus").mockResolvedValue({ initialized: false });

    render(<TestProviders initialPath="/login"><LoginPage /></TestProviders>);

    expect(await screen.findByRole("link", { name: "初始化主人账户" })).toHaveAttribute("href", "/setup");
  });
});
