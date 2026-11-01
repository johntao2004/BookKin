// 统一阅读字体、偏好默认值与存储解析；不可用设置回退到可用预设。
// Centralizes reader fonts, preference defaults and storage parsing with fallbacks for unavailable settings.
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
  fontId: "source-han-sans-sc",
  fontSize: 19,
  pageTurnEnabled: true,
  theme: "PAPER",
};

export const PRESET_READER_FONTS: ReaderFont[] = [
  {
    id: "source-han-sans-sc",
    displayName: "思源黑体",
    familyName: "Source Han Sans SC",
    kind: "SANS",
    source: "PRESET",
    status: "ENABLED",
    format: "WOFF2",
    contentUrl: "/fonts/source-han-sans-sc-regular.woff2",
    licenseNote: "SIL Open Font License 1.1 · Adobe Source Han Sans",
  },
];

const LEGACY_BUILT_IN_FONT_IDS = new Set([
  "noto-serif-sc",
  "noto-sans-sc",
  "source-han-serif-sc",
  "alibaba-puhuiti",
]);

export const READER_FONT_FAMILY_BY_KIND: Record<ReaderFontKind, string> = {
  SERIF: tokens.typography.fontFamily.readerSans,
  SANS: tokens.typography.fontFamily.readerSans,
};

export function readerFontFamily(font?: Pick<ReaderFont, "familyName" | "kind" | "source">): string {
  if (!font || font.source === "PRESET") return tokens.typography.fontFamily.readerSans;
  const fallback = READER_FONT_FAMILY_BY_KIND[font.kind];
  return `"${font.familyName}", ${fallback}`;
}

export function readReaderSettings(storageKey: string, fonts?: ReaderFont[]): ReaderSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<ReaderSettings> | null;
    const storedFontId = typeof parsed?.fontId === "string" ? parsed.fontId : undefined;
    const migratedFontId = storedFontId && LEGACY_BUILT_IN_FONT_IDS.has(storedFontId)
      ? DEFAULT_READER_SETTINGS.fontId
      : storedFontId;
    const fontId = migratedFontId && (!fonts || fonts.some((font) => font.id === migratedFontId && font.status === "ENABLED"))
      ? migratedFontId
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
