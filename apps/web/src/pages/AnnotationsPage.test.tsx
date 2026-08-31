import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import type { Annotation } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { AnnotationsPage } from "./AnnotationsPage";

const bookId = demoBooks[0].id;
const entries: Annotation[] = [{
  id: "note-1",
  bookId,
  bookTitle: demoBooks[0].title,
  bookAuthor: demoBooks[0].author,
  type: "NOTE",
  locator: "epubcfi(/6/2!/4/2)",
  quote: "把一天的光慢慢折进书页",
  note: "这是我想保留的一句话。",
  style: "HIGHLIGHT",
  color: "YELLOW",
  createdAt: "2026-08-21T03:00:00Z",
  updatedAt: "2026-08-21T03:00:00Z",
}];

describe("AnnotationsPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({ id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false }));
    vi.spyOn(api, "listAnnotationBooks").mockResolvedValue({ items: [{
      bookId,
      bookTitle: demoBooks[0].title,
      bookAuthor: demoBooks[0].author,
      coverUrl: demoBooks[0].coverUrl,
      annotationCount: 1,
      noteCount: 1,
      highlightCount: 1,
      underlineCount: 0,
      boldCount: 0,
      latestAt: "2026-08-21T03:00:00Z",
    }] });
    vi.spyOn(api, "getBook").mockResolvedValue(demoBooks[0]);
    vi.spyOn(api, "listAnnotations").mockResolvedValue(entries);
  });

  afterEach(() => vi.restoreAllMocks());

  it("groups annotations by book and opens the selected book's notes", async () => {
    render(<TestProviders initialPath="/annotations"><Routes><Route path="/annotations" element={<AnnotationsPage />} /></Routes></TestProviders>);

    expect(await screen.findByRole("heading", { name: "阅读笔记" })).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE NOTES")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: `查看《${demoBooks[0].title}》的阅读笔记` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `查看《${demoBooks[0].title}》的阅读笔记` }));

    expect(await screen.findByRole("heading", { name: demoBooks[0].title })).toBeInTheDocument();
    expect(screen.queryByText("BOOK NOTES")).not.toBeInTheDocument();
    expect(await screen.findByText("把一天的光慢慢折进书页")).toBeInTheDocument();
    expect(screen.getByText("这是我想保留的一句话。")).toBeInTheDocument();
    expect(api.listAnnotations).toHaveBeenCalledWith(bookId);
  });

  it("exports the selected book's notes as Word", async () => {
    vi.spyOn(api, "downloadAnnotationExport").mockResolvedValue("《山川与灯火》阅读笔记.docx");
    render(<TestProviders initialPath={`/annotations?bookId=${bookId}`}><Routes><Route path="/annotations" element={<AnnotationsPage />} /></Routes></TestProviders>);

    fireEvent.click(await screen.findByRole("button", { name: "导出 Word" }));

    await waitFor(() => expect(api.downloadAnnotationExport).toHaveBeenCalledWith(bookId, "DOCX"));
    expect(await screen.findByText("已导出 《山川与灯火》阅读笔记.docx")).toBeInTheDocument();
  });
});
