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
import { bookKinThemeOptions, createAntdTheme, createBookKinTheme } from "./theme";

const bookKinThemeStorageKey = "bookkin-site-theme";

interface BookKinThemeContextValue {
  mode: ReaderTheme;
  setMode: (mode: ReaderTheme) => void;
}

const BookKinThemeContext = createContext<BookKinThemeContextValue>({ mode: "PAPER", setMode: () => undefined });

function isReaderTheme(value: string | null): value is ReaderTheme {
  return value === "PAPER" || value === "WHITE" || value === "NIGHT";
}

function readStoredTheme(readerSettingsKey: string): ReaderTheme {
  const stored = localStorage.getItem(bookKinThemeStorageKey);
  return isReaderTheme(stored) ? stored : readReaderSettings(readerSettingsKey).theme;
}

function applyColorVariables(mode: ReaderTheme) {
  const colors = bookKinThemeOptions[mode].colors;
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    const cssKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    root.style.setProperty(`--color-${cssKey}`, value);
  });
  root.dataset.bookkinTheme = mode.toLowerCase();
  root.style.colorScheme = mode === "NIGHT" ? "dark" : "light";
}

export function BookKinThemeProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const readerSettingsKey = `bookkin-reader-settings:${user?.id ?? "anonymous"}`;
  const [mode, setModeState] = useState<ReaderTheme>(() => readStoredTheme(readerSettingsKey));

  useEffect(() => {
    setModeState(readStoredTheme(readerSettingsKey));
  }, [readerSettingsKey]);

  const setMode = useCallback((nextMode: ReaderTheme) => {
    setModeState(nextMode);
    localStorage.setItem(bookKinThemeStorageKey, nextMode);
    const readerSettings = readReaderSettings(readerSettingsKey);
    localStorage.setItem(readerSettingsKey, JSON.stringify({ ...readerSettings, theme: nextMode }));
  }, [readerSettingsKey]);

  useEffect(() => {
    localStorage.setItem(bookKinThemeStorageKey, mode);
    applyColorVariables(mode);
  }, [mode]);

  const uiTheme = useMemo(() => createBookKinTheme(mode), [mode]);
  const antdTheme = useMemo(() => createAntdTheme(mode), [mode]);
  const value = useMemo<BookKinThemeContextValue>(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <BookKinThemeContext.Provider value={value}>
      <ConfigProvider locale={zhCN} theme={antdTheme} wave={{ disabled: true }}>
        <UiThemeProvider theme={uiTheme}>
          <CssBaseline />
          <FeedbackProvider><ConfirmationProvider>{children}</ConfirmationProvider></FeedbackProvider>
        </UiThemeProvider>
      </ConfigProvider>
    </BookKinThemeContext.Provider>
  );
}

export function useBookKinTheme() {
  return useContext(BookKinThemeContext);
}
