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

    expect(screen.getByRole("heading", { name: "这间书房暂未为你开门" })).toBeInTheDocument();
    expect(screen.getByText("401 · 需要登录")).toBeInTheDocument();
    expect(screen.queryByText("用户管理私密内容")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "前往登录" }));
    expect(screen.getByText("登录返回位置：/admin/users?tab=active#staff")).toBeInTheDocument();
  });

  it("shows an explicit 403 page instead of silently redirecting a member", () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(member));
    renderProtectedRoute("/admin/users", ["OWNER", "ADMIN"]);

    expect(screen.getByRole("heading", { name: "这把钥匙打不开这一页" })).toBeInTheDocument();
    expect(screen.getByText("403 · 权限受限")).toBeInTheDocument();
    expect(screen.queryByText("用户管理私密内容")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回藏书库" })).toHaveAttribute("href", "/library/all");
  });

  it("renders the route for an allowed role", () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    renderProtectedRoute("/admin/users", ["OWNER", "ADMIN"]);

    expect(screen.getByText("用户管理私密内容")).toBeInTheDocument();
    expect(screen.queryByText("401 · 需要登录")).not.toBeInTheDocument();
    expect(screen.queryByText("403 · 权限受限")).not.toBeInTheDocument();
  });
});
