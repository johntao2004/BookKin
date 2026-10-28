import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { request } from "../api/client";
import { BookKinThemeProvider } from "../theme/BookKinThemeProvider";
import { MetadataEditorForm, type MetadataEditorValues } from "./MetadataEditorForm";

vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "metadata-editor" } }) }));
vi.mock("../api/client", () => ({ request: vi.fn(), api: { listMetadataTerms: vi.fn().mockResolvedValue({ items: [] }) } }));

it("adopts author biography only into its own field", async () => {
  const onChange = vi.fn();
  const value: MetadataEditorValues = {
    title: "书名", subtitle: "", authors: "作者甲", translators: "", language: "zh",
    publisher: "", publishedDate: "", isbn: "", series: "", seriesIndex: "", tags: "现有标签",
    description: "现有简介", authorBiography: "已有作者资料", tableOfContents: "第一章", publiclyVisible: true,
  };
  vi.mocked(request).mockReset().mockResolvedValue({ text: "整理后的作者介绍", evidence: [], provider: "provider", model: "model", sourceTitle: "草稿", included: 1, total: 1, coverage: "草稿" });
  render(<QueryClientProvider client={new QueryClient()}><BookKinThemeProvider><MetadataEditorForm value={value} onChange={onChange} coverAlt="封面" coverActions={null} aiEnabled /></BookKinThemeProvider></QueryClientProvider>);

  expect(screen.getByRole("textbox", { name: "内容简介" })).toHaveValue("现有简介");
  const button = screen.getByRole("button", { name: "AI 生成作者介绍" });
  expect(button).toHaveTextContent(/^AI$/);
  fireEvent.click(button);
  expect(await screen.findByRole("dialog", { name: "AI 作者介绍建议" })).toBeInTheDocument();
  expect(await screen.findByLabelText("AI 生成结果")).toHaveTextContent("整理后的作者介绍");
  expect(onChange).not.toHaveBeenCalled();
  const payload = JSON.parse(vi.mocked(request).mock.calls[0][1]!.body as string);
  expect(payload.action).toBe("AUTHOR_BIOGRAPHY");
  expect(JSON.parse(payload.draft)).toMatchObject({ title: "书名", authors: "作者甲", authorBiography: "已有作者资料" });
  fireEvent.click(screen.getByRole("button", { name: "采用建议" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("authorBiography", "整理后的作者介绍");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
