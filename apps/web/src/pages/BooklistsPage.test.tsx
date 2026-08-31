import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { BooklistsPage } from "./BooklistsPage";

const owner = {
  id: "user-owner",
  username: "owner",
  displayName: "林",
  role: "OWNER",
  mustChangePassword: false,
};

describe("BooklistsPage", () => {
  beforeEach(() => sessionStorage.clear());

  it("匿名访客只看官方与公开发现区", async () => {
    render(<TestProviders initialPath="/booklists"><BooklistsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "官方书单" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "公开书单" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "秋日慢读" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "灯塔与远方" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的书单" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新建书单" })).not.toBeInTheDocument();
  });

  it("登录后分开我的书单与家庭发现，且主人可选官方类型", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
    render(<TestProviders initialPath="/booklists"><BooklistsPage /></TestProviders>);

    expect(await screen.findByRole("heading", { name: "我的书单" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "家庭共享与公开" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "想读的自然笔记" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "灯塔与远方" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "新建书单" })[0]);
    expect(await screen.findByRole("dialog", { name: "新建书单" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "书单类型" })).toBeInTheDocument();
  });
});
