// 验证创建者编辑与拖动排序入口，避免重复的上下移动按钮。
// Checks creator editing and drag sorting without redundant up/down controls.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { BooklistDetailPage } from "./BooklistDetailPage";

const owner = {
  id: "user-owner",
  username: "owner",
  displayName: "林",
  role: "OWNER",
  mustChangePassword: false,
};

describe("BooklistDetailPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(owner));
  });

  it("创建者可编辑资料，排序列表保留拖动并移除重复的上下按钮", async () => {
    render(
      <TestProviders initialPath="/booklists/booklist-private">
        <Routes><Route path="/booklists/:booklistId" element={<BooklistDetailPage />} /></Routes>
      </TestProviders>,
    );

    expect(await screen.findByRole("heading", { name: "想读的自然笔记" })).toBeInTheDocument();
    expect(screen.getByText("仅自己")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑资料与可见范围" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "整理书单" }));
    expect(await screen.findByRole("heading", { name: "整理书单 · 想读的自然笔记" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "关闭整理书单" })).toHaveLength(1);
    const currentOrder = within(await screen.findByRole("region", { name: "当前顺序" }));
    const firstTitle = demoBooks[2].title;
    expect(currentOrder.queryByRole("button", { name: /^上移|^下移/ })).not.toBeInTheDocument();
    expect(await currentOrder.findAllByRole("listitem")).toHaveLength(3);
    for (const row of currentOrder.getAllByRole("listitem")) expect(row).toHaveAttribute("draggable", "true");
    expect(currentOrder.getByRole("button", { name: `移出 ${firstTitle}` })).toBeEnabled();
  });
});
