import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { TestProviders } from "../test/TestProviders";
import { ReaderPage } from "./ReaderPage";
import { readerSelectionFromRect } from "../components/readers/types";

describe("ReaderPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({
      id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false,
    }));
  });

  afterEach(() => vi.restoreAllMocks());

  it("anchors the annotation toolbar beside the selected text", () => {
    const selection = readerSelectionFromRect({
      quote: "选中的一句话",
      locator: "epubcfi(/6/14!/4/2)",
      rect: { left: 240, right: 640, top: 520, bottom: 582, width: 400, height: 62 },
      frameRect: { left: 120, top: 74 },
    });

    expect(selection).toMatchObject({ x: 560, y: 586, placement: "ABOVE" });
  });

  it("places the annotation toolbar below a selection near the top edge", () => {
    const selection = readerSelectionFromRect({
      quote: "页首文字",
      locator: "pdf:page=1",
      rect: { left: 100, right: 260, top: 26, bottom: 58, width: 160, height: 32 },
    });

    expect(selection).toMatchObject({ y: 66, placement: "BELOW" });
  });

  it("applies the chosen highlight color directly from the selection toolbar", async () => {
    const removeAllRanges = vi.fn();
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "黄昏从山脊落下来时",
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 120, width: 160, top: 220 }) }),
      removeAllRanges,
    } as unknown as Selection);

    render(<TestProviders initialPath="/reader/book-1"><Routes><Route path="/reader/:bookId" element={<ReaderPage />} /></Routes></TestProviders>);
    await screen.findByRole("heading", { name: "灯下" });
    fireEvent.mouseUp(screen.getByRole("article"));

    expect(screen.queryByRole("button", { name: "高亮" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "使用粉色荧光笔高亮" }));

    await waitFor(() => expect(screen.getByText("高亮已私人同步")).toBeInTheDocument());
    expect(screen.getByText("黄昏从山脊落下来时", { selector: "mark" })).toHaveAttribute("data-highlight-color", "PINK");
    expect(screen.queryByRole("toolbar", { name: "批注工具" })).not.toBeInTheDocument();
    expect(removeAllRanges).toHaveBeenCalled();
  });

  it("turns a text selection into a private highlight and note", async () => {
    const removeAllRanges = vi.fn();
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "河面先暗了一层",
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 120, width: 160, top: 220 }) }),
      removeAllRanges,
    } as unknown as Selection);

    render(<TestProviders initialPath="/reader/book-1"><Routes><Route path="/reader/:bookId" element={<ReaderPage />} /></Routes></TestProviders>);
    await screen.findByRole("heading", { name: "灯下" });
    fireEvent.mouseUp(screen.getByRole("article"));
    expect(screen.getByRole("toolbar", { name: "批注工具" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "高亮" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下划线" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "加粗" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "高亮＋笔记" }));
    expect(screen.getByRole("button", { name: "选择黄色荧光笔" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "选择粉色荧光笔" }));
    expect(screen.getByRole("button", { name: "选择粉色荧光笔" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("写下这段文字带来的想法"), { target: { value: "记住这层暮色。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存笔记" }));

    await waitFor(() => expect(screen.getByText("高亮和笔记已私人同步")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "高亮并写笔记" })).not.toBeInTheDocument());
    expect(screen.getByText("河面先暗了一层", { selector: "mark" })).toHaveAttribute("data-highlight-color", "PINK");
    fireEvent.click(screen.getByRole("button", { name: "打开笔记" }));
    expect(await screen.findByText("高亮笔记")).toBeInTheDocument();
    expect(await screen.findByText("“河面先暗了一层”")).toBeInTheDocument();
    expect(screen.getByText("记住这层暮色。")).toBeInTheDocument();
    expect(removeAllRanges).toHaveBeenCalled();
  });

  it("saves an underline directly from the selection toolbar", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "木桨在水里划出细长的纹路",
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 180, width: 210, top: 260 }) }),
      removeAllRanges: vi.fn(),
    } as unknown as Selection);

    render(<TestProviders initialPath="/reader/book-1"><Routes><Route path="/reader/:bookId" element={<ReaderPage />} /></Routes></TestProviders>);
    await screen.findByRole("heading", { name: "灯下" });
    fireEvent.mouseUp(screen.getByRole("article"));
    fireEvent.click(screen.getByRole("button", { name: "下划线" }));

    await waitFor(() => expect(screen.getByText("下划线已私人同步")).toBeInTheDocument());
    expect(screen.getByText("木桨在水里划出细长的纹路", { selector: "mark" })).toHaveStyle({ textDecoration: "underline" });
    fireEvent.click(screen.getByRole("button", { name: "打开笔记" }));
    expect(await screen.findByText("下划线")).toBeInTheDocument();
  });

  it("applies bold to the selected reader text immediately", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "像有人把一天的光慢慢折进书页",
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 180, width: 240, top: 260 }) }),
      removeAllRanges: vi.fn(),
    } as unknown as Selection);

    render(<TestProviders initialPath="/reader/book-1"><Routes><Route path="/reader/:bookId" element={<ReaderPage />} /></Routes></TestProviders>);
    await screen.findByRole("heading", { name: "灯下" });
    fireEvent.mouseUp(screen.getByRole("article"));
    fireEvent.click(screen.getByRole("button", { name: "加粗" }));

    await waitFor(() => expect(screen.getByText("加粗已私人同步")).toBeInTheDocument());
    expect(screen.getByText("像有人把一天的光慢慢折进书页", { selector: "mark" })).toHaveStyle({ fontWeight: "700" });
  });

  it("shares the reader theme choice with the whole site", async () => {
    render(<TestProviders initialPath="/reader/book-1"><Routes><Route path="/reader/:bookId" element={<ReaderPage />} /></Routes></TestProviders>);
    await screen.findByRole("heading", { name: "灯下" });

    fireEvent.click(screen.getByRole("button", { name: "阅读设置" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "夜间" }));

    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-bookkin-theme", "night"));
    expect(localStorage.getItem("bookkin-site-theme")).toBe("NIGHT");
  });

  it("persists the page-turn effect switch in reader settings", async () => {
    render(<TestProviders initialPath="/reader/book-1"><Routes><Route path="/reader/:bookId" element={<ReaderPage />} /></Routes></TestProviders>);
    await screen.findByRole("heading", { name: "灯下" });

    fireEvent.click(screen.getByRole("button", { name: "阅读设置" }));
    const toggle = screen.getByRole("switch", { name: "启用翻页效果" });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("bookkin-reader-settings:user-owner") ?? "null")).toMatchObject({
      pageTurnEnabled: false,
    }));
    expect(screen.getByText("关闭后直接切换页面")).toBeInTheDocument();
  });

  it("returns signed-in readers to the complete private catalog", async () => {
    render(
      <TestProviders initialPath="/reader/book-1">
        <Routes>
          <Route path="/reader/:bookId" element={<ReaderPage />} />
          <Route path="/library/all" element={<div>全部书籍页</div>} />
        </Routes>
      </TestProviders>,
    );
    await screen.findByRole("heading", { name: "灯下" });

    fireEvent.click(screen.getByRole("button", { name: "返回全部书籍" }));

    expect(await screen.findByText("全部书籍页")).toBeInTheDocument();
  });

  it("returns guest readers to the public library", async () => {
    sessionStorage.clear();
    render(
      <TestProviders initialPath="/reader/book-1">
        <Routes>
          <Route path="/reader/:bookId" element={<ReaderPage />} />
          <Route path="/library" element={<div>公开书库页</div>} />
        </Routes>
      </TestProviders>,
    );
    await screen.findByRole("heading", { name: "灯下" });

    fireEvent.click(screen.getByRole("button", { name: "返回书库" }));

    expect(await screen.findByText("公开书库页")).toBeInTheDocument();
  });
});
