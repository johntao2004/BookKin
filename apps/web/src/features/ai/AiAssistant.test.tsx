import { StrictMode } from "react";
import { InputActionGroup, TextField } from "../../ui/forms";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { BookKinThemeProvider } from "../../theme/BookKinThemeProvider";
import { request } from "../../api/client";
import { AiAssistantButton, type AiResult } from "./AiAssistant";

const identity = vi.hoisted(() => ({ user: { id: "reader-one" } as { id: string } | null }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: identity.user }) }));
vi.mock("../../api/client", () => ({ request: vi.fn() }));
const value: AiResult = { text: "润色后的原文", evidence: [{ locator: "page:1", quote: "这是一段真实的原文依据。" }], provider: "DeepSeek", model: "model", sourceTitle: "当前草稿", included: 1, total: 3, coverage: "仅采样 1/3 页，不代表全文分析。" };
const view = (draft = "原来的私人草稿", onApply = vi.fn()) => <BookKinThemeProvider><AiAssistantButton source="NOTE_DRAFT" draft={draft} onApply={onApply} /></BookKinThemeProvider>;
const open = () => fireEvent.click(screen.getByRole("button", { name: "AI 助读" }));
const consent = () => fireEvent.click(screen.getByRole("checkbox", { name: "我同意本次将上述内容发送给已配置的 AI 平台" }));
beforeEach(() => { identity.user = { id: "reader-one" }; vi.mocked(request).mockReset().mockResolvedValue(value); });

it("opening does not send content and generation requires explicit consent", async () => {
  render(view()); open();
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "生成建议" })).toBeDisabled();
  consent(); fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  expect(await screen.findByLabelText("AI 生成结果")).toHaveTextContent(value.text);
  expect(JSON.parse(vi.mocked(request).mock.calls[0][1]!.body as string)).toEqual({ source: "NOTE_DRAFT", action: "POLISH", draft: "原来的私人草稿", consent: true });
});
it("suggestions do not overwrite the draft until explicitly adopted", async () => {
  const apply = vi.fn(); render(view("原稿", apply)); open(); consent();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByLabelText("AI 生成结果"); expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "采用建议" }));
  expect(apply).toHaveBeenCalledWith(value.text, "POLISH");
});
it("a draft edited while the request is running cannot be overwritten", async () => {
  let resolve!: (value: AiResult) => void;
  vi.mocked(request).mockReturnValue(new Promise<AiResult>(done => { resolve = done; }));
  const apply = vi.fn(); const rendered = render(view("原稿", apply)); open(); consent();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  rendered.rerender(view("用户新写的内容", apply)); resolve(value);
  await screen.findByLabelText("AI 生成结果");
  expect(screen.getByText(/草稿已变化/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "采用建议" })).toBeDisabled(); expect(apply).not.toHaveBeenCalled();
});
it("closing aborts the browser request and clears both consent and result", async () => {
  render(view()); open(); consent(); fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByLabelText("AI 生成结果"); fireEvent.click(screen.getByRole("button", { name: "关闭助手" }));
  open(); expect(screen.queryByLabelText("AI 生成结果")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "生成建议" })).toBeDisabled();
});
it("changing users never exposes the prior result", async () => {
  const rendered = render(view()); open(); consent(); fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByLabelText("AI 生成结果"); identity.user = { id: "reader-two" }; rendered.rerender(view());
  expect(screen.queryByLabelText("AI 生成结果")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "生成建议" })).toBeDisabled();
});
it("a failed provider leaves a retry path and preserves the draft", async () => {
  vi.mocked(request).mockRejectedValueOnce(new Error("AI 平台暂不可用"));
  const apply = vi.fn(); render(view("原稿", apply)); open(); consent(); fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  expect(await screen.findByText("AI 平台暂不可用")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByLabelText("AI 生成结果"); expect(apply).not.toHaveBeenCalled();
});
it("oversized drafts are blocked without silently truncating them", () => {
  render(view("字".repeat(20001))); open(); consent();
  expect(screen.getByText(/单次最多发送 20000 字/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "生成建议" })).toBeDisabled(); expect(request).not.toHaveBeenCalled();
});
it("logged out users have no AI entry", () => {
  identity.user = null; render(view()); expect(screen.queryByRole("button", { name: "AI 助读" })).not.toBeInTheDocument();
});
it("source results show verified evidence and sampling scope", async () => {
  render(<BookKinThemeProvider><AiAssistantButton source="BOOK" id="book-id" /></BookKinThemeProvider>); open(); consent();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  expect(await screen.findByText(value.coverage)).toBeInTheDocument();
  expect(screen.getByText(value.evidence[0].quote)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "采用建议" })).not.toBeInTheDocument();
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
});

it("renders readable Markdown without executing HTML or loading model-selected images", async () => {
  vi.mocked(request).mockResolvedValue({ ...value, text: "## 摘要\n\n**要点**\n\n![图片](https://example.invalid/private.png)\n\n<script>alert(1)</script>" });
  render(view()); open(); consent(); fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByRole("heading", { name: "摘要" });
  const result = screen.getByLabelText("AI 生成结果");
  expect(result.querySelector("strong")).toHaveTextContent("要点");
  expect(result.querySelector("script, img, iframe")).toBeNull();
});

it("names the action selector and requires a question before sending a Q&A request", async () => {
  render(<BookKinThemeProvider><AiAssistantButton source="BOOK" id="book-id" /></BookKinThemeProvider>); open();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "AI 操作" }));
  fireEvent.click(await screen.findByText("原文问答")); consent();
  expect(screen.getByRole("button", { name: "生成建议" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "想了解什么" }), { target: { value: "作者建议观察哪些现象？" } });
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByLabelText("AI 生成结果");
  expect(JSON.parse(vi.mocked(request).mock.calls[0][1]!.body as string)).toMatchObject({ action: "ASK", question: "作者建议观察哪些现象？" });
});

it.each<"DESCRIPTION" | "TAGS" | "AUTHOR_BIOGRAPHY">(["DESCRIPTION", "TAGS", "AUTHOR_BIOGRAPHY"])("directly generates the selected metadata action (%s) once", async action => {
  const apply = vi.fn();
  render(<StrictMode><BookKinThemeProvider><InputActionGroup><TextField aria-label="资料" /><AiAssistantButton source="METADATA_DRAFT" id="book-id" label="字段建议" directAction={action}
    draft='{"title":"书名","authors":"作者"}' applyActions={[action]} onApply={apply} /></InputActionGroup></BookKinThemeProvider></StrictMode>);
  fireEvent.click(screen.getByRole("button", { name: "字段建议" }));

  const title = { DESCRIPTION: "AI 简介建议", TAGS: "AI 标签建议", AUTHOR_BIOGRAPHY: "AI 作者介绍建议" }[action];
  expect(await screen.findByRole("dialog", { name: title })).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "AI 操作" })).not.toBeInTheDocument();
  expect(await screen.findByLabelText("AI 生成结果")).toHaveTextContent(value.text);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(JSON.parse(vi.mocked(request).mock.calls[0][1]!.body as string)).toEqual({
    source: "METADATA_DRAFT", id: "book-id", action, draft: '{"title":"书名","authors":"作者"}', consent: true,
  });
  expect(screen.getByRole("button", { name: "采用建议" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "采用建议" })).not.toHaveClass("ant-btn-compact-item");
  expect(apply).not.toHaveBeenCalled();
  const regenerate = screen.getByRole("button", { name: "重新生成" });
  const adopt = screen.getByRole("button", { name: "采用建议" });
  expect(regenerate).toHaveClass("ant-btn-default");
  expect(adopt).toHaveClass("ant-btn-primary");
  expect(regenerate.compareDocumentPosition(adopt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("button", { name: "关闭助手" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "复制结果" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "采用建议" }));
  expect(apply).toHaveBeenCalledWith(value.text, action);
});

it("aborts a direct request on close and automatically generates again when reopened", async () => {
  vi.mocked(request).mockReturnValueOnce(new Promise<AiResult>(() => {})).mockResolvedValueOnce(value);
  render(<BookKinThemeProvider><AiAssistantButton source="METADATA_DRAFT" label="字段建议" directAction="TAGS" draft="草稿" /></BookKinThemeProvider>);
  const opener = () => fireEvent.click(screen.getByRole("button", { name: "字段建议" }));
  opener();
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const firstSignal = vi.mocked(request).mock.calls[0][1]!.signal as AbortSignal;
  fireEvent.click(screen.getByRole("button", { name: /^关闭$/ }));
  expect(firstSignal.aborted).toBe(true);
  expect(screen.queryByLabelText("AI 生成结果")).not.toBeInTheDocument();

  opener();
  expect(await screen.findByLabelText("AI 生成结果")).toHaveTextContent(value.text);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(JSON.parse(vi.mocked(request).mock.calls[1][1]!.body as string)).toMatchObject({ action: "TAGS", consent: true });
});

it("keeps the direct metadata action available for retry after automatic generation fails", async () => {
  vi.mocked(request).mockRejectedValueOnce(new Error("AI 平台暂不可用"));
  render(<BookKinThemeProvider><AiAssistantButton source="METADATA_DRAFT" label="字段建议" directAction="DESCRIPTION" draft="草稿" /></BookKinThemeProvider>);
  fireEvent.click(screen.getByRole("button", { name: "字段建议" }));
  expect(await screen.findByText("AI 平台暂不可用")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  expect(await screen.findByLabelText("AI 生成结果")).toHaveTextContent(value.text);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  for (const [, options] of vi.mocked(request).mock.calls) {
    expect(JSON.parse(options!.body as string)).toMatchObject({ action: "DESCRIPTION", consent: true });
  }
});
