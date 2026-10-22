import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ConfigProvider from "antd/es/config-provider";
import antdTheme from "antd/es/theme";
import zhCN from "antd/locale/zh_CN";
import { vi } from "vitest";
import { bookKinThemeOptions, createAntdTheme } from "../theme/theme";
import type { ReaderTheme } from "../components/readers/reader-fonts";
import { ConfirmationProvider, useConfirmation } from "./confirmations";

function ThemeSample({ label = "确认框主题" }: { label?: string }) {
  const { token } = antdTheme.useToken();
  return <output aria-label={label}>{JSON.stringify({ primary: token.colorPrimary, surface: token.colorBgElevated, radius: token.borderRadius })}</output>;
}

function Trigger({ onOk }: { onOk: () => void }) {
  const modal = useConfirmation();
  return <button onClick={() => modal.confirm({ title: "删除确认", content: <ThemeSample />, okText: "删除", okButtonProps: { danger: true }, onOk })}>打开确认框</button>;
}

function view(mode: ReaderTheme, onOk: () => void) {
  const theme = createAntdTheme(mode);
  return <ConfigProvider locale={zhCN} theme={{ ...theme, token: { ...theme.token, motion: false } }}>
    <ThemeSample label="页面主题" />
    <ConfirmationProvider><Trigger onOk={onOk} /></ConfirmationProvider>
  </ConfigProvider>;
}

describe("theme-bound confirmations", () => {
  it.each(["PAPER", "WHITE", "NIGHT"] as const)("inherits %s colors, geometry and locale without executing on cancel", async mode => {
    const onOk = vi.fn();
    render(view(mode, onOk));
    fireEvent.click(screen.getByRole("button", { name: "打开确认框" }));
    const sample = await screen.findByLabelText("确认框主题");
    const { primary, surface, radius } = JSON.parse(sample.textContent!);
    expect(primary).toBe(JSON.parse(screen.getByLabelText("页面主题").textContent!).primary);
    expect(surface.toLowerCase()).toBe(bookKinThemeOptions[mode].colors.surfaceCard.toLowerCase());
    expect(radius).toBe(createAntdTheme(mode).token.borderRadius);
    expect(screen.getByRole("button", { name: /删\s*除/ })).toHaveClass("ant-btn-dangerous");
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));
    await waitFor(() => expect(screen.queryByLabelText("确认框主题")).not.toBeInTheDocument());
    expect(onOk).not.toHaveBeenCalled();
  });

  it("updates an open confirmation when the shared theme changes", async () => {
    const onOk = vi.fn();
    const { rerender } = render(view("PAPER", onOk));
    fireEvent.click(screen.getByRole("button", { name: "打开确认框" }));
    await screen.findByLabelText("确认框主题");
    rerender(view("NIGHT", onOk));
    await waitFor(() => expect(JSON.parse(screen.getByLabelText("确认框主题").textContent!).surface.toLowerCase())
      .toBe(bookKinThemeOptions.NIGHT.colors.surfaceCard.toLowerCase()));
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));
    expect(onOk).not.toHaveBeenCalled();
  });
});
