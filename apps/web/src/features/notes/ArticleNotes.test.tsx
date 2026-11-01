import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "../../test/TestProviders";
import { articleNotesApi } from "./api";
import { ArticleNotes } from "./ArticleNotes";

afterEach(() => vi.restoreAllMocks());

describe("ArticleNotes grouped presentation", () => {
  it("shows a located passage once and retains every distinct note beside it", async () => {
    vi.spyOn(articleNotesApi, "list").mockResolvedValue([{
      articleId: "article-1",
      title: "潮汐之间",
      author: "林予",
      annotations: [
        { id: "highlight-1", type: "HIGHLIGHT", quote: "同一段原文", note: "", locator: "p-8&offset=2", createdAt: "2026-10-22T09:00:00Z", style: "HIGHLIGHT" },
        { id: "note-1", type: "NOTE", quote: " 同一段原文 ", note: "第一条想法", locator: "p-8&offset=2", createdAt: "2026-10-22T10:00:00Z", style: "HIGHLIGHT" },
        { id: "note-2", type: "NOTE", quote: "同一段原文", note: "第二条想法", locator: "p-8&offset=2", createdAt: "2026-10-22T11:00:00Z", style: "HIGHLIGHT" },
      ],
    }]);

    render(
      <TestProviders initialPath="/annotations/articles?articleId=article-1">
        <ArticleNotes userId="user-1" articleId="article-1" onOpen={vi.fn()} />
      </TestProviders>,
    );

    expect(await screen.findByRole("heading", { name: "潮汐之间" })).toBeInTheDocument();
    expect(screen.getAllByText("同一段原文", { exact: true })).toHaveLength(1);
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "第二条想法\n\n第一条想法")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回原文" })).toHaveAttribute("href", "/articles/article-1?locator=p-8%26offset%3D2");
  });
});
