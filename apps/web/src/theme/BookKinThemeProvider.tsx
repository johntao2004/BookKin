import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useAuth } from "../auth/AuthContext";
import { readReaderSettings, type ReaderTheme } from "../components/readers/reader-fonts";
import { createBookKinTheme } from "./theme";

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
    document.documentElement.dataset.bookkinTheme = mode.toLowerCase();
    document.documentElement.style.colorScheme = mode === "NIGHT" ? "dark" : "light";
  }, [mode]);

  const muiTheme = useMemo(() => createBookKinTheme(mode), [mode]);
  const value = useMemo<BookKinThemeContextValue>(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <BookKinThemeContext.Provider value={value}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </BookKinThemeContext.Provider>
  );
}

export function useBookKinTheme() {
  return useContext(BookKinThemeContext);
}
