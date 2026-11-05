import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../api/client";
import * as permissionHooks from "../auth/permissions";
import { TestProviders } from "../test/TestProviders";
import { SearchPage } from "./SearchPage";

beforeEach(() => {
  sessionStorage.setItem("silvae-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false }));
});
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

it("keeps signed-in search available without querying private or public books when library query is denied", async () => {
  const privateBooks = vi.spyOn(api, "listBooks");
  const publicBooks = vi.spyOn(api, "listDisplayBooks");
  const categories = vi.spyOn(api, "listCategories");
  const usePermissions = permissionHooks.usePermissions;
  vi.spyOn(permissionHooks, "usePermissions").mockImplementation(() => {
    const permissions = usePermissions();
    return { ...permissions, can: code => code !== "library.query" && permissions.can(code) };
  });

  render(<TestProviders initialPath="/search?q=river"><SearchPage /></TestProviders>);
  expect(await screen.findByText(/当前角色没有查询书籍目录的权限/)).toBeInTheDocument();
  expect(privateBooks).not.toHaveBeenCalled();
  expect(publicBooks).not.toHaveBeenCalled();
  expect(categories).not.toHaveBeenCalled();
});

it("blocks the search page independently from its directory-query capability", async () => {
  const privateBooks = vi.spyOn(api, "listBooks");
  const publicBooks = vi.spyOn(api, "listDisplayBooks");
  const usePermissions = permissionHooks.usePermissions;
  vi.spyOn(permissionHooks, "usePermissions").mockImplementation(() => {
    const permissions = usePermissions();
    return { ...permissions, can: code => code !== "library.search.view" && permissions.can(code) };
  });

  render(<TestProviders initialPath="/search?q=river"><SearchPage /></TestProviders>);
  expect(screen.getByRole("heading", { name: "搜索" })).toBeInTheDocument();
  expect(privateBooks).not.toHaveBeenCalled();
  expect(publicBooks).not.toHaveBeenCalled();
});

it("gates note and booklist search sources by their corresponding read grants", async () => {
  const annotations = vi.spyOn(api, "listAnnotations");
  const booklists = vi.spyOn(api, "listBooklists");
  const usePermissions = permissionHooks.usePermissions;
  vi.spyOn(permissionHooks, "usePermissions").mockImplementation(() => {
    const permissions = usePermissions();
    return { ...permissions, can: code => code !== "notes.view" && code !== "booklists.view" && permissions.can(code) };
  });

  render(<TestProviders initialPath="/search?q=river"><SearchPage /></TestProviders>);
  expect(await screen.findByRole("heading", { name: "搜索" })).toBeInTheDocument();
  expect(annotations).not.toHaveBeenCalled();
  expect(booklists).not.toHaveBeenCalled();
});
