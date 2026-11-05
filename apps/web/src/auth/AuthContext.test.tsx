// 验证路由守卫的 401、403 与允许角色分支，不把客户端守卫当作服务端授权替代。
// Checks 401, 403 and allowed-role route branches without treating client guards as server authorization.
import { fireEvent, render, screen } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { RequireAuth } from "./AuthContext";

const owner = {
  id: "user-owner",
  username: "owner",
  displayName: "林",
  role: "OWNER" as const,
  mustChangePassword: false,
};

const member = {
  id: "user-member",
  username: "member",
  displayName: "家庭成员",
  role: "MEMBER" as const,
  mustChangePassword: false,
};

function LoginStateProbe() {
  const location = useLocation();
  return <div>登录返回位置：{(location.state as { from?: string } | null)?.from}</div>;
}

function renderProtectedRoute(initialPath: string, roles?: Array<"OWNER" | "ADMIN" | "MEMBER">) {
  return render(
    <TestProviders initialPath={initialPath}>
      <Routes>
        <Route
          path="/admin/users"
          element={<RequireAuth roles={roles}><div>用户管理私密内容</div></RequireAuth>}
        />
        <Route path="/login" element={<LoginStateProbe />} />
      </Routes>
    </TestProviders>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => sessionStorage.clear());

  it("intercepts a signed-out direct route with an explicit 401 page", () => {
    renderProtectedRoute("/admin/users?tab=active#staff", ["OWNER", "ADMIN"]);

    expect(screen.getByRole("heading", { name: "需要登录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", {level: 1, name: "401"})).toBeInTheDocument();
    expect(screen.queryByText("用户管理私密内容")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "登录" }));
    expect(screen.getByText("登录返回位置：/admin/users?tab=active#staff")).toBeInTheDocument();
  });

  it("shows an explicit 403 page instead of silently redirecting a member", () => {
    sessionStorage.setItem("silvae-demo-session", JSON.stringify(member));
    renderProtectedRoute("/admin/users", ["OWNER", "ADMIN"]);

    expect(screen.getByRole("heading", { name: "权限受限" })).toBeInTheDocument();
    expect(screen.getByRole("heading", {level: 1, name: "403"})).toBeInTheDocument();
    expect(screen.queryByText("用户管理私密内容")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回藏书库" })).toHaveAttribute("href", "/library/all");
  });

  it("renders the route for an allowed role", () => {
    sessionStorage.setItem("silvae-demo-session", JSON.stringify(owner));
    renderProtectedRoute("/admin/users", ["OWNER", "ADMIN"]);

    expect(screen.getByText("用户管理私密内容")).toBeInTheDocument();
    expect(screen.queryByRole("heading", {level: 1, name: "401"})).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", {level: 1, name: "403"})).not.toBeInTheDocument();
  });
});
