// 默认书库仅展示状态并允许复查，不再提供新增目录入口。
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TestProviders } from "../test/TestProviders";
import { describe, it, expect, vi } from "vitest";
import { LibraryRootsPage } from "./LibraryRootsPage";
import { api } from "../api/client";
vi.mock("../api/client", () => ({ api: { isDemo: true, listLiveLibraryRoots: vi.fn().mockResolvedValue([
 {id:"books", name:"主书库", configuredPath:"/private/books", status:"ONLINE", canRead:true, canWrite:true, freeBytes:3000000000, lastScanAt:"2026-10-23T01:00:00Z"},
]), listContentStorage: vi.fn().mockResolvedValue([
 {kind:"ARTICLES", canRead:true, canWrite:true, freeBytes:2000000000, lastScanAt:"2026-10-23T01:01:00Z"},
 {kind:"VAULT", canRead:true, canWrite:true, freeBytes:null, lastScanAt:null},
]), checkLibraryRoots: vi.fn().mockResolvedValue([]) } }));
describe("library registration", () => {
 it("keeps capability rechecks without library registration controls", async () => {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "admin", username: "admin", displayName: "管理员", role: "ADMIN", mustChangePassword: false }));
  render(<TestProviders><LibraryRootsPage /></TestProviders>);
  await screen.findByRole("heading", {name:"书籍书库"});
  expect(screen.queryByRole("button", {name:/新增/})).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"重新检查"}));
  await waitFor(() => expect(api.checkLibraryRoots).toHaveBeenCalledTimes(1));
 });
 it("shows separate managed article and encrypted vault storage without mixing them into book directories", async () => {
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "admin", username: "admin", displayName: "管理员", role: "ADMIN", mustChangePassword: false }));
  render(<TestProviders><LibraryRootsPage /></TestProviders>);
  expect(await screen.findByRole("heading", {name:"文章书库"})).toBeVisible();
  expect(await screen.findByRole("heading", {name:"禁书区书库"})).toBeVisible();
  expect(api.listLiveLibraryRoots).toHaveBeenCalled();
  expect(screen.queryByText(/\/private\/books|\/content\//)).not.toBeInTheDocument();
  expect(screen.queryByText(/独立保存|文章素材|加密存储/)).not.toBeInTheDocument();
  const cards = ["书籍书库", "文章书库", "禁书区书库"].map(name => screen.getByRole("heading", {name}).closest(".bk-card") as HTMLElement);
  for (const card of cards) {
   expect(within(card).getByText(/可用空间/)).toBeVisible();
   expect(within(card).getByText(/上次扫描/)).toBeVisible();
   expect(card.querySelector("svg")).toBeNull();
  }
  expect(within(cards[0]).getByText("3.0 GB")).toBeVisible();
  expect(within(cards[1]).getByText("2.0 GB")).toBeVisible();
  expect(within(cards[2]).getByText("未知")).toBeVisible();
  expect(within(cards[2]).getByText("上次扫描 尚未扫描")).toBeVisible();
  expect(screen.queryByRole("button", {name:/新增/})).not.toBeInTheDocument();
 });
});
