import type { ReaderTheme } from "../components/readers/reader-fonts";
import type { UiTheme } from "../ui/primitives";
import { tokens } from "./generated-tokens";

type BookKinThemeColors = { [Key in keyof typeof tokens.color.semantic]: string };

export interface BookKinThemeOption {
  label: string;
  reader: { background: string; foreground: string; muted: string };
  colors: BookKinThemeColors;
}

const semantic = tokens.color.semantic;
const breakpointValues: Record<string, number> = { xs: 0, sm: 600, md: 1024, lg: 1440, xl: 1920 };

export const bookKinThemeOptions: Record<ReaderTheme, BookKinThemeOption> = {
  PAPER: {
    label: "纸张",
    reader: { background: semantic.canvas, foreground: semantic.textPrimary, muted: semantic.textMuted },
    colors: semantic,
  },
  WHITE: {
    label: "明亮",
    reader: { background: tokens.color.primitive.white, foreground: semantic.textPrimary, muted: semantic.textMuted },
    colors: {
      ...semantic,
      canvas: tokens.color.primitive.white,
      surface: tokens.color.primitive.white,
      surfaceSoft: tokens.color.primitive.cream100,
      surfaceStrong: tokens.color.primitive.cream200,
    },
  },
  NIGHT: {
    label: "夜间",
    reader: { background: semantic.surfaceDark, foreground: semantic.textOnDark, muted: tokens.color.primitive.ink300 },
    colors: {
      ...semantic,
      canvas: semantic.surfaceDark,
      surface: semantic.surfaceDarkRaised,
      surfaceSoft: tokens.color.primitive.ink700,
      surfaceStrong: tokens.color.primitive.ink500,
      textPrimary: semantic.textOnDark,
      textSecondary: tokens.color.primitive.cream300,
      textMuted: tokens.color.primitive.ink300,
      border: tokens.color.primitive.ink700,
      borderStrong: tokens.color.primitive.ink500,
      primarySoft: tokens.color.primitive.coral700,
      focus: tokens.color.primitive.teal500,
    },
  },
};

export function createBookKinTheme(mode: ReaderTheme): UiTheme {
  const colors = bookKinThemeOptions[mode].colors;
  return {
    palette: {
      mode: mode === "NIGHT" ? "dark" : "light",
      primary: { main: colors.primary, light: colors.primarySoft, dark: colors.primaryHover },
      secondary: { main: colors.focus },
      success: { main: colors.success },
      warning: { main: colors.warning },
      error: { main: colors.error },
      background: { default: colors.canvas, paper: colors.surface },
      text: { primary: colors.textPrimary, secondary: colors.textSecondary, disabled: colors.textMuted, onDark: colors.textOnDark },
      divider: colors.border,
      action: { hover: colors.surfaceSoft },
    },
    spacing: (value) => `${value * 8}px`,
    shape: { borderRadius: tokens.radius.md },
    transitions: {
      create: (properties, options = {}) => `${Array.isArray(properties) ? properties.join(", ") : properties} ${options.duration ?? 180}ms ${options.easing ?? "cubic-bezier(0.4, 0, 0.2, 1)"}`,
      duration: { standard: 180, shorter: 120 },
      easing: { easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)" },
    },
    breakpoints: { down: (key) => `@media (max-width: ${(breakpointValues[key] ?? 600) - 0.05}px)`, up: (key) => `@media (min-width: ${breakpointValues[key] ?? 0}px)` },
    zIndex: { fab: 1100 },
  };
}

export function createAntdTheme(mode: ReaderTheme) {
  const colors = bookKinThemeOptions[mode].colors;
  return {
    token: {
      colorPrimary: colors.primary,
      colorPrimaryHover: colors.primaryHover,
      colorPrimaryActive: colors.primaryHover,
      colorTextLightSolid: tokens.color.primitive.white,
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorError: colors.error,
      colorInfo: colors.focus,
      colorText: colors.textPrimary,
      colorTextSecondary: colors.textSecondary,
      colorBgBase: colors.canvas,
      colorBgContainer: colors.surface,
      colorBgElevated: colors.surface,
      colorBorder: colors.border,
      colorBorderSecondary: colors.border,
      colorFillAlter: colors.surfaceSoft,
      colorInfoBg: colors.surfaceSoft,
      colorInfoBorder: colors.border,
      colorWarningBg: colors.surfaceSoft,
      colorWarningBorder: colors.border,
      colorErrorBg: colors.surfaceSoft,
      colorErrorBorder: colors.border,
      colorSuccessBg: colors.surfaceSoft,
      colorSuccessBorder: colors.border,
      borderRadius: tokens.radius.md,
      fontFamily: tokens.typography.fontFamily.body,
      fontSize: tokens.typography.fontSize.body,
    },
  };
}

export const theme = createBookKinTheme("PAPER");
