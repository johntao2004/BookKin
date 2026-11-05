// 统一整站与阅读器主题状态，把持久选择传播至 Ant Design 和共享 UI。
// Shares theme state across site and reader, propagating persisted choices to Ant Design and shared UI.
import zhCN from "antd/locale/zh_CN";
import "dayjs/locale/zh-cn";
import { FeedbackProvider } from "../ui/notifications";
import { ConfirmationProvider } from "../ui/confirmations";
import { ConfigProvider } from "../ui/antd";
import { CssBaseline, UiThemeProvider } from "../ui/primitives";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useAuth } from "../auth/AuthContext";
import { readReaderSettings, type ReaderTheme } from "../components/readers/reader-fonts";
import { silvaeThemeOptions, createAntdTheme, createSilvaeTheme } from "./theme";

const silvaeThemeStorageKey = "silvae-site-theme";
const hiddenLoadingIndicator = <span aria-hidden="true" />;

interface SilvaeThemeContextValue {
  mode: ReaderTheme;
  setMode: (mode: ReaderTheme) => void;
}

const SilvaeThemeContext = createContext<SilvaeThemeContextValue>({ mode: "PAPER", setMode: () => undefined });

function isReaderTheme(value: string | null): value is ReaderTheme {
  return value === "PAPER" || value === "WHITE" || value === "NIGHT";
}

function readStoredTheme(readerSettingsKey: string): ReaderTheme {
  const stored = localStorage.getItem(silvaeThemeStorageKey);
  return isReaderTheme(stored) ? stored : readReaderSettings(readerSettingsKey).theme;
}

function applyColorVariables(mode: ReaderTheme) {
  const colors = silvaeThemeOptions[mode].colors;
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    const cssKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    root.style.setProperty(`--color-${cssKey}`, value);
  });
  root.dataset.silvaeTheme = mode.toLowerCase();
  root.style.colorScheme = mode === "NIGHT" ? "dark" : "light";
}

export function SilvaeThemeProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const readerSettingsKey = `silvae-reader-settings:${user?.id ?? "anonymous"}`;
  const [mode, setModeState] = useState<ReaderTheme>(() => readStoredTheme(readerSettingsKey));

  useEffect(() => {
    setModeState(readStoredTheme(readerSettingsKey));
  }, [readerSettingsKey]);

  const setMode = useCallback((nextMode: ReaderTheme) => {
    setModeState(nextMode);
    localStorage.setItem(silvaeThemeStorageKey, nextMode);
    const readerSettings = readReaderSettings(readerSettingsKey);
    localStorage.setItem(readerSettingsKey, JSON.stringify({ ...readerSettings, theme: nextMode }));
  }, [readerSettingsKey]);

  useEffect(() => {
    localStorage.setItem(silvaeThemeStorageKey, mode);
    applyColorVariables(mode);
  }, [mode]);

  const uiTheme = useMemo(() => createSilvaeTheme(mode), [mode]);
  const antdTheme = useMemo(() => createAntdTheme(mode), [mode]);
  const value = useMemo<SilvaeThemeContextValue>(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <SilvaeThemeContext.Provider value={value}>
      <ConfigProvider locale={zhCN} theme={antdTheme} wave={{ disabled: true }} spin={{ indicator: hiddenLoadingIndicator }}>
        <UiThemeProvider theme={uiTheme}>
          <CssBaseline />
          <FeedbackProvider><ConfirmationProvider>{children}</ConfirmationProvider></FeedbackProvider>
        </UiThemeProvider>
      </ConfigProvider>
    </SilvaeThemeContext.Provider>
  );
}

export function useSilvaeTheme() {
  return useContext(SilvaeThemeContext);
}
