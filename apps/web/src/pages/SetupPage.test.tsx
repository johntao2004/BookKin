// 验证已初始化重定向与表单校验，只有确认未初始化才展示创建入口。
// Checks initialized redirects and form validation, showing setup only after confirmed uninitialized status.
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
    vi.spyOn(api, "passwordPolicy").mockResolvedValue({ minLength: 12, requireUppercase: false, requireLowercase: false, requireDigit: false, requireSpecial: false });

    render(<TestProviders initialPath="/setup"><SetupPage /></TestProviders>);

    expect(await screen.findByRole("button", { name: "创建主人账户" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /返回登录/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /返回首页/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/login"]')).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/library"]')).not.toBeInTheDocument();
  });

  it("keeps navigation locked when setup status cannot be checked", async () => {
    vi.spyOn(api, "getSetupStatus").mockRejectedValue(new Error("offline"));
    render(<TestProviders initialPath="/setup"><SetupPage /></TestProviders>);
    expect(await screen.findByText("为了避免重复初始化，请先重试状态检查。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    expect(document.querySelector('a[href="/login"]')).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/library"]')).not.toBeInTheDocument();
  });
  it("shows inline required, password length and confirmation errors", async () => {
    vi.spyOn(api, "getSetupStatus").mockResolvedValue({ initialized: false });
    vi.spyOn(api, "passwordPolicy").mockResolvedValue({ minLength: 12, requireUppercase: false, requireLowercase: false, requireDigit: false, requireSpecial: false });
    const setup = vi.spyOn(api, "setupOwner");
    render(<TestProviders initialPath="/setup"><SetupPage /></TestProviders>);
    const submit = await screen.findByRole("button", { name: "创建主人账户" });
    expect(screen.queryByText(/密码要求：/)).not.toBeInTheDocument();
    fireEvent.click(submit);
    expect(await screen.findByText("请输入密码，请满足密码要求")).toBeInTheDocument();
    expect(screen.queryByText("请输入密码")).not.toBeInTheDocument();
    expect(screen.queryByText(/密码要求：/)).not.toBeInTheDocument();
    expect(document.querySelector(".ant-form-item-explain")?.textContent).not.toContain("长度为 12–200 个字符");
    expect(await screen.findByText("请输入昵称")).toBeInTheDocument();
    expect(await screen.findByText("请输入用户名")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("密码", { exact: true }), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("确认密码", { exact: true }), { target: { value: "different" } });
    fireEvent.click(submit);
    expect(await screen.findByText("请满足密码要求")).toBeInTheDocument();
    expect(await screen.findByText("两次输入的密码不一致")).toBeInTheDocument();
    expect(setup).not.toHaveBeenCalled();
  });

});
