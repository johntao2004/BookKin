import { bookKinThemeOptions } from "../theme/theme";
import { tokens } from "../theme/generated-tokens";
import { highlightColorPresets, readerHighlightStyle } from "./annotation-colors";

const WCAG_AA_NORMAL_TEXT = 4.5;
const REQUIRED_HIGHLIGHT_ALPHA = Math.round(0.34 * 255) / 255;

// WCAG 2.x: linearize sRGB, weight channels by 0.2126/0.7152/0.0722, then
// compare (lighter luminance + 0.05) / (darker luminance + 0.05).
function channels(hex: string) {
  const value = hex.replace(/^#/u, "");
  if (!/^[\da-f]{6}$/iu.test(value)) throw new Error(`Expected a six-digit color, received ${hex}`);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function relativeLuminance(hex: string) {
  const [red, green, blue] = channels(hex).map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const luminances = [relativeLuminance(foreground), relativeLuminance(background)].sort((left, right) => right - left);
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

function compositeHighlight(highlight: string, page: string) {
  const highlightChannels = channels(highlight);
  const pageChannels = channels(page);
  return `#${highlightChannels.map((channel, index) => Math.round(
    channel * 255 * REQUIRED_HIGHLIGHT_ALPHA + pageChannels[index] * 255 * (1 - REQUIRED_HIGHLIGHT_ALPHA),
  ).toString(16).padStart(2, "0")).join("")}`;
}

describe("reader annotation contrast", () => {
  for (const [themeName, themeOption] of Object.entries(bookKinThemeOptions)) {
    for (const preset of highlightColorPresets) {
      it(`${themeName} ${preset.value} keeps reader text at WCAG AA contrast`, () => {
        const style = readerHighlightStyle(preset.value, themeOption.reader);

        expect(style.background).toBe(compositeHighlight(preset.hex, themeOption.reader.background));
        expect(style.color).toBe(themeOption.reader.foreground);
        expect(contrastRatio(style.color, style.background)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
      });
    }
  }

  it("keeps the shared ink-on-light-coral selection pair above WCAG AA", () => {
    expect(contrastRatio(tokens.color.primitive.ink900, tokens.color.primitive.coral100))
      .toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("keeps unhighlighted theme-aware EPUB links above WCAG AA", () => {
    for (const [themeName, themeOption] of Object.entries(bookKinThemeOptions)) {
      const foreground = themeName === "NIGHT"
        ? tokens.color.primitive.coral600
        : tokens.color.primitive.coral700;

      expect(contrastRatio(foreground, themeOption.reader.background))
        .toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
    }
  });
});
