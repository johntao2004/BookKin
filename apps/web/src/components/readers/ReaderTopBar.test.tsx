import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TestProviders } from "../../test/TestProviders";
import { tokens } from "../../theme/generated-tokens";
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
  it.each(["EPUB", "PDF"] as const)("uses the shared reader navigation layout for %s", (format) => {
    renderTopBar(format);

    const navigation = screen.getByRole("navigation", { name: "阅读器顶部导航" });
    expect(navigation.closest("section")).toHaveAttribute("data-reader-layout", "shared");
    expect(navigation.closest("section")).toHaveAttribute("data-reader-format", format);
    expect(navigation.closest("section")).toHaveClass("bk-top-nav", "bk-reader-control-bar");
    expect(screen.getByRole("button", { name: "返回书库" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换书签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "阅读设置" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开笔记" })).toBeInTheDocument();
  });

  it("keeps the EPUB directory action as an optional capability", () => {
    renderTopBar("EPUB");
    expect(screen.getByRole("button", { name: "打开目录" })).toBeInTheDocument();
  });

  it("uses the same page frame as the global navigation", () => {
    renderTopBar("PDF");

    expect(screen.getByRole("navigation", { name: "阅读器顶部导航" })).toHaveStyle({ maxWidth: `${tokens.layout.contentMax}px` });
    expect(screen.getByText("山川与灯火").parentElement).toHaveStyle({ flex: "1 1 0%" });
  });
});
