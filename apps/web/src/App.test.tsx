// 验证私有页面在匿名访问时不挂载，并区分公开发现入口与角色不足的 403。
// Checks private content never mounts anonymously and distinguishes public discovery from role-denied 403 routes.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { TestProviders } from "./test/TestProviders";

const member = {
  id: "user-member",
  username: "member",
  displayName: "家庭成员",
  role: "MEMBER",
  mustChangePassword: false,
};

describe("App route permissions", () => {
  beforeEach(() => sessionStorage.clear());

  it("blocks a signed-out direct visit before private library content mounts", async () => {
    render(<TestProviders initialPath="/library/all"><App /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "这间书房暂未为你开门" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "全部藏书" })).not.toBeInTheDocument();
  });

  it("blocks a signed-out direct visit to the optional 3D route", async () => {
    render(<TestProviders initialPath="/virtual-library"><App /></TestProviders>);
    expect(await screen.findByRole("heading", {name:"这间书房暂未为你开门"})).toBeInTheDocument();
    expect(screen.queryByRole("region", {name:"虚拟 3D 图书馆"})).not.toBeInTheDocument();
  });

  it("keeps the explicit public discovery route available anonymously", async () => {
    render(<TestProviders initialPath="/library"><App /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "首页" })).toBeInTheDocument();
    expect(screen.queryByText("401 · 需要登录")).not.toBeInTheDocument();
  });

  it("shows the 403 route page for an authenticated member on administration routes", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(member));
    render(<TestProviders initialPath="/admin/users"><App /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "这把钥匙打不开这一页" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "用户管理" })).not.toBeInTheDocument();
  });
});
