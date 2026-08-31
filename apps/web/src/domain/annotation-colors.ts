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
