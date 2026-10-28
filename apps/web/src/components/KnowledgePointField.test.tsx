import { api } from "../api/client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { BookKnowledgeDraft } from "../domain/types";
import { TestProviders } from "../test/TestProviders";
import { KnowledgePointField } from "./KnowledgePointField";

beforeEach(() => {
  vi.spyOn(api, "listMetadataTerms").mockResolvedValue({ items: [] });
  vi.spyOn(api, "ensureMetadataTerms").mockImplementation(async (kind, items) => ({ items: items.map(item => ({ ...item, kind, id: item.value })) }));
});
afterEach(() => vi.restoreAllMocks());

const draft: BookKnowledgeDraft = {
  points: [
    { name: "有效知识点", quote: "原文明确给出这项结论。", locator: "page:2" },
    { name: "无引文知识点", quote: "", locator: "page:3" },
    { name: "无定位知识点", quote: "虽有引文但没有定位。", locator: "" },
  ],
  fingerprint: "sha256:book-content",
  sampledSections: 3,
  totalSections: 7,
};

function visibleOptions(): string[] {
  return [...document.querySelectorAll(".ant-select-item-option-content")].map(option => option.textContent?.trim() ?? "");
}

it("preserves only genuine evidence while allowing shared manual terms", async () => {
  render(<TestProviders><KnowledgePointField id="metadata-knowledge" value={draft} onChange={vi.fn()} aiEnabled={false} /></TestProviders>);
  const select = screen.getByRole("combobox", { name: "知识点" });
  expect(select).toBeInTheDocument();
  expect(select).not.toBeDisabled();
  expect(screen.queryByRole("textbox", { name: "知识点" })).not.toBeInTheDocument();

  fireEvent.mouseDown(select);
  await waitFor(() => expect(visibleOptions()).toContain("有效知识点"));
  expect(visibleOptions()).not.toContain("无引文知识点");
  expect(visibleOptions()).not.toContain("无定位知识点");
  expect(screen.queryByText(draft.points[0]!.quote)).not.toBeInTheDocument();
  expect(screen.queryByText(draft.points[0]!.locator)).not.toBeInTheDocument();
});

it("deletes only the selected point while retaining the other evidence", async () => {
  const onChange = vi.fn();
  const validDraft: BookKnowledgeDraft = { ...draft, points: draft.points.slice(0, 1).concat({ name: "第二项", quote: "第二条依据。", locator: "page:4" }) };
  const { container } = render(<TestProviders><KnowledgePointField id="metadata-knowledge" value={validDraft} onChange={onChange} aiEnabled={false} /></TestProviders>);
  const firstTag = [...container.querySelectorAll(".ant-select-selection-item")].find(item => item.textContent?.includes("有效知识点"));
  const remove = firstTag?.querySelector(".ant-select-selection-item-remove");
  expect(remove).toBeTruthy();
  fireEvent.mouseDown(remove!);
  fireEvent.click(remove!);

  await waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...validDraft, points: [validDraft.points[1]] }));
});

it('creates a reusable manual term without manufacturing source evidence', async () => {
  const onTermsChange = vi.fn();
  const onChange = vi.fn();
  render(<TestProviders><KnowledgePointField id="terms" value={draft} onChange={onChange} terms={[]} onTermsChange={onTermsChange} aiEnabled={false} /></TestProviders>);
  const input = screen.getByRole('combobox', { name: '知识点' });
  fireEvent.change(input, { target: { value: '新的知识词条' } });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
  await waitFor(() => expect(onTermsChange).toHaveBeenCalledWith(['有效知识点', '新的知识词条']));
  expect(onChange).not.toHaveBeenCalled();
  expect(api.ensureMetadataTerms).toHaveBeenCalledWith('KNOWLEDGE', [{ value: '新的知识词条', label: '新的知识词条' }]);
});

it('clears a search prefix before blur when linking an existing shared term', async () => {
  vi.mocked(api.listMetadataTerms).mockResolvedValue({ items: [{ id: 'shared', kind: 'KNOWLEDGE', value: '共享知识词条', label: '共享知识词条' }] });
  const onTermsChange = vi.fn();
  render(<TestProviders><KnowledgePointField id="shared" terms={[]} onTermsChange={onTermsChange} aiEnabled={false} /></TestProviders>);
  const input = screen.getByRole('combobox', { name: '知识点' });
  fireEvent.mouseDown(input);
  fireEvent.change(input, { target: { value: '共享知识' } });
  const option = await screen.findByText('共享知识词条', { selector: '.ant-select-item-option-content' });
  fireEvent.click(option);
  fireEvent.blur(input);
  await waitFor(() => expect(onTermsChange).toHaveBeenCalledWith(['共享知识词条']));
  expect(onTermsChange).not.toHaveBeenCalledWith(['共享知识']);
  expect(api.ensureMetadataTerms).not.toHaveBeenCalled();
});
