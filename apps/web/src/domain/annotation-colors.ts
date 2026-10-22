// 把批注颜色标识映射到共享色值与背景透明度，未知值沿用既定回退。
// Maps annotation color identifiers to shared colors/opacity with defined fallbacks for unknown values.
import type { AnnotationColor, HighlightColor } from "./types";
import { tokens } from "../theme/generated-tokens";

export const highlightColorPresets: ReadonlyArray<{ value: HighlightColor; label: string; hex: string }> = [
  { value: "YELLOW", label: "黄色", hex: tokens.color.primitive.highlightYellow },
  { value: "GREEN", label: "绿色", hex: tokens.color.primitive.highlightGreen },
  { value: "PINK", label: "粉色", hex: tokens.color.primitive.highlightPink },
  { value: "BLUE", label: "蓝色", hex: tokens.color.primitive.highlightBlue },
  { value: "ORANGE", label: "橙色", hex: tokens.color.primitive.highlightOrange },
];

export const READABLE_HIGHLIGHT_OPACITY = 0.34;

const legacyColorMap: Record<Exclude<AnnotationColor, HighlightColor>, HighlightColor> = {
  CORAL: "ORANGE",
  GOLD: "YELLOW",
  TEAL: "GREEN",
};

export function annotationColorHex(color?: AnnotationColor | string) {
  const normalized = color && color in legacyColorMap
    ? legacyColorMap[color as keyof typeof legacyColorMap]
    : color;
  return highlightColorPresets.find((preset) => preset.value === normalized)?.hex ?? highlightColorPresets[0].hex;
}

export function annotationColorBackground(color?: AnnotationColor | string, opacity = READABLE_HIGHLIGHT_OPACITY) {
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, "0");
  return `${annotationColorHex(color)}${alpha}`;
}

export interface AnnotationTextTheme {
  background: string;
  foreground: string;
}

// Preblend once against the page so overlapping highlights cannot wash out
// night-mode text. Explicit text color also keeps highlighted links readable.
export function readerHighlightStyle(color: AnnotationColor | string | undefined, theme: AnnotationTextTheme) {
  const highlight = annotationColorHex(color).slice(1);
  const page = (/^#[\da-f]{6}$/i.test(theme.background) ? theme.background : tokens.color.semantic.canvas).slice(1);
  const alpha = Math.round(READABLE_HIGHLIGHT_OPACITY * 255) / 255;
  const background = `#${[0, 2, 4].map(offset => {
    const foregroundChannel = Number.parseInt(highlight.slice(offset, offset + 2), 16);
    const backgroundChannel = Number.parseInt(page.slice(offset, offset + 2), 16);
    return Math.round(foregroundChannel * alpha + backgroundChannel * (1 - alpha)).toString(16).padStart(2, "0");
  }).join("")}`;
  return { background, color: theme.foreground };
}
