import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { LibraryPage } from "./LibraryPage";

function RouteSearch() {
  const location = useLocation();
  return <output data-testid="route-search">{location.search}</output>;
}

describe("LibraryPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({
      id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false,
    }));
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps all four overview modules when the library has no books", async () => {
    vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
    render(<TestProviders initialPath="/library/all"><LibraryPage /></TestProviders>);

    const pageTitle = screen.getByRole("heading", { name: "藏书库", level: 1 });
    const overview = screen.getByRole("region", { name: "书库概览" });
    const catalogTitle = screen.getByRole("heading", { name: "全部藏书", level: 2 });
    const uploadButton = screen.getByRole("button", { name: "上传书籍" });
    const formatControl = screen.getByRole("combobox", { name: "格式" });
    const sortControl = screen.getByRole("combobox", { name: "排序" });
    const emptyHeadings = await screen.findAllByRole("heading", { name: "无书目" });
    expect(within(overview).getByRole("heading", { name: "无书目" })).toBeInTheDocument();
    expect(pageTitle.compareDocumentPosition(overview)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(overview.compareDocumentPosition(catalogTitle)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(overview.compareDocumentPosition(uploadButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(catalogTitle.compareDocumentPosition(uploadButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(uploadButton.compareDocumentPosition(formatControl)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(formatControl.compareDocumentPosition(sortControl)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getAllByRole("button", { name: "上传书籍" })).toHaveLength(1);
    expect(catalogTitle.compareDocumentPosition(emptyHeadings.at(-1)!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(overview.compareDocumentPosition(emptyHeadings.at(-1)!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(formatControl).toBeInTheDocument();
    expect(sortControl).toBeInTheDocument();
    for (const name of ["本周新藏", "最近批注", "本周阅读时长", "阅读进度"]) {
      expect(within(overview).getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it.each(["/library/all", "/library/all?sort=title"]) (
    "does not show clear filters for an unfiltered empty library (%s)",
    async (initialPath) => {
      vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
      render(<TestProviders initialPath={initialPath}><LibraryPage /></TestProviders>);

      expect(await screen.findAllByRole("heading", { name: "无书目" })).toHaveLength(2);
      expect(screen.queryByRole("button", { name: "清除筛选" })).not.toBeInTheDocument();
    },
  );

  it.each(["/library/all?format=PDF", "/library/all?q=not-found"]) (
    "shows clear filters when the empty library has a book filter (%s)",
    async (initialPath) => {
      vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
      render(<TestProviders initialPath={initialPath}><LibraryPage /></TestProviders>);

      expect(await screen.findAllByRole("heading", { name: "无书目" })).toHaveLength(2);
      expect(screen.getByRole("button", { name: "清除筛选" })).toBeInTheDocument();
      const overview = screen.getByRole("region", { name: "书库概览" });
      const catalogTitle = screen.getByRole("heading", { name: "全部藏书", level: 2 });
      expect(screen.getByRole("heading", { name: "藏书库", level: 1 }).compareDocumentPosition(overview)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(overview.compareDocumentPosition(catalogTitle)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    },
  );

  it("clears only search and format filters while preserving sort and other URL parameters", async () => {
    const listBooks = vi.spyOn(api, "listBooks").mockResolvedValue({ items: [] });
    render(
      <TestProviders initialPath="/library/all?format=PDF&q=not-found&sort=title&view=compact">
        <><LibraryPage /><RouteSearch /></>
      </TestProviders>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "清除筛选" }));

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId("route-search").textContent ?? "");
      expect(params.has("q")).toBe(false);
      expect(params.has("format")).toBe(false);
      expect(params.get("sort")).toBe("title");
      expect(params.get("view")).toBe("compact");
    });
    await waitFor(() => expect(listBooks).toHaveBeenLastCalledWith(expect.objectContaining({
      q: undefined,
      format: undefined,
      sort: "title",
    })));
    expect(screen.queryByRole("button", { name: "清除筛选" })).not.toBeInTheDocument();
  });

  it("filters the gallery from the URL query", async () => {
    render(<TestProviders initialPath="/library?q=夜航"><LibraryPage /></TestProviders>);
    await waitFor(() => expect(screen.getAllByText("夜航记").length).toBeGreaterThan(0));
    const overview = screen.getByRole("region", { name: "书库概览" });
    const catalogTitle = screen.getByRole("heading", { name: "全部藏书", level: 2 });
    const recentPanel = screen.getByRole("region", { name: "最近批注" });
    expect(overview).toContainElement(recentPanel);
    expect(screen.getByText("找到 1 本相关藏书")).toBeInTheDocument();
    expect(catalogTitle.compareDocumentPosition(screen.getByText("找到 1 本相关藏书"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByText("夏日植物学")).not.toBeInTheDocument();
  });

  it("shows a back-to-top button after scrolling", async () => {
    const originalScrollY = window.scrollY;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    render(<TestProviders initialPath="/library/all"><LibraryPage /></TestProviders>);

    expect(screen.queryByRole("button", { name: "回到顶部" })).not.toBeInTheDocument();

    Object.defineProperty(window, "scrollY", { configurable: true, value: 600 });
    fireEvent.scroll(window);
    expect(await screen.findByRole("button", { name: "回到顶部" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "回到顶部" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

    Object.defineProperty(window, "scrollY", { configurable: true, value: originalScrollY });
    scrollTo.mockRestore();
  });

  it("places reading stats above the current reading card", async () => {
    const { container } = render(<TestProviders initialPath="/library/all"><LibraryPage /></TestProviders>);
    await screen.findByRole("region", { name: "本周阅读时长" });
    await waitFor(() => expect(container.querySelector('[aria-labelledby="currently-reading-title"]')).not.toBeNull());

    const stats = container.querySelector('[aria-labelledby="reading-time-title"]');
    const currentReading = container.querySelector('[aria-labelledby="currently-reading-title"]');
    expect(stats?.compareDocumentPosition(currentReading ?? document.body)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps a clear reading-progress empty state before the first reading session", async () => {
    vi.spyOn(api, "listBooks").mockResolvedValue({ items: [{ ...demoBooks[0], progress: 0 }] });

    const { container } = render(<TestProviders initialPath="/library/all"><LibraryPage /></TestProviders>);
    const currentReading = await waitFor(() => {
      const element = container.querySelector<HTMLElement>('[aria-labelledby="currently-reading-title"]');
      expect(element).not.toBeNull();
      return element!;
    });

    expect(within(currentReading).getByRole("heading", { name: "请开始阅读" })).toBeInTheDocument();
    expect(within(currentReading).getByText("打开任意一本书后，阅读进度会显示在这里。")).toBeInTheDocument();
    expect(within(currentReading).queryByRole("button")).not.toBeInTheDocument();
    expect(within(currentReading).queryByText(/已读/)).not.toBeInTheDocument();

    const recentAnnotations = await screen.findByRole("region", { name: "最近批注" });
    const recentTitle = await within(recentAnnotations).findByRole("heading", { name: "无书目" });
    const progressTitle = within(currentReading).getByRole("heading", { name: "请开始阅读" });
    const progressDescription = within(currentReading).getByText("打开任意一本书后，阅读进度会显示在这里。");
    expect(recentTitle).toHaveClass("bk-typography-h4");
    expect(progressTitle).toHaveClass("bk-typography-h4");
    expect(within(recentAnnotations).queryByText("去书中划下第一句话，它会出现在这里。")).not.toBeInTheDocument();
    expect(progressDescription).toHaveClass("bk-typography-body2");
  });
});
