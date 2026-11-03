import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { api, ApiRequestError } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { PublicLibraryPage } from "./PublicLibraryPage";
import { BookDetailPage } from "./BookDetailPage";

const book = { id: "public-1", title: "公开书籍", author: "作者", description: "公开内容简介", format: "PDF" as const, coverUrl: "/cover.jpg", available: true, sortOrder: 1 };
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function renderPublic(path = "/library?q=公开&format=PDF") {
  return render(<TestProviders initialPath={path}><Routes>
    <Route path="/library" element={<PublicLibraryPage />} />
    <Route path="/library/books/:bookId" element={<BookDetailPage />} />
    <Route path="/reader/:bookId" element={<div>阅读目标</div>} />
  </Routes><Location /></TestProviders>);
}
beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(api, "listDisplayBooks").mockResolvedValue({ items: [book], revision: 1 });
  vi.spyOn(api, "getDisplayBook").mockResolvedValue(book);
  vi.spyOn(api, "getDisplayBookMetadata").mockResolvedValue({ id: book.id, title: book.title, authors: [book.author], translators: [], description: book.description, tags: [], subjectCodes: [], sources: {} });
  vi.spyOn(api, "getDisplayBookBibliographySource").mockResolvedValue({});
});
afterEach(() => vi.restoreAllMocks());

it.each(["cover", "menu"])("opens public book details from the %s and preserves catalog filters", async entry => {
  const privateBook = vi.spyOn(api, "getBook");
  const metadata = vi.spyOn(api, "getBookMetadata");
  renderPublic();
  const cover = await screen.findByRole("button", { name: "公开书籍封面" });
  if (entry === "cover") fireEvent.click(cover);
  else {
    fireEvent.click(screen.getByRole("button", { name: "公开书籍更多操作" }));
    expect(screen.queryByRole("menuitem", { name: "开始阅读" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("menuitem", { name: "前往详情页" }));
  }
  expect(await screen.findByRole("heading", { name: "公开书籍", level: 2 })).toBeInTheDocument();
  expect(screen.getByTestId("location")).toHaveTextContent("/library/books/public-1");
  expect(screen.getByText("公开内容简介")).toBeInTheDocument();
  expect(privateBook).not.toHaveBeenCalled();
  expect(metadata).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "返回书库" }));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/library?q=公开&format=PDF"));
});

it("starts public reading only from the detail action", async () => {
  renderPublic("/library/books/public-1");
  fireEvent.click(await screen.findByRole("button", { name: "开始阅读" }));
  expect(await screen.findByText("阅读目标")).toBeInTheDocument();
});

it("does not fall back to private APIs for an unpublished book", async () => {
  vi.mocked(api.getDisplayBook).mockRejectedValue(new ApiRequestError("未找到公开书籍", 404, "DISPLAY_BOOK_NOT_FOUND"));
  const privateBook = vi.spyOn(api, "getBook");
  const metadata = vi.spyOn(api, "getBookMetadata");
  renderPublic("/library/books/private-1");
  expect(await screen.findByRole("heading", { name: "404" })).toBeInTheDocument();
  expect(privateBook).not.toHaveBeenCalled();
  expect(metadata).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "开始阅读" })).not.toBeInTheDocument();
});


it("shows complete public bibliography with a content-width format tag and only public source queries", async () => {
  vi.mocked(api.getDisplayBookMetadata).mockResolvedValue({ id: book.id, title: "完整书名", subtitle: "副标题", authors: ["甲", "乙"], translators: ["译者姓名"], language: "ru", publisher: "公开出版社", publishedDate: "2020", isbn: "9780000000000", series: "丛书名", seriesIndex: 2, tags: ["俄语标签"], subjectCodes: ["F"], sources: {} });
  vi.mocked(api.getDisplayBookBibliographySource).mockResolvedValue({ description: "原书简介", authorBiography: "原书作者介绍" });
  const privateMetadata = vi.spyOn(api, "getBookMetadata");
  const privateSource = vi.spyOn(api, "getBookBibliographySource");
  renderPublic("/library/books/public-1");
  expect(await screen.findByRole("heading", { name: "完整书名" })).toBeInTheDocument();
  for (const text of ["副标题", "甲 / 乙", "译者姓名", "公开出版社", "9780000000000", "丛书名", "俄语标签", "原书简介", "原书作者介绍"]) expect(await screen.findByText(text)).toBeInTheDocument();
  const tag = screen.getByText("PDF");
  expect(tag.parentElement).toHaveStyle({ display: "flex", flexDirection: "row" });
  expect(tag).toHaveStyle({ maxWidth: "100%" });
  expect(privateMetadata).not.toHaveBeenCalled();
  expect(privateSource).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "目录" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "编辑元信息" })).not.toBeInTheDocument();
});

it("keeps manual empty bibliography fields instead of replacing them with source values", async () => {
  vi.mocked(api.getDisplayBookMetadata).mockResolvedValue({ id: book.id, title: book.title, authors: [book.author], translators: [], tags: [], sources: { description: "MANUAL", authorBiography: "MANUAL" } });
  renderPublic("/library/books/public-1");
  await screen.findByRole("heading", { name: book.title, level: 2 });
  await waitFor(() => expect(screen.queryByLabelText("正在加载元数据")).not.toBeInTheDocument());
  expect(api.getDisplayBookBibliographySource).not.toHaveBeenCalled();
  expect(screen.queryByText("公开内容简介")).not.toBeInTheDocument();
});
