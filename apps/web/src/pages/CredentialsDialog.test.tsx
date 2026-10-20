import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { CredentialsDialog } from "./UsersPage";

it("shows the username as text, copies only the read-only password and closes with Done", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    render(<TestProviders><CredentialsDialog value={{ username: "test-member", temporaryPassword: "Test-only-password" }} onClose={onClose} /></TestProviders>);
    expect(screen.getByText("test-member")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "用户名" })).not.toBeInTheDocument();
    const password = screen.getByRole("textbox", { name: "临时密码" });
    expect(password).toHaveAttribute("readonly");
    const copy = screen.getByRole("button", { name: "复制临时密码" });
    expect(password.closest(".bk-field-control")).toContainElement(copy);
    expect(screen.queryByRole("button", { name: "复制登录信息" })).not.toBeInTheDocument();
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Test-only-password"));
    expect(await screen.findByRole("button", { name: "已复制临时密码" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成" }));
    expect(onClose).toHaveBeenCalledOnce();
  } finally {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});
