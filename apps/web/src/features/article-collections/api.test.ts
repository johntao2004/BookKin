import { describe, expect, it, vi } from "vitest";
import { request } from "../../api/client";
import { articleCollections, isArticleCollectionRevisionConflict } from "./api";

vi.mock("../../api/client", () => ({ request: vi.fn() }));

describe("article collection API", () => {
  it("uses the revisioned CRUD, membership and ordering endpoints", async () => {
    const mockedRequest = vi.mocked(request);
    mockedRequest.mockResolvedValue({ items: [] } as never);
    await articleCollections.list({ q: "自然 阅读" });
    expect(mockedRequest).toHaveBeenLastCalledWith("/article-collections?q=%E8%87%AA%E7%84%B6+%E9%98%85%E8%AF%BB", expect.objectContaining({}));

    await articleCollections.create({ title: "自然", description: "说明", visibility: "PRIVATE" });
    expect(mockedRequest).toHaveBeenLastCalledWith("/article-collections", { method: "POST", body: JSON.stringify({ title: "自然", description: "说明", visibility: "PRIVATE" }) });
    await articleCollections.get("collection 1");
    expect(mockedRequest).toHaveBeenLastCalledWith("/article-collections/collection%201");
    await articleCollections.update("c1", { title: "自然", description: "说明", visibility: "MEMBERS" }, 4);
    expect(mockedRequest).toHaveBeenLastCalledWith("/article-collections/c1", { method: "PUT", body: JSON.stringify({ title: "自然", description: "说明", visibility: "MEMBERS", revision: 4 }) });
    await articleCollections.addArticles("c1", ["a1"], 5);
    expect(mockedRequest).toHaveBeenLastCalledWith("/article-collections/c1/articles", { method: "POST", body: JSON.stringify({ articleIds: ["a1"], revision: 5 }) });
    await articleCollections.removeArticle("c1", "a1", 6);
    expect(mockedRequest).toHaveBeenLastCalledWith("/article-collections/c1/articles/a1?revision=6", { method: "DELETE" });
    await articleCollections.reorder("c1", ["a2", "a1"], 7);
    expect(mockedRequest).toHaveBeenLastCalledWith("/article-collections/c1/order", { method: "PUT", body: JSON.stringify({ articleIds: ["a2", "a1"], revision: 7 }) });
    await articleCollections.remove("c1", 8);
    expect(mockedRequest).toHaveBeenLastCalledWith("/article-collections/c1?revision=8", { method: "DELETE" });
  });

  it("recognizes revision conflicts without masking other errors", () => {
    expect(isArticleCollectionRevisionConflict({ status: 409 })).toBe(true);
    expect(isArticleCollectionRevisionConflict({ code: "REVISION_CONFLICT" })).toBe(true);
    expect(isArticleCollectionRevisionConflict(new Error("offline"))).toBe(false);
  });
});

