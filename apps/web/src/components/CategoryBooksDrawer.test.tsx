import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import type { BrowseBook } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { CategoryBooksDrawer } from "./CategoryBooksDrawer";

const browseBook = (index: number): BrowseBook => ({
  id: demoBooks[index].id,
  title: demoBooks[index].title,
  author: demoBooks[index].author,
  description: demoBooks[index].description,
  format: demoBooks[index].format,
  coverUrl: demoBooks[index].coverUrl,
  available: true,
  addedAt: demoBooks[index].addedAt,
});

describe("CategoryBooksDrawer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("先累积多选变更，用户确认后才批量保存", async () => {
    vi.spyOn(api, "listBooks").mockResolvedValue({ items: [demoBooks[0], demoBooks[1]] });
    vi.spyOn(api, "listCategoryBooks").mockResolvedValue({ items: [browseBook(0)] });
    vi.spyOn(api, "listBookCategories").mockResolvedValue({ items: [], editable: true });
    const replace = vi.spyOn(api, "replaceBookCategories").mockResolvedValue({ items: [], editable: true });

    render(
      <TestProviders>
        <CategoryBooksDrawer open categoryId="category-literature" categoryName="文学与叙事" onClose={vi.fn()} />
      </TestProviders>,
    );

    const checkbox = await screen.findByRole("checkbox", { name: `加入 ${demoBooks[1].title}` });
    fireEvent.click(checkbox);
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "保存 1 项变更" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(demoBooks[1].id, ["category-literature"]));
  });
});
