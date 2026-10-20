// 检查紧凑阅读菜单与桌面操作行可达，并沿用全局页面框架。
// Checks compact-reader menu and desktop-action reachability within the shared page frame.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestProviders } from "../../test/TestProviders";
import { ReaderTopBar } from "./ReaderTopBar";

function renderTopBar(format: "EPUB" | "PDF") {
  return render(
    <TestProviders>
      <ReaderTopBar
        title="山川与灯火"
        subtitle={`顾远 · ${format} · 已读 12%`}
        format={format}
        progressPercent={12}
        tableOfContentsAvailable={format === "EPUB"}
        bookmarked={false}
        bookmarkBusy={false}
        onBack={vi.fn()}
        onOpenTableOfContents={vi.fn()}
        onToggleBookmark={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenNotes={vi.fn()}
      />
    </TestProviders>,
  );
}

describe("ReaderTopBar", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["EPUB", "PDF"] as const)("uses the shared reader navigation layout for %s", (format) => {
    renderTopBar(format);

    const navigation = screen.getByRole("navigation", { name: "阅读器顶部导航" });
    expect(navigation.closest("section")).toHaveAttribute("data-reader-layout", "shared");
    expect(navigation.closest("section")).toHaveAttribute("data-reader-format", format);
    expect(navigation.closest("section")).toHaveClass("bk-top-nav", "bk-reader-control-bar");
    expect(screen.getByRole("button", { name: "返回书库" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "阅读设置" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多阅读操作" })).toBeInTheDocument();
  });

  it("keeps directory, bookmark and notes reachable from the compact reader menu", () => {
    renderTopBar("EPUB");
    fireEvent.click(screen.getByRole("button", { name: "更多阅读操作" }));

    expect(screen.getByRole("menuitem", { name: "目录" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "添加书签" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "本书笔记" })).toBeInTheDocument();
  });

  it("keeps the full action row available on desktop", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderTopBar("EPUB");

    expect(screen.getByRole("button", { name: "打开目录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换书签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开笔记" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更多阅读操作" })).not.toBeInTheDocument();
  });

  it("uses the same page frame as the global navigation", () => {
    renderTopBar("PDF");

    expect(screen.getByRole("navigation", { name: "阅读器顶部导航" })).toHaveStyle({ width: "100%", maxWidth: "none" });
    expect(screen.getByText("山川与灯火").parentElement).toHaveStyle({ flex: "1 1 0%" });
  });
});
