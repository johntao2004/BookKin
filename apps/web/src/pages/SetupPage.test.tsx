import { fireEvent, render, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { SetupPage } from "./SetupPage";

describe("SetupPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("redirects an initialized library back to login", async () => {
    vi.spyOn(api, "getSetupStatus").mockResolvedValue({ initialized: true });

    render(
      <TestProviders initialPath="/setup">
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<div>登录页</div>} />
        </Routes>
      </TestProviders>,
    );

    expect(await screen.findByText("登录页")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创建主人账户" })).not.toBeInTheDocument();
  });

  it("shows the owner form when initialization is still required", async () => {
    vi.spyOn(api, "getSetupStatus").mockResolvedValue({ initialized: false });

    render(<TestProviders initialPath="/setup"><SetupPage /></TestProviders>);

    expect(await screen.findByRole("button", { name: "创建主人账户" })).toBeInTheDocument();
  });
  it("shows inline required, password length and confirmation errors", async () => {
    vi.spyOn(api, "getSetupStatus").mockResolvedValue({ initialized: false });
    const setup = vi.spyOn(api, "setupOwner");
    render(<TestProviders initialPath="/setup"><SetupPage /></TestProviders>);
    const submit = await screen.findByRole("button", { name: "创建主人账户" });
    fireEvent.click(submit);
    expect(await screen.findByText("请输入昵称")).toBeInTheDocument();
    expect(await screen.findByText("请输入用户名")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("密码", { exact: true }), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("确认密码", { exact: true }), { target: { value: "different" } });
    fireEvent.click(submit);
    expect(await screen.findByText("密码至少需要 12 个字符")).toBeInTheDocument();
    expect(await screen.findByText("两次输入的密码不一致")).toBeInTheDocument();
    expect(setup).not.toHaveBeenCalled();
  });

});
