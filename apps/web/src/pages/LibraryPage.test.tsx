import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { LibraryPage } from "./LibraryPage";

describe("LibraryPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({
      id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false,
    }));
  });

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
});
