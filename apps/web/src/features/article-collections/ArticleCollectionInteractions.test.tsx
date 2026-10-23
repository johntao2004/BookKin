import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../api/client";
import { TestProviders } from "../../test/TestProviders";
import { articles, type ArticleSummary } from "../content/api";
import { articleCollections, type ArticleCollectionDetail, type ArticleCollectionSummary } from "./api";
import { AddToArticleCollectionDialog } from "./AddToArticleCollectionDialog";
import { ArticleCollectionOrganizerDrawer } from "./ArticleCollectionOrganizerDrawer";

vi.mock("../../auth/permissions", () => ({
  usePermissions: () => ({ can: (permission: string) => permission === "articles.view" || permission === "articles.collections.edit" }),
}));

const member = { id: "member-1", username: "member", displayName: "成员", role: "MEMBER", mustChangePassword: false };
const articleA: ArticleSummary = { id: "article-a", title: "第一篇", author: "作者甲", source_url: "https://example.test/a", published_at: "", visibility: "PUBLIC", tags: "阅读", created_at: "", updated_at: "" };
const articleB: ArticleSummary = { ...articleA, id: "article-b", title: "第二篇", author: "作者乙" };
const articlePrivate: ArticleSummary = { ...articleA, id: "article-private", title: "私人文章", visibility: "PRIVATE" };

function summary(overrides: Partial<ArticleCollectionSummary> = {}): ArticleCollectionSummary {
  return { id: "collection-1", title: "周末阅读", description: "暂存文章", visibility: "PRIVATE", ownerDisplayName: "成员", ownedByViewer: true, editable: true, articleCount: 0, previewArticles: [], revision: 2, createdAt: "", updatedAt: "", ...overrides };
}
function detail(items: ArticleSummary[] = [], overrides: Partial<ArticleCollectionDetail> = {}): ArticleCollectionDetail {
  const base = summary({ articleCount: items.length });
  return { ...base, articles: items, ...overrides };
}
function asMember() {
  sessionStorage.clear();
  sessionStorage.setItem("bookkin-demo-session", JSON.stringify(member));
}

describe("article collection interactions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    asMember();
  });

  it("lets a member organize their collection without source article management permission", async () => {
    const visible = summary();
    const listed = vi.spyOn(articleCollections, "list").mockResolvedValue({ items: [visible] });
    const get = vi.spyOn(articleCollections, "get").mockResolvedValue(detail());
    const add = vi.spyOn(articleCollections, "addArticles").mockResolvedValue(detail([articleA]));
    const onSaved = vi.fn();

    render(<TestProviders><AddToArticleCollectionDialog articleId={articleA.id} articleTitle={articleA.title} articleVisibility={articleA.visibility} open onClose={vi.fn()} onSaved={onSaved} /></TestProviders>);
    expect(await screen.findByText("周末阅读")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加入" }));

    await waitFor(() => expect(add).toHaveBeenCalledWith(visible.id, [articleA.id], detail().revision));
    expect(get).toHaveBeenCalledWith(visible.id);
    expect(listed).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ articles: [articleA] }), expect.stringContaining("已将"));
  });

  it("blocks private articles from shared collections and avoids claiming success for duplicates or failures", async () => {
    const shared = summary({ visibility: "MEMBERS" });
    vi.spyOn(articleCollections, "list").mockResolvedValue({ items: [shared] });
    const add = vi.spyOn(articleCollections, "addArticles").mockRejectedValue(new Error("server rejected"));
    const onSaved = vi.fn();
    const view = render(<TestProviders><AddToArticleCollectionDialog articleId={articlePrivate.id} articleTitle={articlePrivate.title} articleVisibility="PRIVATE" open onClose={vi.fn()} onSaved={onSaved} /></TestProviders>);
    expect(await screen.findByText("周末阅读")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "不可加入" })).toBeDisabled();
    expect(screen.getByText("仅自己的文章不能加入共享选集")).toBeInTheDocument();
    expect(add).not.toHaveBeenCalled();
    view.unmount();

    vi.spyOn(articleCollections, "list").mockResolvedValue({ items: [summary()] });
    vi.spyOn(articleCollections, "get").mockResolvedValue(detail([articleA]));
    const duplicateAdd = vi.spyOn(articleCollections, "addArticles");
    render(<TestProviders><AddToArticleCollectionDialog articleId={articleA.id} articleTitle={articleA.title} open onClose={vi.fn()} onSaved={onSaved} /></TestProviders>);
    expect(await screen.findByText("周末阅读")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加入" }));
    expect(await screen.findByText(/已经在“周末阅读”中/)).toBeInTheDocument();
    expect(duplicateAdd).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("adds, removes and reorders article references with current revisions", async () => {
    const initial = detail([articleA]);
    const source = vi.spyOn(articles, "list").mockResolvedValue([articleA, articleB]);
    const add = vi.spyOn(articleCollections, "addArticles").mockResolvedValue(detail([articleA, articleB], { revision: 3 }));
    const remove = vi.spyOn(articleCollections, "removeArticle").mockResolvedValue(detail([articleB], { revision: 5 }));
    const reorder = vi.spyOn(articleCollections, "reorder").mockResolvedValue(detail([articleB, articleA], { revision: 4 }));
    const changed = vi.fn();

    render(<TestProviders><ArticleCollectionOrganizerDrawer open collection={initial} onClose={vi.fn()} onChanged={changed} /></TestProviders>);
    expect(await screen.findByText("第二篇")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加入" }));
    await waitFor(() => expect(add).toHaveBeenCalledWith(initial.id, [articleB.id], initial.revision));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(expect.objectContaining({ revision: 3 }), expect.stringContaining("加入选集")));

    fireEvent.click(screen.getByRole("button", { name: "下移 第一篇" }));
    fireEvent.click(screen.getByRole("button", { name: "保存顺序" }));
    await waitFor(() => expect(reorder).toHaveBeenCalledWith(initial.id, [articleB.id, articleA.id], 3));

    fireEvent.click(screen.getByRole("button", { name: "移出 第一篇" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(initial.id, articleA.id, 4));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(expect.objectContaining({ revision: 5 }), expect.stringContaining("移出选集")));
    expect(source).toHaveBeenCalled();
  });

  it("refreshes a stale membership revision but keeps an edited order draft for explicit retry", async () => {
    const initial = detail([articleA, articleB]);
    const latest = detail([articleA, articleB], { revision: 9 });
    vi.spyOn(articles, "list").mockResolvedValue([articleA, articleB]);
    const reorder = vi.spyOn(articleCollections, "reorder")
      .mockRejectedValueOnce(new ApiRequestError("Revision conflict", 409))
      .mockResolvedValueOnce(detail([articleB, articleA], { revision: 10 }));
    const get = vi.spyOn(articleCollections, "get").mockResolvedValue(latest);
    render(<TestProviders><ArticleCollectionOrganizerDrawer open collection={initial} onClose={vi.fn()} onChanged={vi.fn()} /></TestProviders>);

    await screen.findAllByText("第二篇");
    fireEvent.click(screen.getByRole("button", { name: "下移 第一篇" }));
    fireEvent.click(screen.getByRole("button", { name: "保存顺序" }));
    expect(await screen.findByText(/当前顺序草稿保留/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(initial.id);
    expect(screen.getByRole("button", { name: "保存顺序" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "保存顺序" }));

    await waitFor(() => expect(reorder).toHaveBeenLastCalledWith(initial.id, [articleB.id, articleA.id], latest.revision));
  });
});
