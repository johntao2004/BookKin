import { act, StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { BookKinThemeProvider } from "../../theme/BookKinThemeProvider";
import { api, request } from "../../api/client";
import { AiAssistantButton, type AiResult, type AiSource } from "./AiAssistant";
import { InputActionGroup, TextField } from "../../ui/forms";

const identity = vi.hoisted(() => ({ user: { id: "reader-one" } as { id: string } | null }));
const access = vi.hoisted(() => ({ canConfigure: true }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: identity.user }) }));
vi.mock("../../auth/permissions", () => ({ usePermissions: () => ({ can: (code: string) => code === "settings.ai.edit" && access.canConfigure, canVisit: () => access.canConfigure }) }));
vi.mock("../../api/client", () => ({ request: vi.fn(), api: { getAiServiceAvailability: vi.fn() } }));
const value: AiResult = { text: "润色后的原文", evidence: [{ locator: "page:1", quote: "这是一段真实的原文依据。" }], provider: "DeepSeek", model: "model", sourceTitle: "当前草稿", included: 1, total: 3, coverage: "仅采样 1/3 页，不代表全文分析。" };
const ready = { enabled: true, hasConfiguredProvider: true, hasEnabledProvider: true };
const unconfigured = { enabled: true, hasConfiguredProvider: false, hasEnabledProvider: false };
const view = (draft = "原来的私人草稿", onApply = vi.fn()) => <MemoryRouter><BookKinThemeProvider><AiAssistantButton source="NOTE_DRAFT" draft={draft} onApply={onApply} /></BookKinThemeProvider></MemoryRouter>;
const open = async () => { await act(async () => { fireEvent.click(screen.getByRole("button", { name: "AI 助读" })); }); };
beforeEach(() => { identity.user = { id: "reader-one" }; access.canConfigure = true; vi.mocked(api.getAiServiceAvailability).mockReset().mockResolvedValue(ready); vi.mocked(request).mockReset().mockResolvedValue(value); });

it.each<AiSource>(["NOTE_DRAFT", "METADATA_DRAFT"])("keeps %s results inside the dialog and removes them when closed", async source => {
  const { container } = render(<BookKinThemeProvider><AiAssistantButton source={source} id="source-id" draft="待整理草稿" /></BookKinThemeProvider>);
  await open();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  const result = await screen.findByLabelText("AI 生成结果");
  expect(screen.getByRole("dialog", { name: source.endsWith("_DRAFT") ? "AI 编辑辅助" : "AI 助读" })).toContainElement(result);
  expect(within(container).queryByLabelText("AI 生成结果")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^关闭$/ }));
  await waitFor(() => expect(screen.queryByLabelText("AI 生成结果")).not.toBeInTheDocument());
});

it.each<AiSource>(["ARTICLE", "COLLECTION", "ARTICLE_DRAFT"])("has no AI entry or request for retired %s assistance", source => {
  render(<BookKinThemeProvider><AiAssistantButton source={source} id="source-id" draft="文章草稿" /></BookKinThemeProvider>);
  expect(screen.queryByRole("button", { name: "AI 助读" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});

it("opening sends nothing and an explicit generate click starts the request without a checkbox", async () => {
  render(view()); await open();
  expect(request).not.toHaveBeenCalled();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "生成建议" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  expect(await screen.findByLabelText("AI 生成结果")).toHaveTextContent(value.text);
  expect(screen.queryByText(value.coverage)).not.toBeInTheDocument();
  expect(screen.queryByText(/DeepSeek/)).not.toBeInTheDocument();
  expect(screen.queryByText("原文依据")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "采用建议" })).toBeEnabled();
  expect(JSON.parse(vi.mocked(request).mock.calls[0][1]!.body as string)).toEqual({ source: "NOTE_DRAFT", action: "POLISH", draft: "原来的私人草稿", consent: true });
});
it("suggestions do not overwrite the draft until explicitly adopted", async () => {
  const apply = vi.fn(); render(view("原稿", apply)); await open();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByLabelText("AI 生成结果"); expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "采用建议" }));
  expect(apply).toHaveBeenCalledWith(value.text, "POLISH");
});
it("a draft edited while the request is running cannot be overwritten", async () => {
  let resolve!: (value: AiResult) => void;
  vi.mocked(request).mockReturnValue(new Promise<AiResult>(done => { resolve = done; }));
  const apply = vi.fn(); const rendered = render(view("原稿", apply)); await open();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  rendered.rerender(view("用户新写的内容", apply)); resolve(value);
  await screen.findByLabelText("AI 生成结果");
  expect(screen.getByText(/草稿已变化/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "采用建议" })).toBeDisabled(); expect(apply).not.toHaveBeenCalled();
});
it("reopening clears the result and waits for another generate click", async () => {
  render(view()); await open(); fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByLabelText("AI 生成结果"); fireEvent.click(screen.getByRole("button", { name: /^关闭$/ }));
  await open(); expect(screen.queryByLabelText("AI 生成结果")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "生成建议" })).toBeEnabled();
  expect(request).toHaveBeenCalledTimes(1);
});
it("changing users never exposes the prior result", async () => {
  const rendered = render(view()); await open(); fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByLabelText("AI 生成结果"); identity.user = { id: "reader-two" }; rendered.rerender(view());
  expect(screen.queryByLabelText("AI 生成结果")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "生成建议" })).toBeEnabled();
  expect(request).toHaveBeenCalledTimes(1);
});
it("a failed provider leaves a retry path and preserves the draft", async () => {
  vi.mocked(request).mockRejectedValueOnce(new Error("AI 平台暂不可用"));
  const apply = vi.fn(); render(view("原稿", apply)); await open(); fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  expect(await screen.findByText("AI 平台暂不可用")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByLabelText("AI 生成结果"); expect(apply).not.toHaveBeenCalled();
});
it("oversized drafts are blocked without silently truncating them", async () => {
  render(view("字".repeat(20001))); await open();
  expect(screen.getByText(/单次最多发送 20000 字/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "生成建议" })).toBeDisabled(); expect(request).not.toHaveBeenCalled();
});
it("logged out users have no AI entry", async () => {
  identity.user = null; render(view()); expect(screen.queryByRole("button", { name: "AI 助读" })).not.toBeInTheDocument();
});
it("explains that AI is unconfigured before opening an assistant and links authorized users to its settings panel", async () => {
  vi.mocked(api.getAiServiceAvailability).mockResolvedValue(unconfigured);
  render(view()); await open();
  expect(await screen.findByRole("dialog", { name: "AI 服务尚未配置" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "前往 AI 服务配置" })).toHaveAttribute("href", "/settings#services/ai");
  expect(screen.queryByRole("dialog", { name: "AI 编辑辅助" })).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});
it("directs members to the owner or administrator without exposing an inaccessible settings route", async () => {
  access.canConfigure = false;
  vi.mocked(api.getAiServiceAvailability).mockResolvedValue(unconfigured);
  render(view()); await open();
  expect(await screen.findByRole("dialog", { name: "AI 服务尚未配置" })).toBeInTheDocument();
  expect(screen.getByText("请联系主人或管理员配置 AI 服务。")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "前往 AI 服务配置" })).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});
it("distinguishes disabled AI from an unconfigured provider", async () => {
  vi.mocked(api.getAiServiceAvailability).mockResolvedValue({ enabled: false, hasConfiguredProvider: true, hasEnabledProvider: true });
  render(view()); await open();
  expect(await screen.findByRole("dialog", { name: "AI 服务已关闭" })).toBeInTheDocument();
  expect(screen.queryByText("尚未配置可用的 AI 平台。")).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});
it("does not call an unavailable AI configuration a setup failure when status cannot be read", async () => {
  vi.mocked(api.getAiServiceAvailability).mockRejectedValueOnce(new Error("连接超时"));
  render(view()); await open();
  expect(await screen.findByRole("dialog", { name: "无法检查 AI 服务状态" })).toBeInTheDocument();
  expect(screen.getByText(/检查网络后重试/)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "前往 AI 服务配置" })).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  vi.mocked(api.getAiServiceAvailability).mockResolvedValueOnce(ready);
  fireEvent.click(screen.getByRole("button", { name: "重试检查" }));
  expect(await screen.findByRole("dialog", { name: "AI 编辑辅助" })).toBeInTheDocument();
});
it("uses the shared configuration prompt if service readiness changes before generation", async () => {
  vi.mocked(request).mockRejectedValueOnce(Object.assign(new Error("AI 配置已变化"), { code: "AI_UNAVAILABLE" }));
  render(view()); await open();
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  expect(await screen.findByRole("dialog", { name: "AI 服务当前不可用" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "前往 AI 服务配置" })).toBeInTheDocument();
});
it("does not expose removed book assistance or call AI", () => {
  render(<BookKinThemeProvider><AiAssistantButton source="BOOK" id="book-id" /></BookKinThemeProvider>);
  expect(screen.queryByRole("button", { name: "AI 助读" })).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  expect(api.getAiServiceAvailability).not.toHaveBeenCalled();
});

it("renders readable Markdown without executing HTML or loading model-selected images", async () => {
  vi.mocked(request).mockResolvedValue({ ...value, text: "## 摘要\n\n**要点**\n\n![图片](https://example.invalid/private.png)\n\n<script>alert(1)</script>" });
  render(view()); await open(); fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByRole("heading", { name: "摘要" });
  const result = screen.getByLabelText("AI 生成结果");
  expect(result.querySelector("strong")).toHaveTextContent("要点");
  expect(result.querySelector("script, img, iframe")).toBeNull();
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
