import { api } from "../api/client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { TestProviders } from "../test/TestProviders";
import { parseTags, TagField } from "./TagField";

function ControlledTagField({ initialValue = "", disabled = false }: { initialValue?: string; disabled?: boolean }) {
  const [value, setValue] = useState(initialValue);
  return <>
    <TagField value={value} onChange={setValue} disabled={disabled} />
    <output data-testid="serialized-tags">{value}</output>
  </>;
}

describe("TagField", () => {
  beforeEach(() => {
    vi.spyOn(api, "listMetadataTerms").mockResolvedValue({ items: [] });
    vi.spyOn(api, "ensureMetadataTerms").mockImplementation(async (kind, items) => ({ items: items.map(item => ({ ...item, kind, id: item.value })) }));
  });
  afterEach(() => vi.restoreAllMocks());
  it("parses legacy delimiters, trims values and removes duplicates", () => {
    expect(parseTags(" 古籍，古籍; 馆藏,\n历史；馆藏 ")).toEqual(["古籍", "馆藏", "历史"]);
  });

  it("adds a free-form tag with Enter and retains the stored delimiter", async () => {
    render(<TestProviders><ControlledTagField initialValue="已有;已有" /></TestProviders>);
    const input = screen.getByRole("combobox", { name: "标签" });

    fireEvent.change(input, { target: { value: " 新标签 " } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13, keyCode: 13 });

    await waitFor(() => expect(screen.getByTestId("serialized-tags")).toHaveTextContent("已有;新标签"));
  });

  it("accepts comma, semicolon and newline separators with trim and deduplication", async () => {
    render(<TestProviders><ControlledTagField initialValue="已有，已有" /></TestProviders>);
    const input = screen.getByRole("combobox", { name: "标签" });

    fireEvent.change(input, { target: { value: " 新增,另一个；新增," } });

    await waitFor(() => expect(screen.getByTestId("serialized-tags")).toHaveTextContent("已有，新增，另一个"));
  });

  it("commits pending input on blur so it is not lost on save", async () => {
    render(<TestProviders><ControlledTagField initialValue="已有,馆藏" /></TestProviders>);
    const input = screen.getByRole("combobox", { name: "标签" });

    fireEvent.change(input, { target: { value: "正在输入" } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByTestId("serialized-tags")).toHaveTextContent("已有,馆藏,正在输入"));
  });

  it("removes one tag, clears all tags and disables editing", async () => {
    const { container, rerender } = render(<TestProviders><ControlledTagField initialValue="甲；乙" /></TestProviders>);
    const firstRemove = container.querySelector(".ant-select-selection-item-remove");
    expect(firstRemove).toBeTruthy();
    fireEvent.mouseDown(firstRemove!);
    fireEvent.click(firstRemove!);
    await waitFor(() => expect(screen.getByTestId("serialized-tags")).toHaveTextContent("乙"));

    const select = container.querySelector(".ant-select")!;
    fireEvent.mouseEnter(select);
    const clear = container.querySelector(".ant-select-clear");
    expect(clear).toBeTruthy();
    fireEvent.mouseDown(clear!);
    fireEvent.click(clear!);
    await waitFor(() => expect(screen.getByTestId("serialized-tags")).toHaveTextContent(/^$/));

    rerender(<TestProviders><ControlledTagField key="locked" initialValue="锁定" disabled /></TestProviders>);
    const input = screen.getByRole("combobox", { name: "标签" });
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { value: "不可编辑" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13, keyCode: 13 });
    expect(screen.getByTestId("serialized-tags")).toHaveTextContent("锁定");
  });
});
