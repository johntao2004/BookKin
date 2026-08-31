import type { ReaderFont, ReaderFontKind } from "../../domain/types";
import { tokens } from "../../theme/generated-tokens";

export type ReaderTheme = "PAPER" | "WHITE" | "NIGHT";

export interface ReaderSettings {
  fontId: string;
  fontSize: number;
  pageTurnEnabled: boolean;
  theme: ReaderTheme;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontId: "noto-serif-sc",
  fontSize: 19,
  pageTurnEnabled: true,
  theme: "PAPER",
};

export const PRESET_READER_FONTS: ReaderFont[] = [
  {
    id: "noto-serif-sc",
    displayName: "Noto Serif SC",
    familyName: "Noto Serif SC",
    kind: "SERIF",
    source: "PRESET",
    status: "ENABLED",
    format: "WOFF2",
    contentUrl: "/fonts/noto-fonts.css",
    licenseNote: "SIL Open Font License 1.1 · Google Noto CJK",
  },
  {
    id: "noto-sans-sc",
    displayName: "Noto Sans SC",
    familyName: "Noto Sans SC",
    kind: "SANS",
    source: "PRESET",
    status: "ENABLED",
    format: "WOFF2",
    contentUrl: "/fonts/noto-fonts.css",
    licenseNote: "SIL Open Font License 1.1 · Google Noto CJK",
  },
  {
    id: "source-han-serif-sc",
    displayName: "Source Han Serif SC",
    familyName: "Source Han Serif SC",
    kind: "SERIF",
    source: "PRESET",
    status: "ENABLED",
    format: "WOFF2",
    contentUrl: "/fonts/source-han-serif-sc-regular.woff2",
    licenseNote: "SIL Open Font License 1.1 · Adobe Source Han Serif",
  },
  {
    id: "source-han-sans-sc",
    displayName: "Source Han Sans SC",
    familyName: "Source Han Sans SC",
    kind: "SANS",
    source: "PRESET",
    status: "ENABLED",
    format: "WOFF2",
    contentUrl: "/fonts/source-han-sans-sc-regular.woff2",
    licenseNote: "SIL Open Font License 1.1 · Adobe Source Han Sans",
  },
];

export const READER_FONT_FAMILY_BY_KIND: Record<ReaderFontKind, string> = {
  SERIF: tokens.typography.fontFamily.readerSerif,
  SANS: tokens.typography.fontFamily.readerSans,
};

export function readerFontFamily(font?: Pick<ReaderFont, "familyName" | "kind">): string {
  if (!font) return READER_FONT_FAMILY_BY_KIND.SERIF;
  const fallback = READER_FONT_FAMILY_BY_KIND[font.kind];
  if (font.familyName === "Noto Serif SC" || font.familyName === "Noto Sans SC") return fallback;
  return `"${font.familyName}", ${fallback}`;
}

export function readReaderSettings(storageKey: string, fonts?: ReaderFont[]): ReaderSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<ReaderSettings> | null;
    const fontId = typeof parsed?.fontId === "string" && (!fonts || fonts.some((font) => font.id === parsed.fontId && font.status === "ENABLED"))
      ? parsed.fontId
      : DEFAULT_READER_SETTINGS.fontId;
    const fontSize = typeof parsed?.fontSize === "number" && parsed.fontSize >= 16 && parsed.fontSize <= 28
      ? parsed.fontSize
      : DEFAULT_READER_SETTINGS.fontSize;
    const theme = parsed?.theme === "PAPER" || parsed?.theme === "WHITE" || parsed?.theme === "NIGHT"
      ? parsed.theme
      : DEFAULT_READER_SETTINGS.theme;
    const pageTurnEnabled = typeof parsed?.pageTurnEnabled === "boolean"
      ? parsed.pageTurnEnabled
      : DEFAULT_READER_SETTINGS.pageTurnEnabled;
    return { fontId, fontSize, pageTurnEnabled, theme };
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}
