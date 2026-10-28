import { fireEvent, render, screen } from "@testing-library/react";
import { BookKinThemeProvider } from "../theme/BookKinThemeProvider";
import { PublicationMonthField } from "./PublicationMonthField";

vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "month-editor" } }) }));

it("shows an existing full date at month precision without changing stored metadata", () => {
  const onChange = vi.fn();
  render(<BookKinThemeProvider><PublicationMonthField value="2025-03-12" onChange={onChange} /></BookKinThemeProvider>);
  expect(screen.getByRole("textbox", { name: "出版日期" })).toHaveValue("2025年03月");
  expect(onChange).not.toHaveBeenCalled();
});

it("selects a publication month and emits a month without a fabricated day", () => {
  const onChange = vi.fn();
  render(<BookKinThemeProvider><PublicationMonthField value="2025-03-12" onChange={onChange} /></BookKinThemeProvider>);
  fireEvent.click(screen.getByRole("textbox", { name: "出版日期" }));
  for (const month of ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]) {
    expect(screen.getByText(month, { exact: true })).toBeInTheDocument();
  }
  expect(screen.queryByText("Jan", { exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByTitle("2025-04"));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("2025-04");
});

it("keeps a legacy year unselected rather than inventing January and allows clearing it", () => {
  const onChange = vi.fn();
  render(<BookKinThemeProvider><PublicationMonthField value="2026" onChange={onChange} /></BookKinThemeProvider>);
  expect(screen.getByRole("textbox", { name: "出版日期" })).toHaveValue("");
  expect(screen.getByPlaceholderText("2026年")).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "清除出版日期" }));
  expect(onChange).toHaveBeenCalledWith("");
});

it("honors disabled metadata editing and leaves an unknown date intact", () => {
  const onChange = vi.fn();
  render(<BookKinThemeProvider><PublicationMonthField value="待考" onChange={onChange} disabled /></BookKinThemeProvider>);
  expect(screen.getByRole("textbox", { name: "出版日期" })).toBeDisabled();
  expect(screen.getByPlaceholderText("待考")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "清除出版日期" })).toBeDisabled();
  expect(onChange).not.toHaveBeenCalled();
});
