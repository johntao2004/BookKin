import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tokensPath = resolve(root, "design/tokens.json");
const outDir = resolve(root, "apps/web/src/theme");
const check = process.argv.includes("--check");
const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));

const resolveReference = (value) => {
  if (typeof value !== "string" || !value.startsWith("{") || !value.endsWith("}")) return value;
  return value.slice(1, -1).split(".").reduce((node, key) => node[key], tokens);
};

const semanticColors = Object.fromEntries(
  Object.entries(tokens.color.semantic).map(([key, value]) => [key, resolveReference(value)]),
);

const kebab = (value) => value
  .replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
  .replace(/([a-z])([0-9])/g, "$1-$2");

const ts = `/* Generated from design/tokens.json. Do not edit. */\nexport const tokens = ${JSON.stringify({ ...tokens, color: { ...tokens.color, semantic: semanticColors } }, null, 2)} as const;\n`;

const cssPairs = [
  ...Object.entries(tokens.color.primitive).map(([key, value]) => [`--color-primitive-${kebab(key)}`, value]),
  ...Object.entries(semanticColors).map(([key, value]) => [`--color-${kebab(key)}`, value]),
  ...Object.entries(tokens.spacing).map(([key, value]) => [`--spacing-${key}`, `${value}px`]),
  ...Object.entries(tokens.radius).map(([key, value]) => [`--radius-${key}`, `${value}px`]),
  ...Object.entries(tokens.typography.fontFamily).map(([key, value]) => [`--typography-font-family-${kebab(key)}`, value]),
  ...Object.entries(tokens.typography.fontSize).map(([key, value]) => [`--typography-font-size-${kebab(key)}`, `${value}px`]),
  ...Object.entries(tokens.typography.lineHeight).map(([key, value]) => [`--typography-line-height-${kebab(key)}`, value]),
  ...Object.entries(tokens.typography.letterSpacing ?? {}).map(([key, value]) => [`--typography-letter-spacing-${kebab(key)}`, value]),
  ...Object.entries(tokens.typography.fontWeight).map(([key, value]) => [`--typography-font-weight-${kebab(key)}`, value]),
  ...Object.entries(tokens.shadow).map(([key, value]) => [`--shadow-${kebab(key)}`, value]),
  ...Object.entries(tokens.layout).map(([key, value]) => [`--layout-${kebab(key)}`, `${value}px`]),
];
const css = `/* Generated from design/tokens.json. Do not edit. */\n:root {\n${cssPairs.map(([key, value]) => `  ${key}: ${value};`).join("\n")}\n}\n`;

const outputs = [
  [resolve(outDir, "generated-tokens.ts"), ts],
  [resolve(outDir, "generated-tokens.css"), css],
];

if (check) {
  const stale = outputs.filter(([path, content]) => !existsSync(path) || readFileSync(path, "utf8") !== content);
  if (stale.length) {
    console.error(`Generated design tokens are stale: ${stale.map(([path]) => path).join(", ")}`);
    process.exit(1);
  }
} else {
  mkdirSync(outDir, { recursive: true });
  outputs.forEach(([path, content]) => writeFileSync(path, content));
}
