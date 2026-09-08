import antdTheme from "antd/es/theme";
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
const breakpointValues: Record<string, number> = {
  xs: 0,
  sm: tokens.layout.breakpointMobile,
  md: tokens.layout.breakpointTablet,
  lg: tokens.layout.breakpointDesktop,
  xl: 1920,
};

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
      surfaceCard: tokens.color.primitive.white,
      surfaceSoft: semantic.canvas,
      surfaceStrong: semantic.surfaceSoft,
      surfaceCreamStrong: semantic.surfaceSoft,
    },
  },
  NIGHT: {
    label: "夜间",
    reader: { background: semantic.surfaceDark, foreground: semantic.textOnDark, muted: tokens.color.primitive.ink300 },
    colors: {
      ...semantic,
      canvas: semantic.surfaceDark,
      surface: semantic.surfaceDarkRaised,
      surfaceCard: semantic.surfaceDarkRaised,
      surfaceSoft: semantic.surfaceDarkSoft,
      surfaceStrong: tokens.color.primitive.ink700,
      surfaceCreamStrong: semantic.surfaceDarkRaised,
      textPrimary: semantic.textOnDark,
      bodyStrong: semantic.textOnDark,
      textSecondary: tokens.color.primitive.cream300,
      textMuted: tokens.color.primitive.ink300,
      textMutedSoft: tokens.color.primitive.ink300,
      textOnDarkSoft: tokens.color.primitive.ink400,
      border: tokens.color.primitive.ink700,
      borderSoft: tokens.color.primitive.ink700,
      borderStrong: tokens.color.primitive.ink500,
      primarySoft: tokens.color.primitive.coral700,
      focus: semantic.primary,
    },
  },
};

export function createBookKinTheme(mode: ReaderTheme): UiTheme {
  const colors = bookKinThemeOptions[mode].colors;
  return {
    palette: {
      mode: mode === "NIGHT" ? "dark" : "light",
      primary: { main: colors.primary, light: colors.primarySoft, dark: colors.primaryHover },
      secondary: { main: colors.accentTeal },
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
    breakpoints: { down: (key) => `@media (max-width: ${(breakpointValues[key] ?? tokens.layout.breakpointMobile) - 0.05}px)`, up: (key) => `@media (min-width: ${breakpointValues[key] ?? 0}px)` },
    zIndex: { fab: 1100 },
  };
}

export function createAntdTheme(mode: ReaderTheme) {
  const colors = bookKinThemeOptions[mode].colors;
  return {
    algorithm: mode === "NIGHT" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    components: {
      Button: {
        controlHeight: tokens.layout.controlHeight,
        controlHeightSM: 32,
        controlHeightLG: 48,
        paddingInline: tokens.spacing[5],
        paddingInlineSM: tokens.spacing[3],
        paddingInlineLG: tokens.spacing[6],
        borderRadius: tokens.radius.md,
        primaryShadow: "none",
        defaultShadow: "none",
        dangerShadow: "none",
        fontWeight: tokens.typography.fontWeight.medium,
      },
      Card: {
        borderRadiusLG: tokens.radius.lg,
        colorBorderSecondary: colors.borderSoft,
        colorBgContainer: colors.surfaceCard,
        boxShadow: "none",
        boxShadowTertiary: "none",
        bodyPadding: tokens.spacing.xl,
      },
      Dropdown: {
        borderRadiusLG: tokens.radius.lg,
        controlItemBgHover: colors.surfaceSoft,
        controlItemBgActive: colors.surfaceStrong,
        controlItemBgActiveHover: colors.surfaceStrong,
      },
      Input: {
        activeBorderColor: colors.primary,
        hoverBorderColor: colors.primary,
        activeShadow: tokens.shadow.focus,
        colorBgContainer: colors.canvas,
        controlHeight: tokens.layout.controlHeight,
        borderRadius: tokens.radius.md,
        paddingInline: tokens.layout.inputPaddingInline,
        paddingBlock: tokens.layout.inputPaddingBlock,
      },
      Modal: {
        borderRadiusLG: tokens.radius.lg,
        contentBg: colors.surfaceCard,
        headerBg: colors.surfaceCard,
        boxShadow: "none",
      },
      Drawer: {
        colorBgElevated: colors.surfaceCard,
        paddingLG: tokens.spacing.lg,
      },
      Menu: {
        itemBorderRadius: tokens.radius.md,
        itemSelectedBg: colors.surfaceStrong,
        itemHoverBg: colors.surfaceSoft,
        itemSelectedColor: colors.textPrimary,
      },
      Select: {
        optionSelectedBg: colors.surfaceStrong,
        optionSelectedColor: colors.textPrimary,
        optionActiveBg: colors.surfaceSoft,
        activeBorderColor: colors.primary,
        hoverBorderColor: colors.primary,
        activeOutlineColor: colors.primarySoft,
        controlHeight: tokens.layout.controlHeight,
        borderRadius: tokens.radius.md,
      },
      Table: {
        headerBg: colors.surfaceSoft,
        headerColor: colors.textSecondary,
        rowHoverBg: colors.surfaceSoft,
        borderColor: colors.border,
      },
      Tag: {
        defaultBg: colors.surfaceCard,
        defaultColor: colors.textPrimary,
      },
    },
    token: {
      colorPrimary: colors.primary,
      colorPrimaryHover: colors.primaryHover,
      colorPrimaryActive: colors.primaryHover,
      colorTextLightSolid: colors.textOnPrimary,
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorError: colors.error,
      colorInfo: colors.focus,
      colorText: colors.textPrimary,
      colorTextSecondary: colors.textSecondary,
      colorTextTertiary: colors.textMuted,
      colorTextQuaternary: colors.textMutedSoft,
      colorTextPlaceholder: colors.textMuted,
      colorTextDisabled: colors.textMutedSoft,
      colorIcon: colors.textSecondary,
      colorIconHover: colors.textPrimary,
      colorBgBase: colors.canvas,
      colorBgLayout: colors.canvas,
      colorBgContainer: colors.surfaceCard,
      colorBgElevated: colors.surfaceCard,
      colorBorder: colors.border,
      colorBorderSecondary: colors.borderSoft,
      colorFillAlter: colors.surfaceSoft,
      colorFillSecondary: colors.surfaceSoft,
      colorFillTertiary: colors.surfaceCard,
      colorFillQuaternary: colors.surfaceStrong,
      colorLink: colors.primary,
      colorLinkHover: colors.primary,
      colorLinkActive: colors.primaryHover,
      colorTextDescription: colors.textMuted,
      colorInfoBg: colors.surfaceSoft,
      colorInfoBorder: colors.border,
      colorWarningBg: colors.surfaceSoft,
      colorWarningBorder: colors.border,
      colorErrorBg: colors.surfaceSoft,
      colorErrorBorder: colors.border,
      colorSuccessBg: colors.surfaceSoft,
      colorSuccessBorder: colors.border,
      borderRadius: tokens.radius.md,
      borderRadiusSM: tokens.radius.sm,
      borderRadiusLG: tokens.radius.lg,
      borderRadiusXS: tokens.radius.xs,
      controlHeight: tokens.layout.controlHeight,
      controlHeightSM: 32,
      controlHeightLG: 48,
      paddingXS: tokens.spacing.xs,
      paddingSM: tokens.spacing.sm,
      padding: tokens.spacing.md,
      paddingLG: tokens.spacing.lg,
      marginXS: tokens.spacing.xs,
      marginSM: tokens.spacing.sm,
      margin: tokens.spacing.md,
      marginLG: tokens.spacing.lg,
      boxShadow: "none",
      boxShadowSecondary: tokens.shadow.popover,
      fontFamily: tokens.typography.fontFamily.body,
      fontSize: tokens.typography.fontSize.body,
      lineHeight: tokens.typography.lineHeight.body,
      fontSizeSM: tokens.typography.fontSize.bodySm,
      fontSizeLG: tokens.typography.fontSize.titleSm,
    },
  };
}

export const theme = createBookKinTheme("PAPER");
