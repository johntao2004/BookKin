import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { TestProviders } from "../test/TestProviders";
import { articleCollections, type ArticleCollectionDetail, type ArticleCollectionSummary } from "../features/article-collections/api";
import { ArticleCollectionsPage } from "./ArticleCollectionsPage";
import { ArticleCollectionDetailPage } from "./ArticleCollectionDetailPage";

vi.mock("../auth/permissions", () => ({
  usePermissions: () => ({ can: (permission: string) => permission === "articles.view" || permission === "articles.collections.edit" }),
}));

const member = { id: "member-1", username: "member", displayName: "成员", role: "MEMBER", mustChangePassword: false };
const article = { id: "article-1", title: "海边读书", author: "作者甲", source_url: "https://example.test", published_at: "", visibility: "PUBLIC" as const, tags: "阅读", cover_url: null, excerpt: "读书与海", created_at: "", updated_at: "" };
const own: ArticleCollectionSummary = { id: "own-collection", title: "我的周末", description: "私人阅读", visibility: "PRIVATE", ownerDisplayName: "成员", ownedByViewer: true, editable: true, articleCount: 1, previewArticles: [article], revision: 1, createdAt: "", updatedAt: "" };
const shared: ArticleCollectionSummary = { ...own, id: "shared-collection", title: "书库共读", visibility: "MEMBERS", ownerDisplayName: "书友", ownedByViewer: false, editable: false };
const ownDetail: ArticleCollectionDetail = { ...own, articles: [article] };

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{pathname}{search}</output>;
}

describe("ArticleCollectionsPage routes and visibility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify(member));
  });

  it("separates owned and shared collections and preserves list query parameters on return", async () => {
    vi.spyOn(articleCollections, "list").mockResolvedValue({ items: [own, shared] });
    vi.spyOn(articleCollections, "get").mockResolvedValue(ownDetail);

    render(<TestProviders initialPath="/article-collections?q=river&sort=updated"><Routes>
      <Route path="/article-collections" element={<><ArticleCollectionsPage /><LocationProbe /></>} />
      <Route path="/article-collections/:collectionId" element={<><ArticleCollectionDetailPage /><LocationProbe /></>} />
    </Routes></TestProviders>);

    expect(await screen.findByRole("heading", { name: "我的选集" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "书库共享" })).toBeInTheDocument();
    expect(screen.getByText("我的周末")).toBeInTheDocument();
    expect(screen.getByText("书库共读")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /我的周末/ }));

    expect(await screen.findByRole("heading", { name: "我的周末" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/article-collections/own-collection?from=%2Farticle-collections%3Fq%3Driver%26sort%3Dupdated"));
    fireEvent.click(screen.getByRole("link", { name: "返回选集列表" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/article-collections?q=river&sort=updated"));
  });

  it("shows collection management for an editable member collection without source article edit actions", async () => {
    vi.spyOn(articleCollections, "get").mockResolvedValue(ownDetail);
    render(<TestProviders initialPath="/article-collections/own-collection"><Routes>
      <Route path="/article-collections/:collectionId" element={<ArticleCollectionDetailPage />} />
    </Routes></TestProviders>);

    expect(await screen.findByRole("heading", { name: "我的周末" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "整理文章" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑选集" })).toBeInTheDocument();
    const articleMenu = screen.getByRole("button", { name: "海边读书更多操作" });
    fireEvent.click(articleMenu);
    expect(await screen.findByRole("menuitem", { name: "打开文章" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /编辑文章/ })).not.toBeInTheDocument();
  });
});
