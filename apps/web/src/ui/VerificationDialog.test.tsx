import { useState } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { OneTimeCodeInput, RecoveryCodeInput, VerificationDialog } from "./VerificationDialog";
import { TestProviders } from "../test/TestProviders";
import { ConfigProvider } from "./antd";

it("distributes a pasted code over six cells and completes only when all digits are present", async () => {
  const complete = vi.fn();
  function Fixture() { const [value, setValue] = useState(""); return <OneTimeCodeInput value={value} onInput={setValue} onComplete={complete} />; }
  render(<TestProviders><Fixture /></TestProviders>);
  const inputs = within(screen.getByRole("group", { name: "6 位动态码" })).getAllByRole("textbox");
  expect(inputs).toHaveLength(6); expect(inputs[0]).toHaveFocus();
  fireEvent.input(inputs[0], { target: { value: "12abc" } });
  expect(complete).not.toHaveBeenCalled();
  fireEvent.input(inputs[0], { target: { value: "123456" } });
  await waitFor(() => expect(complete).toHaveBeenCalledWith("123456"));
  expect(inputs.map(input => (input as HTMLInputElement).value)).toEqual(["1", "2", "3", "4", "5", "6"]);
  await waitFor(() => expect(inputs[5]).toHaveFocus());
});

it("supports keyboard navigation and clears the controlled digits for retry", async () => {
  const onInput = vi.fn(); const { rerender } = render(<TestProviders><OneTimeCodeInput value="123456" onInput={onInput} /></TestProviders>);
  const inputs = within(screen.getByRole("group", { name: "6 位动态码" })).getAllByRole("textbox");
  inputs[5].focus(); fireEvent.keyDown(inputs[5], { key: "ArrowLeft" }); expect(inputs[4]).toHaveFocus();
  rerender(<TestProviders><OneTimeCodeInput value="" onInput={onInput} invalid /></TestProviders>);
  await waitFor(() => expect(inputs.every(input => !(input as HTMLInputElement).value)).toBe(true)); expect(inputs[0]).toHaveFocus();
});

it("uses an accessible modal with a cancel action", async () => {
  const cancel = vi.fn();
  render(<TestProviders><ConfigProvider theme={{ token: { motion: false } }}><VerificationDialog title="验证身份" description="请输入身份验证器中的动态码" error="验证码已过期" onCancel={cancel}><span>验证内容</span></VerificationDialog></ConfigProvider></TestProviders>);
  await waitFor(() => expect(screen.getByRole("dialog", { name: "验证身份" })).toBeVisible()); expect(screen.getByRole("alert")).toHaveTextContent("验证码已过期");
  fireEvent.click(screen.getByRole("button", { name: /Close|关闭/ })); expect(cancel).toHaveBeenCalledOnce();
});

it("pastes a full recovery code into 32 hex cells and clears it for retry", async () => {
  function Fixture() {
    const [value, setValue] = useState("");
    return <><RecoveryCodeInput value={value} onInput={setValue} /><button onClick={() => setValue("")}>重试</button></>;
  }
  render(<TestProviders><Fixture /></TestProviders>);
  const group = screen.getByRole("group", { name: "32 位备用码" });
  const inputs = within(group).getAllByRole("textbox");
  expect(inputs).toHaveLength(32); expect(inputs[0]).toHaveFocus();
  fireEvent.paste(inputs[0], { clipboardData: { getData: () => "01234567-89abcdef-01234567-89abcdef" } });
  await waitFor(() => expect(inputs.map(input => (input as HTMLInputElement).value).join("")).toBe("0123456789ABCDEF0123456789ABCDEF"));
  await waitFor(() => expect(inputs[31]).toHaveFocus());
  fireEvent.keyDown(inputs[31], { key: "ArrowLeft" }); expect(inputs[30]).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await waitFor(() => expect(inputs.every(input => !(input as HTMLInputElement).value)).toBe(true));
  expect(inputs[0]).toHaveFocus();
});
