import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { LanguageField } from "./LanguageField";
import { TestProviders } from "../test/TestProviders";
import { api } from "../api/client";

afterEach(() => vi.restoreAllMocks());

function ControlledLanguageField({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState("");
  return <><LanguageField value={value} onChange={setValue} disabled={disabled} /><span data-testid="serialized-value">{value}</span></>;
}

function findVisibleOption(label: string): HTMLElement {
  const contents = document.querySelectorAll(".ant-select-item-option-content");
  const content = [...contents].find((item) => item.textContent?.trim() === label);
  const option = content?.closest(".ant-select-item-option");
  if (!(option instanceof HTMLElement)) throw new Error(`Missing visible language option: ${label}`);
  return option;
}

it("selects multiple named languages and clears the complete value", async () => {
  const { container } = render(<TestProviders><ControlledLanguageField /></TestProviders>);
  const combobox = screen.getByRole("combobox", { name: "语言" });

  fireEvent.mouseDown(combobox);
  await waitFor(() => expect(findVisibleOption("中文")).toBeInTheDocument());
  fireEvent.mouseDown(findVisibleOption("中文"));
  fireEvent.click(findVisibleOption("中文"));
  expect(screen.getByTestId("serialized-value")).toHaveTextContent("zh");

  fireEvent.mouseDown(combobox);
  await waitFor(() => expect(findVisibleOption("英文")).toBeInTheDocument());
  fireEvent.mouseDown(findVisibleOption("英文"));
  fireEvent.click(findVisibleOption("英文"));
  expect(screen.getByTestId("serialized-value")).toHaveTextContent("zh,en");

  const select = container.querySelector(".ant-select")!;
  fireEvent.mouseEnter(select);
  const clear = container.querySelector(".ant-select-clear")!;
  fireEvent.mouseDown(clear);
  fireEvent.click(clear);
  await waitFor(() => expect(screen.getByTestId("serialized-value")).toHaveTextContent(""));
});

it("searches by English names and aliases while displaying only Chinese names", async () => {
  render(<TestProviders><ControlledLanguageField /></TestProviders>);
  const combobox = screen.getByRole("combobox", { name: "语言" });
  fireEvent.mouseDown(combobox);

  fireEvent.change(combobox, { target: { value: "English" } });
  await waitFor(() => expect([...document.querySelectorAll(".ant-select-item-option-content")].map((item) => item.textContent?.trim())).toContain("英文"));
  expect(document.querySelector(".ant-select-dropdown-list-holder-inner")).not.toHaveTextContent("English");
  fireEvent.change(combobox, { target: { value: "zho" } });
  await waitFor(() => expect([...document.querySelectorAll(".ant-select-item-option-content")].map((item) => item.textContent?.trim())).toEqual(["中文"]));
  fireEvent.click(findVisibleOption("中文"));
  expect(screen.getByTestId("serialized-value")).toHaveTextContent(/^zh$/);
  fireEvent.change(combobox, { target: { value: "English" } });
  await waitFor(() => expect(findVisibleOption("英文")).toBeInTheDocument());
  fireEvent.click(findVisibleOption("英文"));
  expect(screen.getByTestId("serialized-value")).toHaveTextContent(/^zh,en$/);
});

it("retains custom language creation through the shared vocabulary", async () => {
  vi.spyOn(api, "listMetadataTerms").mockResolvedValue({ items: [] });
  const ensure = vi.spyOn(api, "ensureMetadataTerms").mockResolvedValue({
    items: [{ id: "custom-language", kind: "LANGUAGE", value: "自定义方言", label: "自定义方言" }],
  });
  render(<TestProviders><ControlledLanguageField /></TestProviders>);
  const combobox = screen.getByRole("combobox", { name: "语言" });
  fireEvent.mouseDown(combobox);
  fireEvent.change(combobox, { target: { value: "自定义方言" } });
  await waitFor(() => expect(findVisibleOption("自定义方言")).toBeInTheDocument());
  fireEvent.click(findVisibleOption("自定义方言"));
  await waitFor(() => expect(screen.getByTestId("serialized-value")).toHaveTextContent(/^自定义方言$/));
  expect(ensure).toHaveBeenCalledWith("LANGUAGE", [{ value: "自定义方言", label: "自定义方言" }]);
});

it("shows an unknown legacy value as a generic label and disables the picker", () => {
  const { rerender } = render(<TestProviders><LanguageField value="qzx" onChange={vi.fn()} /></TestProviders>);
  expect(screen.getByRole("combobox", { name: "语言" })).toBeInTheDocument();
  const select = document.querySelector(".ant-select")!;
  expect(select).toHaveTextContent("未识别语言");
  expect(select).not.toHaveTextContent("qzx");

  rerender(<TestProviders><LanguageField value="qzx" onChange={vi.fn()} disabled /></TestProviders>);
  expect(screen.getByRole("combobox", { name: "语言" })).toBeDisabled();
});
