import { createTheme } from "@mui/material/styles";
import type { ReaderTheme } from "../components/readers/reader-fonts";
import { tokens } from "./generated-tokens";

type BookKinThemeColors = { [Key in keyof typeof tokens.color.semantic]: string };

export interface BookKinThemeOption {
  label: string;
  reader: { background: string; foreground: string; muted: string };
  colors: BookKinThemeColors;
}

const semantic = tokens.color.semantic;

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

export function createBookKinTheme(mode: ReaderTheme) {
  const colors = bookKinThemeOptions[mode].colors;
  return createTheme({
  cssVariables: {
    colorSchemeSelector: "data-bookkin-color-scheme",
  },
  palette: {
    mode: mode === "NIGHT" ? "dark" : "light",
    primary: {
      main: colors.primary,
      dark: colors.primaryHover,
      light: colors.primarySoft,
      contrastText: tokens.color.primitive.white,
    },
    secondary: {
      main: colors.focus,
    },
    success: { main: colors.success },
    warning: { main: colors.warning },
    error: { main: colors.error },
    background: {
      default: colors.canvas,
      paper: colors.surface,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textMuted,
    },
    divider: colors.border,
  },
  typography: {
    fontFamily: tokens.typography.fontFamily.body,
    h1: {
      fontFamily: tokens.typography.fontFamily.display,
      fontSize: tokens.typography.fontSize.displayLg,
      fontWeight: tokens.typography.fontWeight.regular,
      lineHeight: tokens.typography.lineHeight.tight,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontFamily: tokens.typography.fontFamily.display,
      fontSize: tokens.typography.fontSize.display,
      fontWeight: tokens.typography.fontWeight.regular,
      lineHeight: tokens.typography.lineHeight.heading,
      letterSpacing: "-0.015em",
    },
    h3: {
      fontFamily: tokens.typography.fontFamily.display,
      fontSize: tokens.typography.fontSize.heading,
      fontWeight: tokens.typography.fontWeight.regular,
      lineHeight: tokens.typography.lineHeight.heading,
    },
    h4: {
      fontFamily: tokens.typography.fontFamily.display,
      fontSize: tokens.typography.fontSize.headingSm,
      fontWeight: tokens.typography.fontWeight.regular,
      lineHeight: tokens.typography.lineHeight.heading,
    },
    h5: {
      fontFamily: tokens.typography.fontFamily.display,
      fontSize: tokens.typography.fontSize.title,
      fontWeight: tokens.typography.fontWeight.regular,
      lineHeight: tokens.typography.lineHeight.heading,
    },
    h6: {
      fontFamily: tokens.typography.fontFamily.display,
      fontSize: tokens.typography.fontSize.titleSm,
      fontWeight: tokens.typography.fontWeight.medium,
      lineHeight: tokens.typography.lineHeight.heading,
    },
    body1: {
      fontSize: tokens.typography.fontSize.body,
      lineHeight: tokens.typography.lineHeight.body,
    },
    body2: {
      fontSize: tokens.typography.fontSize.bodySm,
      lineHeight: tokens.typography.lineHeight.body,
    },
    button: {
      fontWeight: tokens.typography.fontWeight.medium,
      letterSpacing: 0,
      textTransform: "none",
    },
    caption: {
      fontSize: tokens.typography.fontSize.caption,
      lineHeight: tokens.typography.lineHeight.ui,
    },
  },
  shape: {
    borderRadius: tokens.radius.md,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: tokens.layout.breakpointMobile,
      md: tokens.layout.breakpointTablet,
      lg: tokens.layout.breakpointDesktop,
      xl: 1920,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          backgroundColor: colors.canvas,
          colorScheme: mode === "NIGHT" ? "dark" : "light",
        },
        body: {
          backgroundColor: colors.canvas,
          color: colors.textPrimary,
          transition: "background-color 180ms ease, color 180ms ease",
        },
        "::selection": {
          backgroundColor: colors.primarySoft,
          color: colors.textPrimary,
        },
        "*:focus-visible": {
          outline: `2px solid ${colors.focus}`,
          outlineOffset: 2,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: tokens.layout.touchTarget,
          borderRadius: tokens.radius.md,
          paddingInline: tokens.spacing[5],
        },
        contained: {
          backgroundColor: colors.primary,
          "&:hover": { backgroundColor: colors.primaryHover },
        },
        outlined: {
          borderColor: colors.border,
          color: colors.textPrimary,
          "&:hover": {
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSoft,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: tokens.layout.touchTarget,
          minHeight: tokens.layout.touchTarget,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: tokens.layout.touchTarget,
          borderRadius: tokens.radius.md,
          backgroundColor: colors.surface,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: colors.border },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: colors.borderStrong },
          "&.Mui-focused": { boxShadow: tokens.shadow.focus },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: colors.focus },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.lg,
          backgroundImage: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: tokens.radius.xl,
          backgroundColor: colors.surface,
          backgroundImage: "none",
          boxShadow: tokens.shadow.popover,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.sm,
          fontWeight: tokens.typography.fontWeight.medium,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: mode === "NIGHT" ? colors.surfaceSoft : colors.surfaceDark,
          color: colors.textOnDark,
          borderRadius: tokens.radius.sm,
          fontSize: tokens.typography.fontSize.caption,
        },
      },
    },
  },
  });
}

export const theme = createBookKinTheme("PAPER");
