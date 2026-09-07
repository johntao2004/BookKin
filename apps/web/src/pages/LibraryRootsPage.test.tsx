import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { LibraryRootsPage } from "./LibraryRootsPage";
import { api } from "../api/client";
vi.mock("../api/client", () => ({ api: { listLibraryRoots: vi.fn().mockResolvedValue([]), previewLibraryRoot: vi.fn(), createLibraryRoot: vi.fn(), checkLibraryRoots: vi.fn() } }));
describe("library registration", () => {
 it("requires a fresh directory check after changing the path", async () => {
  vi.mocked(api.previewLibraryRoot).mockResolvedValue({ path: "/library/books", fingerprint: "f", writable: true, freeBytes: 100 });
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><LibraryRootsPage /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", {name:"新增书库"}));
  fireEvent.change(screen.getByRole("textbox", {name:"书库名称"}), {target:{value:"Books"}});
  fireEvent.change(screen.getByRole("textbox", {name:"容器内目录"}), {target:{value:"/library/books"}});
  fireEvent.click(screen.getByRole("button", {name:"检查位置"}));
  await screen.findByRole("button", {name:"确认新增"});
  fireEvent.change(screen.getByRole("textbox", {name:"容器内目录"}), {target:{value:"/library/other"}});
  await waitFor(() => expect(screen.getByRole("button", {name:"检查位置"})).toBeInTheDocument());
  expect(api.createLibraryRoot).not.toHaveBeenCalled();
 });
});
