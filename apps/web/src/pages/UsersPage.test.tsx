import { render, screen } from "@testing-library/react";
import { TestProviders } from "../test/TestProviders";
import { UsersPage } from "./UsersPage";

describe("UsersPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({
      id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false,
    }));
  });

  it("provides a mobile user-card list without the redundant permission notes", async () => {
    render(<TestProviders initialPath="/admin/users"><UsersPage /></TestProviders>);

    expect(await screen.findByRole("region", { name: "移动端用户列表" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getAllByText("账户状态")).toHaveLength(3);
    expect(screen.queryByText("浏览、阅读、书签、划线和私人笔记。")).not.toBeInTheDocument();
    expect(screen.queryByText("再加用户、扫描书库、管理 NAS 文件。")).not.toBeInTheDocument();
    expect(screen.queryByText("立即撤销会话，保留其个人阅读数据。")).not.toBeInTheDocument();
  });
});
