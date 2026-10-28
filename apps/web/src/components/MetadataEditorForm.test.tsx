import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { api } from "../api/client";
import { vi } from "vitest";
import type { BookKnowledgeDraft } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { MetadataEditorForm, type MetadataEditorValues } from "./MetadataEditorForm";
import { ThemaSubjectField } from "./ThemaSubjectField";

vi.mock("./BookContentSuggestionButton", () => ({
  BookContentSuggestionButton: (props: {
    source?: { type: "BOOK" | "UPLOAD"; id: string };
    mode: "subjects" | "tags" | "knowledge";
    knowledgeDraft?: BookKnowledgeDraft;
    value: string[];
    onApply: (next: string[]) => void;
    onApplyKnowledge?: (next: BookKnowledgeDraft) => void;
    disabled?: boolean;
    actionLabel?: string;
  }) => <button type="button" aria-label={props.actionLabel} disabled={props.disabled}
    data-mode={props.mode} data-source-type={props.source?.type} data-source-id={props.source?.id}
    data-value={props.value.join("|")} onClick={() => props.mode === "knowledge"
      ? props.onApplyKnowledge?.({ points: [{ name: "纸本文献保护", quote: "原文依据。", locator: "page:3" }], fingerprint: "sha256:source", sampledSections: 4, totalSections: 9 })
      : props.onApply(props.mode === "tags" ? ["AI 建议标签"] : [...props.value, "新增标签"])}>AI</button>,
}));

const value: MetadataEditorValues = {
  title: "原书名",
  subtitle: "副标题",
  authors: "作者甲",
  translators: "译者甲",
  language: "中文",
  publisher: "出版社",
  publishedDate: "2026-01",
  isbn: "9780000000000",
  series: "系列",
  seriesIndex: "2",
  tags: "文学",
  description: "内容简介",
  authorBiography: "作者介绍内容",
  tableOfContents: "第一章",
  publiclyVisible: true,
};

describe("MetadataEditorForm", () => {
  beforeEach(() => {
    vi.spyOn(api, "listMetadataTerms").mockResolvedValue({ items: [] });
    vi.spyOn(api, "ensureMetadataTerms").mockImplementation(async (kind, items) => ({ items: items.map(item => ({ ...item, kind, id: item.value })) }));
  });
  afterEach(() => vi.restoreAllMocks());
  it("renders the shared cover, title, bibliography, content and bottom actions in order", async () => {
    const onChange = vi.fn();
    const extraFields = vi.fn(() => <div>学科分类控件</div>);
    render(<TestProviders>
      <MetadataEditorForm value={value} onChange={onChange} coverAlt="书籍封面" coverUrl="/shared-cover.jpg"
        coverActions={<button type="button">更换封面</button>} coverDetails={<span>EPUB</span>}
        actions={<button type="button">保存元信息</button>} extraFields={extraFields}
        aiEnabled={false}>
        <label><input type="checkbox" />同时写回原文件</label>
      </MetadataEditorForm>
    </TestProviders>);

    const heroTitle = screen.getByRole("textbox", { name: "书名" });
    expect(heroTitle).toHaveValue("原书名");
    expect(heroTitle.tagName).toBe("TEXTAREA");
    expect(screen.getByRole("textbox", { name: "副标题" })).toHaveValue("副标题");
    const authors = screen.getByRole("textbox", { name: "作者" });
    expect(authors).toHaveValue("作者甲");
    const cover = screen.getByRole("img", { name: "书籍封面" });
    expect(Boolean(cover.compareDocumentPosition(heroTitle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getByText("EPUB")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "保存元信息" });
    expect(screen.getAllByRole("button", { name: "保存元信息" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "更换封面" })).toBeInTheDocument();

    const bibliography = screen.getByRole("region", { name: "书目资料" });
    expect(Boolean(authors.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(screen.getByRole("textbox", { name: "作者介绍" }).compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    for (const name of ["译者", "出版社", "出版日期", "ISBN", "系列"]) {
      expect(within(bibliography).getByRole(name === "系列" ? "combobox" : "textbox", { name })).toBeInTheDocument();
    }
    expect(within(bibliography).getByRole("combobox", { name: "标签" })).toBeInTheDocument();
    expect(within(bibliography).getByText("文学")).toBeInTheDocument();
    expect(within(bibliography).getByRole("combobox", { name: "语言" })).toBeInTheDocument();
    expect(within(bibliography).getByText("中文")).toBeInTheDocument();
    expect(within(bibliography).getByRole("spinbutton", { name: "系列序号" })).toBeInTheDocument();
    expect(within(bibliography).getByText("学科分类控件")).toBeInTheDocument();
    expect(within(bibliography).getByRole("switch", { name: "公开展示" })).toBeChecked();
    expect(within(bibliography).queryByRole("textbox", { name: "书名" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "内容简介" })).toHaveValue("内容简介");
    expect(screen.getByRole("textbox", { name: "作者介绍" })).toHaveValue("作者介绍内容");
    expect(screen.getByRole("region", { name: "内容简介" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "作者介绍" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "目录" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("同时写回原文件")).toBeInTheDocument();
    expect(extraFields).toHaveBeenCalledWith(null);

    const changedFields: [string, string, string][] = [
      ["书名", "title", "新书名"], ["副标题", "subtitle", "新副标题"], ["作者", "authors", "新作者"],
      ["译者", "translators", "新译者"], ["出版社", "publisher", "新出版社"],
      ["ISBN", "isbn", "9781111111111"], ["系列", "series", "新系列"],
      ["内容简介", "description", "新简介"], ["作者介绍", "authorBiography", "新作者介绍"],
    ];
    for (const [name, key, nextValue] of changedFields) {
      fireEvent.change(screen.getByRole(name === "系列" ? "combobox" : "textbox", { name }), { target: { value: nextValue } });
      if (name === "系列") { fireEvent.blur(screen.getByRole("combobox", { name })); await waitFor(() => expect(onChange).toHaveBeenCalledWith(key, nextValue)); }
      else expect(onChange).toHaveBeenCalledWith(key, nextValue);
    }
    fireEvent.change(screen.getByRole("spinbutton", { name: "系列序号" }), { target: { value: "3" } });
    fireEvent.click(within(bibliography).getByRole("switch", { name: "公开展示" }));
    expect(onChange).toHaveBeenCalledWith("seriesIndex", "3");
    expect(onChange).toHaveBeenCalledWith("publiclyVisible", false);
  });

  it("sends tag suggestions the real file identity and preserves the existing delimiter when applying", () => {
    const onChange = vi.fn();
    const tagValue = { ...value, tags: "古籍,馆藏" };
    render(<TestProviders><MetadataEditorForm value={tagValue} onChange={onChange} coverAlt="封面" coverActions={null}
      aiEnabled aiContentSource={{ type: "BOOK", id: "book-7" }} /></TestProviders>);

    const button = screen.getByRole("button", { name: "AI 生成标签" });
    expect(button).toHaveTextContent(/^AI$/);
    expect(button).toHaveAttribute("data-mode", "tags");
    expect(button).toHaveAttribute("data-source-type", "BOOK");
    expect(button).toHaveAttribute("data-source-id", "book-7");
    expect(button).toHaveAttribute("data-value", "古籍|馆藏");
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith("tags", "AI 建议标签");
  });

  it("disables tag analysis when no real content source is available", () => {
    render(<TestProviders><MetadataEditorForm value={value} onChange={vi.fn()} coverAlt="封面" coverActions={null} aiEnabled /></TestProviders>);

    expect(screen.getByRole("button", { name: "AI 生成标签" })).toBeDisabled();
  });

  it("shows saved knowledge points beside their AI action and updates only after adoption", () => {
    const existing: BookKnowledgeDraft = {
      points: [{ name: "已有知识点", quote: "原有证据。", locator: "page:1" }],
      fingerprint: "sha256:old", sampledSections: 1, totalSections: 2,
    };
    const adopted: BookKnowledgeDraft = {
      points: [{ name: "纸本文献保护", quote: "原文依据。", locator: "page:3" }],
      fingerprint: "sha256:source", sampledSections: 4, totalSections: 9,
    };
    const onKnowledgeChange = vi.fn();
    render(<TestProviders><MetadataEditorForm value={value} onChange={vi.fn()} coverAlt="封面" coverActions={null}
      knowledgeDraft={existing} onKnowledgeChange={onKnowledgeChange} aiEnabled aiContentSource={{ type: "BOOK", id: "book-7" }} /></TestProviders>);

    expect(screen.getByRole("combobox", { name: "知识点" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 识别知识点" })).toHaveAttribute("data-mode", "knowledge");
    expect(screen.getByText("已有知识点")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "知识点" })).not.toBeInTheDocument();
    expect(onKnowledgeChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "AI 识别知识点" }));
    expect(onKnowledgeChange).toHaveBeenCalledExactlyOnceWith(adopted);
  });

  it("groups tags with classification and keeps long content fields resizable", () => {
    render(<TestProviders><MetadataEditorForm value={value} onChange={vi.fn()} coverAlt="封面" coverActions={null}
      extraFields={() => <ThemaSubjectField value={[]} onChange={vi.fn()} />} /></TestProviders>);
    for (const name of ["内容简介", "作者介绍"]) {
      const field = screen.getByRole(name === "系列" ? "combobox" : "textbox", { name });
      expect(field).toHaveAttribute("rows", "1");
      expect(field).toHaveStyle({ resize: "vertical" });
    }
    expect(screen.queryByRole("textbox", { name: "目录" })).not.toBeInTheDocument();
    const tags = screen.getByRole("combobox", { name: "标签" });
    const classification = screen.getByRole("combobox", { name: "学科分类" });
    expect(tags.compareDocumentPosition(classification) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "出版社" }).compareDocumentPosition(screen.getByRole("combobox", { name: "语言" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
