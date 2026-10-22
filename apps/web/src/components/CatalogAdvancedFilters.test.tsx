import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { LibraryPage } from "../pages/LibraryPage";
import { PublicLibraryPage } from "../pages/PublicLibraryPage";
import { CatalogAdvancedFilters } from "./CatalogAdvancedFilters";

function Location() {
  const location = useLocation();
  return <output data-testid="url">{location.search}</output>;
}
const category = { id: "topic", name: "文学", bookCount: 2, previewBooks: [], editable: true };

describe("catalog advanced filters", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "owner", username: "owner", displayName: "主人", role: "OWNER", mustChangePassword: false }));
    localStorage.setItem("bookkin-library-overview:owner", "hidden");
    vi.spyOn(api, "listCategories").mockResolvedValue({ items: [category], editable: true });
    vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
    vi.spyOn(api, "listDisplayBooks").mockResolvedValue({ items: [], revision: 1 });
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens on demand, combines category/search/format/sort and retains filters when collapsed", async () => {
    render(<TestProviders initialPath="/library/all?format=PDF&sort=title&q=诗"><LibraryPage /><Location /></TestProviders>);
    expect(screen.queryByRole("region", { name: "高级筛选" })).not.toBeInTheDocument();
    expect(api.listCategories).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "高级筛选" }));
    const panel = screen.getByRole("region", { name: "高级筛选" });
    const select = await within(panel).findByRole("combobox", { name: "分类" });
    fireEvent.mouseDown(select);
    fireEvent.click(await screen.findByText("文学 · 2 本"));
    await waitFor(() => expect(api.listBooks).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: "topic", q: "诗", format: "PDF", sort: "title", cursor: undefined })));
    fireEvent.change(within(panel).getByRole("textbox", { name: "关键词" }), { target: { value: "散文" } });
    await waitFor(() => expect(api.listBooks).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: "topic", q: "散文", format: "PDF", sort: "title" })));
    fireEvent.click(screen.getByRole("button", { name: "高级筛选" }));
    expect(screen.queryByRole("region", { name: "高级筛选" })).not.toBeInTheDocument();
    expect(screen.getByTestId("url")).toHaveTextContent("category=topic");
    expect(screen.getByTestId("url")).toHaveTextContent("advanced=0");
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByTestId("url")).toHaveTextContent("sort=title");
    expect(screen.getByTestId("url")).not.toHaveTextContent("category=");
    expect(screen.getByTestId("url")).not.toHaveTextContent("format=");
  });

  it("restores a category link and keeps category management inside the library", async () => {
    render(<TestProviders initialPath="/library/all?category=topic&manage=1"><LibraryPage /></TestProviders>);
    expect(screen.getByRole("region", { name: "高级筛选" })).toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "管理分类" })).toBeInTheDocument();
  });

  it("uses only the public catalog for anonymous category filters and hides management", async () => {
    sessionStorage.clear();
    render(<TestProviders initialPath="/library?category=topic&format=EPUB&sort=author&q=散文"><PublicLibraryPage /></TestProviders>);
    await screen.findByRole("combobox", { name: "分类" });
    expect(api.listDisplayBooks).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "topic", q: "散文", format: "EPUB", sort: "author" }));
    expect(api.listBooks).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "管理分类" })).not.toBeInTheDocument();
  });

  it("refreshes the catalog immediately when a category is deleted from management", async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    vi.spyOn(api, "deleteCategory").mockResolvedValue(undefined);
    render(<TestProviders initialPath="/library/all?category=topic&manage=1"><LibraryPage /></TestProviders>);
    const dialog = await screen.findByRole("dialog", { name: "管理分类" });
    fireEvent.click(within(dialog).getByRole("button", { name: "删除 文学" }));
    const confirmation = await screen.findByRole("dialog", { name: "删除“文学”？" });
    vi.mocked(api.listCategories).mockResolvedValue({ items: [], editable: true });
    fireEvent.click(within(confirmation).getByRole("button", { name: "删除分类" }));
    await waitFor(() => {
      expect(api.deleteCategory).toHaveBeenCalledWith("topic");
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["books"] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["display-books"] });
    });
  });

  it("distinguishes category errors from an empty category list and allows retry", async () => {
    vi.mocked(api.listCategories).mockRejectedValue(new Error("offline"));
    render(<TestProviders initialPath="/library/all?advanced=1"><CatalogAdvancedFilters /></TestProviders>);
    const retry = await screen.findByRole("button", { name: "重试" });
    expect(screen.queryByRole("button", { name: "创建分类" })).not.toBeInTheDocument();
    vi.mocked(api.listCategories).mockResolvedValue({ items: [], editable: true });
    fireEvent.click(retry);
    expect(await screen.findByRole("button", { name: "创建分类" })).toBeInTheDocument();
  });
  it("combines a deep Thema prefix with existing filters and restores it from the URL", async () => {
    render(<TestProviders initialPath="/library?subject=RNK&category=topic&format=PDF&sort=title"><LibraryPage /><Location /></TestProviders>);
    expect(await screen.findByRole("combobox", { name: "学科分类" })).toBeInTheDocument();
    await waitFor(() => expect(api.listBooks).toHaveBeenCalledWith(expect.objectContaining({ subjectCode: "RNK", categoryId: "topic", format: "PDF", sort: "title" })));
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    await waitFor(() => expect(screen.getByTestId("url")).not.toHaveTextContent("subject="));
  });

  it("passes Thema filters to the public endpoint without querying the private catalog", async () => {
    sessionStorage.clear();
    render(<TestProviders initialPath="/library?subject=UNCLASSIFIED"><PublicLibraryPage /></TestProviders>);
    await waitFor(() => expect(api.listDisplayBooks).toHaveBeenCalledWith(expect.objectContaining({ subjectCode: "UNCLASSIFIED" })));
    expect(api.listBooks).not.toHaveBeenCalled();
  });

});
