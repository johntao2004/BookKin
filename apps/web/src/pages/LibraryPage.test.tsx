import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { LibraryPage } from "./LibraryPage";

describe("LibraryPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({
      id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false,
    }));
  });

  afterEach(() => vi.restoreAllMocks());

  it("filters the gallery from the URL query", async () => {
    render(<TestProviders initialPath="/library?q=夜航"><LibraryPage /></TestProviders>);
    await waitFor(() => expect(screen.getAllByText("夜航记").length).toBeGreaterThan(0));
    const overview = screen.getByRole("region", { name: "书库概览" });
    const recentPanel = screen.getByRole("region", { name: "最近批注" });
    expect(overview).toContainElement(recentPanel);
    expect(screen.getByText("找到 1 本相关藏书")).toBeInTheDocument();
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
    const recentTitle = await within(recentAnnotations).findByRole("heading", { name: "还没有批注" });
    const progressTitle = within(currentReading).getByRole("heading", { name: "请开始阅读" });
    const recentDescription = await within(recentAnnotations).findByText("去书中划下第一句话，它会出现在这里。");
    const progressDescription = within(currentReading).getByText("打开任意一本书后，阅读进度会显示在这里。");
    expect(recentTitle).toHaveClass("MuiTypography-h4");
    expect(progressTitle).toHaveClass("MuiTypography-h4");
    expect(recentDescription).toHaveClass("MuiTypography-body2");
    expect(progressDescription).toHaveClass("MuiTypography-body2");
  });
});
