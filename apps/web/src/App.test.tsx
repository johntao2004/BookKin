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
