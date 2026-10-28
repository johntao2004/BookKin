import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api, request } from "../api/client";
import { BookKinThemeProvider } from "../theme/BookKinThemeProvider";
import type { BookKnowledgeDraft } from "../domain/types";
import { BookContentSuggestionButton, type ContentMetadataSource } from "./BookContentSuggestionButton";

vi.mock("../api/client", () => ({ request: vi.fn(), api: { ensureMetadataTerms: vi.fn().mockResolvedValue({ items: [] }) } }));
const identity = vi.hoisted(() => ({ user: { id: "metadata-reader" } }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: identity.user }) }));
const source: ContentMetadataSource = { type: "UPLOAD", id: "upload-id" };
const result = { subjects: [
  { code: "GL", reason: "原文讨论文献保护", evidence: [{ locator: "page:3", quote: "古籍保护与图书馆文献整理" }] },
  { code: "AKH", reason: "原文讨论装帧", evidence: [{ locator: "page:4", quote: "传统书籍设计与装帧工艺" }] },
], tags: ["古籍保护", "装帧"], included: 6, total: 6, coverage: "已采样 6/6 页，每页最多 1800 字。",
  evidence: [{ locator: "page:3", quote: "古籍保护与图书馆文献整理" }] };
const knowledge: BookKnowledgeDraft = {
  points: [
    { name: "纸本文献保护", quote: "传统图书馆应建立古籍修复制度。", locator: "page:3" },
    { name: "书籍装帧演变", quote: "线装书在明清时期逐渐普及。", locator: "page:4" },
  ],
  fingerprint: "sha256:knowledge-source",
  sampledSections: 4,
  totalSections: 9,
  providerId: "provider-test",
};
beforeEach(() => { vi.mocked(api.ensureMetadataTerms).mockReset().mockResolvedValue({ items: [] }); identity.user = { id: "metadata-reader" }; vi.mocked(request).mockReset().mockResolvedValue(result); });
const view = (props: Partial<React.ComponentProps<typeof BookContentSuggestionButton>> = {}) => <BookKinThemeProvider>
  <BookContentSuggestionButton mode="subjects" source={source} value={["PS"]} onApply={vi.fn()} {...props} />
</BookKinThemeProvider>;

it.each(["BOOK", "UPLOAD"] as const)("sends only the %s file identity and shows suggestions without reference material", async type => {
  const apply = vi.fn();
  render(<StrictMode>{view({ source: { type, id: "file-id" }, onApply: apply })}</StrictMode>);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "生成分类建议" }));
  expect(await screen.findByRole("checkbox", { name: /书籍设计与装帧/ })).toBeInTheDocument();
  expect(screen.queryByText("古籍保护与图书馆文献整理")).not.toBeInTheDocument();
  expect(screen.queryByText("第 3 页")).not.toBeInTheDocument();
  expect(screen.queryByText(result.coverage)).not.toBeInTheDocument();
  expect(screen.queryByText(/依据原文件正文采样/)).not.toBeInTheDocument();
  expect(screen.queryByText("原文依据")).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
  expect(vi.mocked(request).mock.calls[0][0]).toBe("/ai/book-classification");
  expect(JSON.parse(vi.mocked(request).mock.calls[0][1]!.body as string)).toEqual({ source: type, id: "file-id", consent: true });
  expect(apply).not.toHaveBeenCalled();
  const regenerate = screen.getByRole("button", { name: "重新生成" });
  const confirm = screen.getByRole("button", { name: "确认选择" });
  expect(regenerate).toHaveClass("ant-btn-default");
  expect(confirm).toHaveClass("ant-btn-primary");
  expect(regenerate.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("button", { name: "取消" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "确认选择" }));
  await waitFor(() => expect(apply).toHaveBeenCalledExactlyOnceWith(["PS", "GL", "AKH"]));
});

it("keeps manual subjects in order and respects the four-subject limit", async () => {
  const apply = vi.fn();
  render(view({ value: ["PS", "UM", "PB"], onApply: apply }));
  fireEvent.click(screen.getByRole("button", { name: "生成分类建议" }));
  const first = await screen.findByRole("checkbox", { name: /图书馆/ });
  expect(first).toBeChecked();
  const second = screen.getByRole("checkbox", { name: /书籍设计与装帧/ });
  expect(second).toBeDisabled();
  fireEvent.click(first);
  fireEvent.click(second);
  fireEvent.click(screen.getByRole("button", { name: "确认选择" }));
  await waitFor(() => expect(apply).toHaveBeenCalledWith(["PS", "UM", "PB", "AKH"]));
});

it("closes without applying and aborts a pending original-text request", async () => {
  vi.mocked(request).mockImplementation(() => new Promise(() => {}));
  const apply = vi.fn();
  render(view({ onApply: apply }));
  fireEvent.click(screen.getByRole("button", { name: "生成分类建议" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(request).mock.calls[0][1]!.signal!;
  fireEvent.click(screen.getByRole("button", { name: /^关闭$/ }));
  await waitFor(() => expect(signal.aborted).toBe(true));
  expect(apply).not.toHaveBeenCalled();
});

it("keeps extraction errors in the dialog without falling back to metadata guesses", async () => {
  vi.mocked(request).mockRejectedValue(new Error("PDF 没有可提取的正文。"));
  render(view());
  fireEvent.click(screen.getByRole("button", { name: "生成分类建议" }));
  expect(await screen.findByText("PDF 没有可提取的正文。")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "确认选择" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "重试" })).toBeEnabled();
});

it("requires regeneration when the chosen metadata changes during analysis", async () => {
  const apply = vi.fn();
  const { rerender } = render(view({ onApply: apply }));
  fireEvent.click(screen.getByRole("button", { name: "生成分类建议" }));
  await screen.findByRole("checkbox", { name: /书籍设计与装帧/ });
  rerender(view({ value: ["UM"], onApply: apply }));
  expect(screen.getByText("当前选择已变化，请重新分析后再确认。")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "确认选择" })).toBeDisabled();
});

it("uses the same content analysis for tags without adopting subject codes", async () => {
  const apply = vi.fn();
  render(view({ mode: "tags", value: ["手工标签"], onApply: apply }));
  fireEvent.click(screen.getByRole("button", { name: "AI 生成标签" }));
  expect(await screen.findByRole("checkbox", { name: "古籍保护" })).toBeChecked();
  expect(screen.queryByText("原文依据")).not.toBeInTheDocument();
  expect(screen.queryByText("古籍保护与图书馆文献整理")).not.toBeInTheDocument();
  expect(screen.queryByText(result.coverage)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "确认选择" }));
  await waitFor(() => expect(apply).toHaveBeenCalledWith(["手工标签", "古籍保护", "装帧"]));
});

it("offers at most five tag candidates and preserves existing manual tags", async () => {
  const existing = ["手工一", "手工二", "手工三", "手工四", "手工五", "手工六", "手工七", "手工八"];
  const candidates = ["候选一", "候选二", "候选三", "候选四", "候选五", "候选六", "候选七"];
  vi.mocked(request).mockResolvedValue({ ...result, tags: candidates });
  const apply = vi.fn();
  render(view({ mode: "tags", value: existing, onApply: apply }));
  fireEvent.click(screen.getByRole("button", { name: "AI 生成标签" }));

  const fifth = await screen.findByRole("checkbox", { name: "候选五" });
  expect(screen.getAllByRole("checkbox")).toHaveLength(5);
  expect(screen.queryByRole("checkbox", { name: "候选六" })).not.toBeInTheDocument();
  for (const candidate of candidates.slice(0, 4)) fireEvent.click(screen.getByRole("checkbox", { name: candidate }));
  expect(fifth).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "确认选择" }));
  await waitFor(() => expect(apply).toHaveBeenCalledExactlyOnceWith([...existing, "候选五"]));
});

it("uses the dedicated knowledge endpoint, previews evidence-backed points and adopts only the selection", async () => {
  vi.mocked(request).mockResolvedValue(knowledge);
  const apply = vi.fn();
  const applyKnowledge = vi.fn();
  const existing = { name: "已有知识点", quote: "旧依据仍应保留。", locator: "page:1" };
  const existingDraft: BookKnowledgeDraft = { ...knowledge, points: [existing], fingerprint: "sha256:old" };
  render(view({ mode: "knowledge", value: [existing.name], knowledgeDraft: existingDraft, onApply: apply, onApplyKnowledge: applyKnowledge, actionLabel: "AI 识别知识点" }));

  fireEvent.click(screen.getByRole("button", { name: "AI 识别知识点" }));
  const first = await screen.findByRole("checkbox", { name: "纸本文献保护" });
  expect(screen.getByRole("heading", { name: "AI 知识点建议" })).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "书籍装帧演变" })).toBeChecked();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByText(knowledge.points[0]!.quote)).not.toBeInTheDocument();
  expect(screen.queryByText(knowledge.points[0]!.locator)).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
  expect(vi.mocked(request).mock.calls[0]![0]).toBe("/ai/book-knowledge");
  expect(JSON.parse(vi.mocked(request).mock.calls[0]![1]!.body as string)).toEqual({ source: "UPLOAD", id: "upload-id", consent: true });
  expect(applyKnowledge).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("checkbox", { name: "书籍装帧演变" }));
  fireEvent.click(screen.getByRole("button", { name: "确认选择" }));
  expect(apply).not.toHaveBeenCalled();
  await waitFor(() => expect(applyKnowledge).toHaveBeenCalledExactlyOnceWith({
    ...knowledge,
    points: [existing, knowledge.points[0]],
  }));
  expect(first).toBeChecked();
});

it("excludes knowledge candidates missing a quote or source locator", async () => {
  vi.mocked(request).mockResolvedValue({
    ...knowledge,
    points: [
      knowledge.points[0]!,
      { name: "缺引文", quote: "", locator: "page:5" },
      { name: "缺定位", quote: "没有可追溯位置。", locator: "" },
    ],
  });
  render(view({ mode: "knowledge", value: [], onApplyKnowledge: vi.fn(), actionLabel: "AI 识别知识点" }));
  fireEvent.click(screen.getByRole("button", { name: "AI 识别知识点" }));

  await screen.findByRole("checkbox", { name: "纸本文献保护" });
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  expect(screen.queryByRole("checkbox", { name: "缺引文" })).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: "缺定位" })).not.toBeInTheDocument();
});

it("does not adopt stale knowledge candidates after the saved draft changes", async () => {
  vi.mocked(request).mockResolvedValue(knowledge);
  const applyKnowledge = vi.fn();
  const initial: BookKnowledgeDraft = { ...knowledge, points: [], fingerprint: "sha256:old" };
  const { rerender } = render(view({ mode: "knowledge", value: [], knowledgeDraft: initial, onApplyKnowledge: applyKnowledge, actionLabel: "AI 识别知识点" }));
  fireEvent.click(screen.getByRole("button", { name: "AI 识别知识点" }));
  await screen.findByRole("checkbox", { name: "纸本文献保护" });

  const changed: BookKnowledgeDraft = { ...initial, points: [{ name: "后来加入", quote: "新依据。", locator: "page:8" }] };
  rerender(view({ mode: "knowledge", value: ["后来加入"], knowledgeDraft: changed, onApplyKnowledge: applyKnowledge, actionLabel: "AI 识别知识点" }));
  expect(screen.getByText("当前选择已变化，请重新分析后再确认。")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "确认选择" })).toBeDisabled();
  expect(applyKnowledge).not.toHaveBeenCalled();
});

it("keeps knowledge analysis errors in the dialog and does not apply a draft", async () => {
  vi.mocked(request).mockRejectedValue(new Error("原文分析失败"));
  const applyKnowledge = vi.fn();
  render(view({ mode: "knowledge", value: [], onApplyKnowledge: applyKnowledge, actionLabel: "AI 识别知识点" }));
  fireEvent.click(screen.getByRole("button", { name: "AI 识别知识点" }));

  expect(await screen.findByText("原文分析失败")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "确认选择" })).toBeDisabled();
  expect(applyKnowledge).not.toHaveBeenCalled();
});

it("aborts a pending knowledge request when its dialog closes", async () => {
  vi.mocked(request).mockImplementation(() => new Promise(() => {}));
  const applyKnowledge = vi.fn();
  render(view({ mode: "knowledge", value: [], onApplyKnowledge: applyKnowledge, actionLabel: "AI 识别知识点" }));
  fireEvent.click(screen.getByRole("button", { name: "AI 识别知识点" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const [endpoint, options] = vi.mocked(request).mock.calls[0]!;
  expect(endpoint).toBe("/ai/book-knowledge");
  const signal = options!.signal!;

  fireEvent.click(screen.getByRole("button", { name: /^关闭$/ }));
  await waitFor(() => expect(signal.aborted).toBe(true));
  expect(applyKnowledge).not.toHaveBeenCalled();
});

it("does not offer title-based generation when the file identity is missing", () => {
  render(view({ source: undefined }));
  expect(screen.getByRole("button", { name: "生成分类建议" })).toBeDisabled();
  expect(request).not.toHaveBeenCalled();
});

it("clears source analysis and aborts the old user's request on an account change", async () => {
  vi.mocked(request).mockImplementation(() => new Promise(() => {}));
  const { rerender } = render(view());
  fireEvent.click(screen.getByRole("button", { name: "生成分类建议" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(request).mock.calls[0][1]!.signal!;
  identity.user = { id: "another-user" };
  rerender(view());
  await waitFor(() => expect(signal.aborted).toBe(true));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
  identity.user = { id: "metadata-reader" };
  rerender(view());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
});

it.each([['languages', 'AI 识别语言', 'LANGUAGE', 'no', '挪威语'], ['series', 'AI 识别系列', 'SERIES', '现代文库', '现代文库']] as const)(
  'registers %s suggestions only on explicit adoption', async (mode, name, kind, value, label) => {
    vi.mocked(request).mockResolvedValue({ items: [{ value, label }] });
    const apply = vi.fn();
    render(view({ mode, value: mode === 'series' ? ['旧系列'] : [], onApply: apply }));
    fireEvent.click(screen.getByRole('button', { name }));
    expect(await screen.findByRole('checkbox', { name: label })).toBeChecked();
    expect(api.ensureMetadataTerms).not.toHaveBeenCalled();
    expect(JSON.parse(vi.mocked(request).mock.calls[0][1]!.body as string)).toEqual({ source: 'UPLOAD', id: 'upload-id', consent: true, kind });
    fireEvent.click(screen.getByRole('button', { name: '确认选择' }));
    await waitFor(() => expect(apply).toHaveBeenCalledExactlyOnceWith([value]));
    expect(api.ensureMetadataTerms).toHaveBeenCalledWith(kind, [{ value, label }]);
  });

it('keeps the current selection and dialog when shared vocabulary persistence fails', async () => {
  vi.mocked(request).mockResolvedValue({ items: [{ value: 'no', label: '挪威语' }] });
  vi.mocked(api.ensureMetadataTerms).mockRejectedValue(new Error('词库暂不可用'));
  const apply = vi.fn();
  render(view({ mode: 'languages', value: [], onApply: apply }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 识别语言' }));
  await screen.findByRole('checkbox', { name: '挪威语' });
  fireEvent.click(screen.getByRole('button', { name: '确认选择' }));
  expect(await screen.findByText('词库暂不可用')).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
  vi.mocked(api.ensureMetadataTerms).mockResolvedValue({ items: [] });
  fireEvent.click(screen.getByRole('button', { name: '确认选择' }));
  await waitFor(() => expect(apply).toHaveBeenCalledWith(['no']));
});

it('uses the shared canonical spelling returned when adopting an existing tag', async () => {
  vi.mocked(request).mockResolvedValue({ ...result, tags: ['java'] });
  vi.mocked(api.ensureMetadataTerms).mockResolvedValue({ items: [{ id: 'java', kind: 'TAG', value: 'Java', label: 'Java' }] });
  const apply = vi.fn();
  render(view({ mode: 'tags', value: [], onApply: apply }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 生成标签' }));
  await screen.findByRole('checkbox', { name: 'java' });
  fireEvent.click(screen.getByRole('button', { name: '确认选择' }));
  await waitFor(() => expect(apply).toHaveBeenCalledWith(['Java']));
});
