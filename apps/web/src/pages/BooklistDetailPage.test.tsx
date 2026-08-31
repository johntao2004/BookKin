import { fireEvent, render, screen } from "@testing-library/react";
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

  it("创建者可编辑资料，且手动排序同时提供拖动与上下按钮", async () => {
    render(
      <TestProviders initialPath="/booklists/booklist-private">
        <Routes><Route path="/booklists/:booklistId" element={<BooklistDetailPage />} /></Routes>
      </TestProviders>,
    );

    expect(await screen.findByRole("heading", { name: "想读的自然笔记" })).toBeInTheDocument();
    expect(screen.getByText("仅自己")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑资料与可见范围" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "整理书单" }));
    expect(await screen.findByText("拖动或使用上下按钮排序；所有变更自动保存。")).toBeInTheDocument();
    const firstTitle = demoBooks[2].title;
    expect(await screen.findByRole("button", { name: `上移 ${firstTitle}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `下移 ${firstTitle}` })).toBeEnabled();
    expect(screen.getByRole("button", { name: `移出 ${firstTitle}` })).toBeEnabled();
  });
});
