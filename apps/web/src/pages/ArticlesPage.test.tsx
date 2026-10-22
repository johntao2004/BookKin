import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { articles, type ArticleSummary } from "../features/content/api";
import { TestProviders } from "../test/TestProviders";
import { ArticlesPage } from "./ArticlesPage";
import * as imageImport from "../features/content/imageImport";
import * as themeModule from "../theme/theme";
import { ApiRequestError } from "../api/client";

const article: ArticleSummary = {
  id: "article-one", title: "秋日书信", author: "林", source_url: "https://example.com/article",
  published_at: "", visibility: "PUBLIC", tags: "随笔", created_at: "", updated_at: "",
  cover_url: "/api/v1/articles/assets/56c307d8-d160-497c-96f1-17bab1e3f9c4", excerpt: "从一封书信开始的阅读。",
};

describe("ArticlesPage shared catalog", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({
      id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false,
    }));
    vi.spyOn(articles, "list").mockResolvedValue([article]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.removeItem("bookkin-demo-session");
  });

  it("shows load failures as a diagnostic error page and restores the list after retry", async () => {
    vi.mocked(articles.list).mockRejectedValueOnce(new ApiRequestError("文章服务暂时不可用", 503, "ARTICLES_UNAVAILABLE", "article-trace-123456"));
    render(<TestProviders><ArticlesPage /></TestProviders>);
    expect(await screen.findByRole("alert", {name:"错误页面"})).toHaveTextContent("503");
    expect(screen.getByRole("alert")).toHaveTextContent("ARTICLES_UNAVAILABLE");
    expect(screen.getByRole("alert")).toHaveTextContent("article-trace-123456");
    fireEvent.click(screen.getByRole("button", {name:"重试"}));
    expect(await screen.findByRole("region", {name:"文章列表"})).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows shared image cards, filters them and puts editing in the shared menu", async () => {
    const get = vi.spyOn(articles, "get").mockResolvedValue({ ...article, html: "<p>正文</p>" });
    render(<TestProviders><ArticlesPage /></TestProviders>);
    const list = await screen.findByRole("region", { name: "文章列表" });
    expect(within(list).getByRole("img", { name: "秋日书信封面" })).toHaveAttribute("src", article.cover_url);
    expect(within(list).queryByText(article.excerpt!)).not.toBeInTheDocument();
    expect(within(list).getByText(article.author)).toBeVisible();
    expect(within(list).getByText("公开")).toBeVisible();
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "编辑文章" })).not.toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: "秋日书信更多操作" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "编辑文章" }));
    expect(within(await screen.findByRole("dialog")).getByRole("heading", { name: "编辑文章" })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(article.id);
    expect(screen.getByRole("img", { name: "文章封面预览" })).toHaveAttribute("src", article.cover_url);
    for (const label of ["文章标题", "作者", "分类 / 标签", "来源链接（可选）", "发布时间（可选）"]) {
      expect(within(screen.getByRole("dialog")).getByText(label, { selector: "label" })).toBeVisible();
    }
  });

  it("does not delete an article when the confirmation is cancelled", async () => {
    const createTheme = themeModule.createAntdTheme;
    vi.spyOn(themeModule, "createAntdTheme").mockImplementation(mode => {
      const theme = createTheme(mode);
      return { ...theme, token: { ...theme.token, motion: false } };
    });
    const remove = vi.spyOn(articles, "remove").mockResolvedValue(undefined);
    render(<TestProviders><ArticlesPage /></TestProviders>);
    await screen.findByRole("region", { name: "文章列表" });
    fireEvent.click(screen.getByRole("button", { name: "秋日书信更多操作" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "删除文章" }));

    const confirmation = await screen.findByRole("dialog");
    expect(within(confirmation).getByText("文章阅读记录及笔记也会删除。")).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: /取\s*消/ }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(remove).not.toHaveBeenCalled();
  });

  it("opens link capture only after 新增文章 and transfers a fetched draft into review", async () => {
    const fetch = vi.spyOn(articles, "fetch").mockResolvedValue({
      title: "抓取文章", author: "作者", sourceUrl: article.source_url, publishedAt: "2026-10-22 09:30:00 +08:00", visibility: "PUBLIC", tags: "", html: "<p>抓取正文</p>",
    });
    render(<TestProviders><ArticlesPage /></TestProviders>);
    await screen.findByRole("region", { name: "文章列表" });
    expect(screen.queryByRole("textbox", { name: "网页链接" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "手动导入" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "新增文章" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "新增文章" })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "网页链接" }), { target: { value: article.source_url } });
    fireEvent.submit(within(dialog).getByRole("textbox", { name: "网页链接" }).closest("form")!);
    expect(await screen.findByRole("heading", { name: "导入文章" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(article.source_url);
    expect(screen.getByRole("textbox", { name: "文章标题" })).toHaveValue("抓取文章");
    const publishedAt = screen.getByRole("textbox", { name: /^发布时间$/ });
    expect(publishedAt).toHaveValue("2026-10-22 09:30:00 +08:00");
    fireEvent.change(publishedAt, { target: { value: "2026-10-21" } });
    const save = vi.spyOn(articles, "save").mockResolvedValue({ ...article, published_at: "2026-10-21", html: "<p>抓取正文</p>" });
    fireEvent.click(screen.getByRole("button", { name: /^保存$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ publishedAt: "2026-10-21" }), undefined));
  });

  it("keeps manual import available inside the add-article drawer", async () => {
    render(<TestProviders><ArticlesPage /></TestProviders>);
    fireEvent.click(screen.getByRole("button", { name: "新增文章" }));
    const capture = await screen.findByRole("dialog");
    fireEvent.click(within(capture).getByRole("button", { name: "手动导入" }));
    expect(await screen.findByRole("heading", { name: "导入文章" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "文章标题" })).toHaveValue("");
  });

  it("keeps the captured cover separate and clears it without changing the body", async () => {
    const bodyImage = "/api/v1/articles/assets/00000000-0000-4000-8000-000000000001";
    vi.spyOn(articles, "fetch").mockResolvedValue({
      title: "图文文章", author: "作者", sourceUrl: article.source_url, publishedAt: "", visibility: "PUBLIC", tags: "",
      coverUrl: article.cover_url || "", html: `<p>正文</p><img src="${bodyImage}" alt="正文插图">`,
    });
    const save = vi.spyOn(articles, "save").mockResolvedValue({ ...article, html: "<p>正文</p>" });
    render(<TestProviders><ArticlesPage /></TestProviders>);
    fireEvent.click(screen.getByRole("button", { name: "新增文章" }));
    const input = await screen.findByRole("textbox", { name: "网页链接" });
    fireEvent.change(input, { target: { value: article.source_url } });
    fireEvent.submit(input.closest("form")!);
    await screen.findByRole("heading", { name: "导入文章" });
    expect(within(screen.getByRole("region", { name: "封面" })).getByRole("img")).toHaveAttribute("src", article.cover_url);
    const editor = screen.getByRole("textbox", { name: "文章正文" });
    expect((editor as HTMLTextAreaElement).value).toContain(bodyImage);
    fireEvent.change(editor, { target: { value: (editor as HTMLTextAreaElement).value + "\n\n未保存的修改" } });
    fireEvent.click(screen.getByRole("button", { name: "移除封面" }));
    expect((editor as HTMLTextAreaElement).value).toContain("未保存的修改");
    expect(screen.queryByRole("img", { name: "文章封面预览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "正文文件" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上传图片" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "正文图片" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("插入文章图片")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^保存$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      coverUrl: "", html: expect.stringContaining("未保存的修改"),
    }), undefined));
  });

  it("renders Markdown and automatically imports linked images before preview and save", async () => {
    const image = "/api/v1/articles/assets/00000000-0000-4000-8000-000000000001";
    const prepare = vi.spyOn(articles, "prepare").mockResolvedValue({ html: `<h1>Markdown 标题</h1><p><strong>加粗</strong></p><img src="${image}" alt="自动配图">` });
    const save = vi.spyOn(articles, "save").mockResolvedValue({ ...article, html: "<p>正文</p>" });
    render(<TestProviders><ArticlesPage /></TestProviders>);
    fireEvent.click(screen.getByRole("button", { name: "新增文章" }));
    fireEvent.click(await screen.findByRole("button", { name: "手动导入" }));
    fireEvent.change(screen.getByRole("textbox", { name: "文章标题" }), { target: { value: "Markdown 文章" } });
    fireEvent.change(screen.getByRole("textbox", { name: "文章正文" }), { target: { value: "# Markdown 标题\n\n**加粗**\n\n![自动配图](https://example.com/image.png)" } });
    fireEvent.click(screen.getByRole("button", { name: /^预览$/ }));
    const preview = await screen.findByRole("region", { name: "文章正文预览" });
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("<h1>Markdown 标题</h1>"), "");
    expect(vi.mocked(prepare).mock.calls[0][0]).toContain('data-src="https://example.com/image.png"');
    expect(within(preview).getByRole("heading", { name: "Markdown 标题" })).toBeInTheDocument();
    expect(within(preview).getByRole("img", { name: "自动配图" })).toHaveAttribute("src", image);
    fireEvent.click(screen.getByRole("button", { name: /^编辑$/ }));
    expect((screen.getByRole("textbox", { name: "文章正文" }) as HTMLTextAreaElement).value).toContain(image);
    fireEvent.click(await screen.findByRole("button", { name: /^保存$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining(image) }), undefined));
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("uploads a body image through the server and preserves it across source, preview and save", async () => {
    const asset = "/api/v1/articles/assets/00000000-0000-4000-8000-000000000001";
    const localImage = document.createElement("img");
    localImage.src = "data:image/png;base64,dGVzdA==";
    localImage.alt = "正文配图";
    vi.spyOn(imageImport, "readArticleImage").mockResolvedValue(localImage);
    const prepare = vi.spyOn(articles, "prepare").mockResolvedValue({ html: `<img src="${asset}" alt="正文配图">` });
    const save = vi.spyOn(articles, "save").mockResolvedValue({ ...article, html: "<p>正文</p>" });
    render(<TestProviders><ArticlesPage /></TestProviders>);
    fireEvent.click(screen.getByRole("button", { name: "新增文章" }));
    fireEvent.click(await screen.findByRole("button", { name: "手动导入" }));
    fireEvent.change(screen.getByRole("textbox", { name: "文章标题" }), { target: { value: "带图片的文章" } });
    const editor = screen.getByRole("textbox", { name: "文章正文" }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "# 文章标题\n\n前文\n\n后文" } });
    editor.setSelectionRange(editor.value.indexOf("后文"), editor.value.indexOf("后文"));
    fireEvent.select(editor);
    fireEvent.change(screen.getByLabelText("上传正文图片"), { target: { files: [new File(["test"], "配图.png", { type: "image/png" })] } });
    await waitFor(() => expect(editor.value).toContain(asset));
    expect(editor.value.indexOf("前文")).toBeLessThan(editor.value.indexOf(asset));
    expect(editor.value.indexOf(asset)).toBeLessThan(editor.value.indexOf("后文"));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining(localImage.src), "");
    const source = editor.value;
    fireEvent.click(screen.getByRole("button", { name: /^预览$/ }));
    const preview = await screen.findByRole("region", { name: "文章正文预览" });
    expect(within(preview).getByRole("heading", { name: "文章标题" })).toBeInTheDocument();
    expect(within(preview).getByRole("img", { name: "正文配图" })).toHaveAttribute("src", asset);
    expect(screen.queryByRole("button", { name: "上传图片" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^编辑$/ }));
    expect(screen.getByRole("textbox", { name: "文章正文" })).toHaveValue(source);
    fireEvent.click(screen.getByRole("button", { name: /^保存$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining(asset), coverUrl: "" }), undefined));
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("reports invalid image uploads without losing the current Markdown", async () => {
    vi.spyOn(imageImport, "readArticleImage").mockRejectedValue(new Error("图片不能超过 5 MB。"));
    render(<TestProviders><ArticlesPage /></TestProviders>);
    fireEvent.click(screen.getByRole("button", { name: "新增文章" }));
    fireEvent.click(await screen.findByRole("button", { name: "手动导入" }));
    fireEvent.change(screen.getByRole("textbox", { name: "文章正文" }), { target: { value: "保留未保存正文" } });
    fireEvent.change(screen.getByLabelText("上传正文图片"), { target: { files: [new File(["test"], "配图.png", { type: "image/png" })] } });
    expect(await within(screen.getByRole("dialog")).findByText("图片不能超过 5 MB。")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "文章正文" })).toHaveValue("保留未保存正文");
  });

  it("retains the entered link and capture drawer when fetching fails", async () => {
    vi.spyOn(articles, "fetch").mockRejectedValue(new Error("网页暂时不可用"));
    render(<TestProviders><ArticlesPage /></TestProviders>);
    fireEvent.click(screen.getByRole("button", { name: "新增文章" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "新增文章" })).toBeInTheDocument();
    const input = within(dialog).getByRole("textbox", { name: "网页链接" });
    fireEvent.change(input, { target: { value: article.source_url } });
    fireEvent.submit(input.closest("form")!);
    expect(await within(dialog).findByText("网页暂时不可用")).toBeInTheDocument();
    expect(input).toHaveValue(article.source_url);
  });

  it("shows duplicate-link feedback in the capture drawer without losing the URL", async () => {
    const message = "已有相同来源链接的文章，请在文章列表中查看或编辑。";
    vi.spyOn(articles, "fetch").mockRejectedValue(new Error(message));
    render(<TestProviders><ArticlesPage /></TestProviders>);
    fireEvent.click(screen.getByRole("button", { name: "新增文章" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("textbox", { name: "网页链接" });
    fireEvent.change(input, { target: { value: article.source_url } });
    fireEvent.submit(input.closest("form")!);
    expect(await within(dialog).findByText(message)).toBeVisible();
    expect(input).toHaveValue(article.source_url);
    expect(screen.queryByRole("heading", { name: "导入文章" })).not.toBeInTheDocument();
  });

  it("retains the draft and allows correction after a duplicate-body rejection", async () => {
    const message = "已有相同正文的文章，无需重复导入。";
    const save = vi.spyOn(articles, "save").mockRejectedValueOnce(new Error(message))
      .mockResolvedValueOnce({ ...article, html: "<p>不同的正文</p>" });
    render(<TestProviders><ArticlesPage /></TestProviders>);
    fireEvent.click(screen.getByRole("button", { name: "新增文章" }));
    fireEvent.click(await screen.findByRole("button", { name: "手动导入" }));
    fireEvent.change(screen.getByRole("textbox", { name: "文章标题" }), { target: { value: "待导入文章" } });
    fireEvent.change(screen.getByRole("textbox", { name: "文章正文" }), { target: { value: "相同正文" } });
    fireEvent.click(screen.getByRole("button", { name: /^保存$/ }));
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText(message)).toBeVisible();
    expect(within(dialog).getByRole("textbox", { name: "文章标题" })).toHaveValue("待导入文章");
    expect(within(dialog).getByRole("textbox", { name: "文章正文" })).toHaveValue("相同正文");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "文章正文" }), { target: { value: "不同的正文" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^保存$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "导入文章" })).not.toBeInTheDocument());
  });

  it("keeps the original body HTML when only metadata changes", async () => {
    const html = '<section><p id="original-position"><span>保持原正文</span></p></section>';
    vi.spyOn(articles, "get").mockResolvedValue({ ...article, html });
    const save = vi.spyOn(articles, "save").mockResolvedValue({ ...article, html });
    render(<TestProviders><ArticlesPage /></TestProviders>);
    fireEvent.click(await screen.findByRole("button", { name: "秋日书信更多操作" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "编辑文章" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "作者" }), { target: { value: "新作者" } });
    fireEvent.click(screen.getByRole("button", { name: /^保存$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ author: "新作者", html }), article.id));
  });

  it("filters the catalog and hides management actions for a member", async () => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({
      id: "user-member", username: "member", displayName: "成员", role: "MEMBER", mustChangePassword: false,
    }));
    render(<TestProviders><ArticlesPage /></TestProviders>);
    await screen.findByRole("region", { name: "文章列表" });
    expect(screen.queryByRole("button", { name: "新增文章" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "手动导入" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "秋日书信更多操作" }));
    expect(await screen.findByRole("menuitem", { name: "打开文章" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "编辑文章" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "标签" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "排序" })).toBeInTheDocument();
  });

  it("applies exact tag filters and title sorting from the URL", async () => {
    vi.mocked(articles.list).mockResolvedValue([
      { ...article, id: "z", title: "Z 文章", tags: "随笔，阅读" },
      { ...article, id: "a", title: "A 文章", tags: "阅读,艺术" },
      { ...article, id: "b", title: "B 文章", tags: "阅读札记" },
    ]);
    render(<TestProviders initialPath="/articles?tag=阅读&sort=title"><ArticlesPage /></TestProviders>);
    const list = await screen.findByRole("region", { name: "文章列表" });
    expect(within(list).getAllByRole("heading").map(item => item.textContent)).toEqual(["A 文章", "Z 文章"]);
    expect(within(list).queryByText("B 文章")).not.toBeInTheDocument();
  });

  it("clears an empty tag filter without clearing the chosen sort", async () => {
    render(<TestProviders initialPath="/articles?tag=不存在&sort=title"><ArticlesPage /></TestProviders>);
    expect(await screen.findByRole("heading", { name: "没有找到匹配的文章" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "文章列表" })).toBeInTheDocument());
    expect(screen.getByText("按标题")).toBeInTheDocument();
    expect(screen.getByText("全部标签")).toBeInTheDocument();
  });

  it("filters untagged articles and sorts recent collections by date", async () => {
    vi.mocked(articles.list).mockResolvedValue([
      { ...article, id: "older", title: "较早收藏", tags: "", created_at: "2026-10-01T00:00:00Z" },
      { ...article, id: "newer", title: "最近收藏文章", tags: " ", created_at: "2026-10-20T00:00:00Z" },
      article,
    ]);
    render(<TestProviders initialPath="/articles?tag=UNTAGGED"><ArticlesPage /></TestProviders>);
    const list = await screen.findByRole("region", { name: "文章列表" });
    expect(within(list).getAllByRole("heading").map(item => item.textContent)).toEqual(["最近收藏文章", "较早收藏"]);
  });
});
