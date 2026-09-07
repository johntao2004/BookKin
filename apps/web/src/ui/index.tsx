export { default as Tabs } from "antd/es/tabs";
export { default as Skeleton } from "antd/es/skeleton";
export { default as Dropdown } from "antd/es/dropdown";
import AntAlert from "antd/es/alert";
import AntAvatar from "antd/es/avatar";
import AntButton from "antd/es/button";
import AntCard from "antd/es/card";
import AntCheckbox from "antd/es/checkbox";
import ConfigProvider from "antd/es/config-provider";
import AntDivider from "antd/es/divider";
import AntDrawer from "antd/es/drawer";
import AntInput from "antd/es/input";
import AntList from "antd/es/list";
import AntModal from "antd/es/modal";
import AntProgress from "antd/es/progress";
import AntRadio from "antd/es/radio";
import AntSelect from "antd/es/select";
import AntSlider from "antd/es/slider";
import AntSpin from "antd/es/spin";
import AntSwitch from "antd/es/switch";
import AntTable from "antd/es/table";
import AntTag from "antd/es/tag";
import AntTooltip from "antd/es/tooltip";
import type {
  CSSProperties,
  ElementType,
  ForwardedRef,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Children,
  Fragment,
  cloneElement,
  createContext,
  createElement,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from "react";
import { tokens } from "../theme/generated-tokens";

export type Theme = UiTheme;
export type SxObject = Record<string, any>;
export type SxProps<T = UiTheme> = SxObject | Array<SxObject | false | null | undefined> | ((theme: T) => SxObject);

export interface UiTheme {
  palette: {
    mode: "light" | "dark";
    primary: { main: string; light: string; dark: string };
    secondary: { main: string };
    success: { main: string };
    warning: { main: string };
    error: { main: string };
    background: { default: string; paper: string };
    text: { primary: string; secondary: string; disabled: string; onDark: string };
    divider: string;
    action: { hover: string };
  };
  spacing: (value: number) => string;
  shape: { borderRadius: number };
  transitions: {
    create: (properties: string | string[], options?: { duration?: number; easing?: string }) => string;
    duration: { standard: number; shorter: number };
    easing: { easeInOut: string };
  };
  breakpoints: { down: (key: string) => string; up: (key: string) => string };
  zIndex: { fab: number };
}

const breakpointValues: Record<string, number> = { xs: 0, sm: 600, md: 1024, lg: 1440, xl: 1920 };

const defaultTheme: UiTheme = {
  palette: {
    mode: "light",
    primary: { main: tokens.color.semantic.primary, light: tokens.color.semantic.primarySoft, dark: tokens.color.semantic.primaryHover },
    secondary: { main: tokens.color.semantic.focus },
    success: { main: tokens.color.semantic.success },
    warning: { main: tokens.color.semantic.warning },
    error: { main: tokens.color.semantic.error },
    background: { default: tokens.color.semantic.canvas, paper: tokens.color.semantic.surface },
    text: {
      primary: tokens.color.semantic.textPrimary,
      secondary: tokens.color.semantic.textSecondary,
      disabled: tokens.color.semantic.textMuted,
      onDark: tokens.color.semantic.textOnDark,
    },
    divider: tokens.color.semantic.border,
    action: { hover: tokens.color.semantic.surfaceSoft },
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

const UiThemeContext = createContext<UiTheme>(defaultTheme);
export function useTheme() {
  return useContext(UiThemeContext);
}

export function UiThemeProvider({ theme, children }: { theme: UiTheme; children: ReactNode }) {
  return <UiThemeContext.Provider value={theme}>{children}</UiThemeContext.Provider>;
}

export { ConfigProvider };

const styleCache = new Set<string>();
let keyframeCounter = 0;

function cssVarPath(value: string) {
  const colors: Record<string, string> = {
    "text.primary": "var(--color-text-primary)",
    "text.secondary": "var(--color-text-secondary)",
    "text.disabled": "var(--color-text-muted)",
    "primary.main": "var(--color-primary)",
    primary: "var(--color-primary)",
    "primary.light": "var(--color-primary-soft)",
    "primary.dark": "var(--color-primary-hover)",
    "secondary.main": "var(--color-focus)",
    // MUI derived `secondary.dark` was used by the original theme for the
    // reading-progress card and the authentication artwork layer.  Keep the
    // semantic mapping here so those surfaces do not silently fall back to an
    // invalid CSS value after the Ant Design migration.
    "secondary.light": "color-mix(in srgb, var(--color-focus) 78%, var(--color-primitive-white))",
    "secondary.dark": "color-mix(in srgb, var(--color-focus) 78%, var(--color-primitive-black))",
    "success.main": "var(--color-success)",
    success: "var(--color-success)",
    "warning.main": "var(--color-warning)",
    warning: "var(--color-warning)",
    "error.main": "var(--color-error)",
    error: "var(--color-error)",
    "background.default": "var(--color-canvas)",
    "background.paper": "var(--color-surface)",
    divider: "var(--color-border)",
    "action.hover": "var(--color-surface-soft)",
    "common.white": "var(--color-primitive-white)",
    "common.black": "var(--color-primitive-black)",
  };
  return colors[value] ?? value;
}

const unitlessCssProperties = new Set([
  "animationIterationCount",
  "columnCount",
  "fillOpacity",
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "gridArea",
  "gridColumn",
  "gridColumnEnd",
  "gridColumnStart",
  "gridRow",
  "gridRowEnd",
  "gridRowStart",
  "lineHeight",
  "opacity",
  "order",
  "orphans",
  "tabSize",
  "widows",
  "zIndex",
  "zoom",
]);

function cssValue(key: string, value: unknown): string | undefined {
  if (value === undefined || value === null || value === false || typeof value === "object") return undefined;
  if (typeof value === "number") {
    if (unitlessCssProperties.has(key)) return String(value);
    if (["margin", "marginTop", "marginRight", "marginBottom", "marginLeft", "marginInline", "marginBlock", "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "paddingInline", "paddingBlock", "gap", "rowGap", "columnGap"].includes(key)) return `${value * 8}px`;
    if (key === "borderRadius") return `${value * 4}px`;
    if (key === "border") return `${value}px solid var(--color-border)`;
    return `${value}px`;
  }
  if (typeof value === "string") return cssVarPath(value);
  return String(value);
}

const aliases: Record<string, string> = {
  bgcolor: "backgroundColor",
  m: "margin",
  mt: "marginTop",
  mr: "marginRight",
  mb: "marginBottom",
  ml: "marginLeft",
  mx: "marginInline",
  my: "marginBlock",
  p: "padding",
  pt: "paddingTop",
  pr: "paddingRight",
  pb: "paddingBottom",
  pl: "paddingLeft",
  px: "paddingInline",
  py: "paddingBlock",
};

function kebabCase(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function flattenSx(sx: SxProps | undefined, theme: UiTheme): SxObject {
  if (!sx) return {};
  if (typeof sx === "function") return sx(theme);
  if (Array.isArray(sx)) return Object.assign({}, ...sx.filter(Boolean).map((item) => flattenSx(item as SxProps, theme)));
  return sx;
}

const responsiveBreakpoints = ["xs", "sm", "md", "lg", "xl"] as const;
type ResponsiveBreakpoint = (typeof responsiveBreakpoints)[number];

function isResponsiveValue(value: unknown): value is Record<ResponsiveBreakpoint, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => responsiveBreakpoints.includes(key as ResponsiveBreakpoint));
}

function appendDeclaration(target: string[], key: string, rawValue: unknown) {
  const value = cssValue(key, rawValue);
  if (value !== undefined) target.push(`${kebabCase(key)}: ${value};`);
}

function appendDeclarations(target: string[], style: SxObject, responsive: Record<ResponsiveBreakpoint, string[]>) {
  Object.entries(style).forEach(([rawKey, rawValue]) => {
    if (rawKey.startsWith("&") || rawKey.startsWith("@")) return;
    const key = aliases[rawKey] ?? rawKey;
    if (key === "border" && typeof rawValue === "string" && /^\d+$/.test(rawValue)) {
      target.push(`border: ${rawValue}px solid var(--color-border);`);
      return;
    }
    if (isResponsiveValue(rawValue)) {
      if (rawValue.xs !== undefined) appendDeclaration(responsive.xs, key, rawValue.xs);
      responsiveBreakpoints.slice(1).forEach((breakpoint) => {
        if (rawValue[breakpoint] !== undefined) appendDeclaration(responsive[breakpoint], key, rawValue[breakpoint]);
      });
      return;
    }
    appendDeclaration(target, key, rawValue);
  });
}

function buildSxCss(selector: string, style: SxObject) {
  const declarations: string[] = [];
  const responsive: Record<ResponsiveBreakpoint, string[]> = { xs: [], sm: [], md: [], lg: [], xl: [] };
  appendDeclarations(declarations, style, responsive);
  let css = declarations.length ? `${selector}{${declarations.join("")}}` : "";
  Object.entries(style).forEach(([key, value]) => {
    if (key.startsWith("&")) {
      if (value && typeof value === "object") css += buildSxCss(key.replaceAll("&", selector), value as SxObject);
    } else if (key.startsWith("@media") && value && typeof value === "object") {
      css += `${key}{${buildSxCss(selector, value as SxObject)}}`;
    }
  });
  responsiveBreakpoints.forEach((breakpoint) => {
    if (responsive[breakpoint].length) {
      css += `@media (min-width: ${breakpointValues[breakpoint]}px){${selector}{${responsive[breakpoint].join("")}}}`;
    }
  });
  return css;
}

function sxClassName(sx: SxProps | undefined, theme: UiTheme) {
  const style = flattenSx(sx, theme);
  if (!Object.keys(style).length) return "";
  const serialized = JSON.stringify(style);
  let hash = 0;
  for (let index = 0; index < serialized.length; index += 1) hash = ((hash << 5) - hash + serialized.charCodeAt(index)) | 0;
  const name = `bk-sx-${Math.abs(hash)}`;
  if (typeof document !== "undefined" && !styleCache.has(name)) {
    const tag = document.createElement("style");
    tag.dataset.bookkinSx = name;
    tag.textContent = buildSxCss(`.${name}`, style);
    document.head.appendChild(tag);
    styleCache.add(name);
  }
  return name;
}

function mergeClassNames(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ") || undefined;
}

type BoxProps = Record<string, any> & {
  component?: ElementType;
  sx?: SxProps;
  children?: ReactNode;
  onClick?: (event: any) => void;
  onKeyDown?: (event: any) => void;
  onBlur?: (event: any) => void;
  onFocus?: (event: any) => void;
};

export const Box = forwardRef<HTMLElement, BoxProps>(function Box({ component: Component = "div", sx, className, children, ...props }, ref) {
  return createElement(Component, { ...props, ref, className: mergeClassNames("bk-box", sxClassName(sx, useTheme()), className) }, children);
});

type StackProps = BoxProps & {
  direction?: "row" | "column" | { xs?: "row" | "column"; sm?: "row" | "column"; md?: "row" | "column"; lg?: "row" | "column"; xl?: "row" | "column" };
  spacing?: number;
  divider?: ReactNode;
};

export const Stack = forwardRef<HTMLElement, StackProps>(function Stack({ direction = "column", spacing, divider, useFlexGap: _useFlexGap, sx, children, ...props }, ref) {
  const stackSx: SxObject = {
    display: "flex",
    flexDirection: direction,
    gap: spacing === undefined ? undefined : `${spacing * 8}px`,
    ...flattenSx(sx, useTheme()),
  };
  const items = Children.toArray(children);
  const content = divider ? items.flatMap((item, index) => index === 0 ? [item] : [divider, item]) : items;
  return <Box ref={ref} sx={stackSx} {...props}>{content}</Box>;
});

const typographyElements: Record<string, string> = { h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6", body1: "p", body2: "p", caption: "span", overline: "span", subtitle1: "p", subtitle2: "p" };
const typographyStyles: Record<string, CSSProperties> = {
  h1: { fontFamily: "var(--typography-font-family-display)", fontSize: "var(--typography-font-size-display-lg)", fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.02em" },
  h2: { fontFamily: "var(--typography-font-family-display)", fontSize: "var(--typography-font-size-display)", fontWeight: 400, lineHeight: 1.25, letterSpacing: "-0.015em" },
  h3: { fontFamily: "var(--typography-font-family-display)", fontSize: "var(--typography-font-size-heading)", fontWeight: 400, lineHeight: 1.25 },
  h4: { fontFamily: "var(--typography-font-family-display)", fontSize: "var(--typography-font-size-heading-sm)", fontWeight: 400, lineHeight: 1.25 },
  h5: { fontFamily: "var(--typography-font-family-display)", fontSize: "var(--typography-font-size-title)", fontWeight: 400, lineHeight: 1.25 },
  h6: { fontFamily: "var(--typography-font-family-display)", fontSize: "var(--typography-font-size-title-sm)", fontWeight: 500, lineHeight: 1.25 },
  body1: { fontSize: "var(--typography-font-size-body)", lineHeight: 1.65 },
  body2: { fontSize: "var(--typography-font-size-body-sm)", lineHeight: 1.65 },
  caption: { fontSize: "var(--typography-font-size-caption)", lineHeight: 1.4 },
  overline: { fontSize: "var(--typography-font-size-caption)", lineHeight: 1.4, letterSpacing: "0.12em", textTransform: "uppercase" },
};

export function Typography({ variant = "body1", component, color, noWrap, align, sx, className, children, ...props }: BoxProps & { variant?: string; component?: ElementType; color?: string; noWrap?: boolean; align?: CSSProperties["textAlign"] }) {
  const Component = component ?? typographyElements[variant] ?? "span";
  const theme = useTheme();
  const colorValue = color ? cssVarPath(color) : undefined;
  const { style: inlineStyle, ...restProps } = props;
  // Keep the base typography and the caller's `sx` in the same generated
  // stylesheet.  Inline font declarations prevent responsive sx values (for
  // example `fontSize: { xs: ..., md: ... }`) from taking effect because an
  // inline style always wins over the media-query rule.
  const typographySx: SxObject = {
    margin: 0,
    ...typographyStyles[variant],
    ...(colorValue ? { color: colorValue } : {}),
    ...(noWrap ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : {}),
    ...(align ? { textAlign: align } : {}),
    ...flattenSx(sx, theme),
    ...(inlineStyle ?? {}),
  };
  return createElement(Component, { ...restProps, className: mergeClassNames("bk-typography", `bk-typography-${variant}`, sxClassName(typographySx, theme), className) }, children);
}

type ButtonProps = Record<string, any> & {
  variant?: "contained" | "outlined" | "text";
  color?: string;
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  component?: ElementType;
  to?: string;
  href?: string;
  sx?: SxProps;
  disableElevation?: boolean;
  children?: ReactNode;
  onClick?: (event: any) => void;
  onChange?: (event: any) => void;
  onKeyDown?: (event: any) => void;
};

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button({ variant = "text", color, size = "medium", fullWidth, startIcon, endIcon, component: Component, to, href, sx, className, children, type, ...props }, ref) {
  const theme = useTheme();
  const antdType = variant === "contained" ? "primary" : variant === "outlined" ? "default" : "text";
  const isError = color === "error" || color === "error.main";
  // Keep the legacy color prop in the same generated stylesheet as `sx` so a
  // caller's semantic color (for example the active desktop nav item) can
  // override the default Ant button tone without an inline-style conflict.
  const colorSx = isError && variant !== "contained" ? { color: "var(--color-error)", borderColor: "var(--color-error)" } : undefined;
  // Ant wraps a Fragment in one text span, which swallows the flex gap between
  // its icon and label. Keep icons in their own slots for every button variant.
  const leadingIcon = startIcon ? <span className="bk-button-icon">{startIcon}</span> : undefined;
  const trailingIcon = endIcon ? <span className="bk-button-icon" key="end-icon">{endIcon}</span> : undefined;
  const classes = mergeClassNames("bk-button", `bk-button-${variant}`, sxClassName({ ...colorSx, ...flattenSx(sx, theme) }, theme), className);
  const style = { width: fullWidth ? "100%" : undefined };
  if (Component) return createElement(Component, { ...props, ref, to, href, className: classes, style }, leadingIcon, children, trailingIcon);
  return <AntButton ref={ref as ForwardedRef<HTMLButtonElement>} autoInsertSpace={false} {...props} icon={leadingIcon ?? props.icon} danger={isError || undefined} type={antdType as "primary" | "default" | "text"} size={size === "medium" ? "middle" : size} block={fullWidth} className={classes} style={style} htmlType={typeof type === "string" ? type as "button" | "submit" | "reset" : undefined}>{children}{trailingIcon}</AntButton>;
});

export const ButtonBase = Button;

export const IconButton = forwardRef<HTMLElement, ButtonProps>(function IconButton({ sx, className, children, ...props }, ref) {
  return <Button ref={ref} variant="text" size="small" sx={{ minWidth: tokens.layout.touchTarget, minHeight: tokens.layout.touchTarget, borderRadius: tokens.radius.pill, p: 0.5, ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-icon-button", className)} {...props}>{children}</Button>;
});

export function Fab({ sx, className, children, ...props }: ButtonProps) {
  return <Button variant="contained" className={mergeClassNames("bk-fab", className)} sx={{ minWidth: tokens.layout.touchTarget, width: tokens.layout.touchTarget, height: tokens.layout.touchTarget, borderRadius: tokens.radius.pill, p: 0, ...flattenSx(sx, useTheme()) }} {...props}>{children}</Button>;
}

export function Card({ sx, className, children, ...props }: BoxProps & { elevation?: number }) {
  return <AntCard {...props} className={mergeClassNames("bk-card", sxClassName(sx, useTheme()), className)} styles={{ body: { padding: 0 } }}>{children}</AntCard>;
}

export const CardContent = forwardRef<HTMLDivElement, BoxProps>(function CardContent({ sx, className, ...props }, ref) {
  return <Box ref={ref} sx={{ p: 3, ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-card-content", className)} {...props} />;
});

export function CardActionArea({ component: Component, to, href, sx, className, children, ...props }: BoxProps & { to?: string; href?: string }) {
  const classes = mergeClassNames("bk-card-action-area", sxClassName(sx, useTheme()), className);
  if (Component) return createElement(Component, { ...props, to, href, className: classes }, children);
  return <button type="button" {...props} className={classes}>{children}</button>;
}

export function Alert({ severity = "info", action, icon, sx, className, children, ...props }: BoxProps & { severity?: "error" | "info" | "success" | "warning"; action?: ReactNode; icon?: ReactNode }) {
  return <AntAlert {...props} type={severity} showIcon={icon !== null} icon={icon} action={action} title={children} className={mergeClassNames("bk-alert", sxClassName(sx, useTheme()), className)} />;
}

export function CircularProgress({ size = 32, color, ...props }: { size?: number | string; color?: string; sx?: SxProps } & Record<string, unknown>) {
  return <span role="progressbar" aria-label="加载中" className="bk-circular-progress" {...props}><AntSpin size={typeof size === "number" && size < 28 ? "small" : "medium"} style={{ color: color ? cssVarPath(color) : undefined }} /></span>;
}

export function LinearProgress({ value = 0, variant = "determinate", sx, ...props }: { value?: number; variant?: "determinate" | "indeterminate"; sx?: SxProps } & Record<string, unknown>) {
  return <AntProgress percent={variant === "indeterminate" ? undefined : value} showInfo={false} size="small" className={sxClassName(sx, useTheme())} {...props} />;
}

export function Divider({ sx, className, children, flexItem: _flexItem, ...props }: BoxProps & { flexItem?: boolean }) {
  return <AntDivider {...props} className={mergeClassNames("bk-divider", sxClassName(sx, useTheme()), className)}>{children}</AntDivider>;
}

export function Avatar({ sx, className, children, ...props }: BoxProps & { sx?: SxProps }) {
  return <AntAvatar {...props} className={mergeClassNames("bk-avatar", sxClassName(sx, useTheme()), className)}>{children}</AntAvatar>;
}

export function Tooltip({ title, children, ...props }: { title?: ReactNode; children: ReactElement } & Record<string, unknown>) {
  return <AntTooltip title={title} {...props}>{children}</AntTooltip>;
}

export function AppBar({ component: Component = "header", sx, className, children, position: _position, elevation: _elevation, color: _color, ...props }: BoxProps & { position?: string; elevation?: number; color?: string }) {
  void _position;
  void _elevation;
  void _color;
  return createElement(Component, { ...props, className: mergeClassNames("bk-app-bar", sxClassName(sx, useTheme()), className) }, children);
}

export function Toolbar({ sx, className, children, ...props }: BoxProps) {
  return <Box {...props} sx={{ display: "flex", alignItems: "center", ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-toolbar", className)}>{children}</Box>;
}

export function InputAdornment({ children, ...props }: { children?: ReactNode; position?: "start" | "end" }) {
  const { position, ...rest } = props;
  void position;
  return <span className="bk-input-adornment" {...rest}>{children}</span>;
}

export function TextField({ label, helperText, error, multiline, minRows, maxRows, type, value, defaultValue, onChange, sx, className, slotProps, InputProps, placeholder, fullWidth, size: _size, variant: _variant, startAdornment: _startAdornment, ...props }: BoxProps & {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: boolean;
  multiline?: boolean;
  minRows?: number;
  maxRows?: number;
  sx?: SxProps;
  fullWidth?: boolean;
  slotProps?: { input?: Record<string, unknown>; htmlInput?: Record<string, unknown> };
  InputProps?: Record<string, unknown>;
  onChange?: (event: any) => void;
}) {
  const id = useId();
  const slotInput = (slotProps?.input ?? {}) as { startAdornment?: ReactNode; readOnly?: boolean } & Record<string, unknown>;
  const { startAdornment: slotStartAdornment, endAdornment: slotEndAdornment, ...slotInputProps } = slotInput;
  const inputProps = { ...(slotProps?.htmlInput ?? {}), ...slotInputProps };
  const prefix = slotStartAdornment ?? (InputProps as { startAdornment?: ReactNode } | undefined)?.startAdornment;
  const suffix = slotEndAdornment ?? (InputProps as { endAdornment?: ReactNode } | undefined)?.endAdornment;
  const common = {
    ...props,
    id,
    value,
    defaultValue,
    onChange,
    type,
    placeholder,
    required: props.required,
    autoFocus: props.autoFocus,
    autoComplete: props.autoComplete,
    disabled: props.disabled,
    readOnly: Boolean(slotInput.readOnly),
    "aria-label": props["aria-label"] ?? (typeof label === "string" ? label : undefined),
    ...inputProps,
    prefix,
    suffix,
    className: "bk-field-control",
  };
  const control = multiline
    ? <AntInput.TextArea {...(common as any)} autoSize={{ minRows, maxRows }} />
    : type === "password"
      ? <AntInput.Password {...(common as any)} visibilityToggle={suffix ? false : undefined} />
      : <AntInput {...(common as any)} />;
  const fieldClassName = mergeClassNames("bk-field", fullWidth && "bk-field-full", error && "bk-field-error", sxClassName(sx, useTheme()), className);
  return <div className={fieldClassName}>{label && <label htmlFor={id} className="bk-field-label">{label}{props.required ? " *" : ""}</label>}{control}{helperText && <span className="bk-field-helper">{helperText}</span>}</div>;
}

export function FormControl({ sx, className, children, ...props }: BoxProps & { fullWidth?: boolean; size?: string }) {
  const { fullWidth, size, ...rest } = props as BoxProps & { fullWidth?: boolean; size?: string };
  void size;
  return <Box {...rest} sx={{ display: "flex", flexDirection: "column", minWidth: 0, width: fullWidth ? "100%" : undefined, ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-form-control", className)}>{children}</Box>;
}

export function InputLabel({ children, id, ...props }: BoxProps & { id?: string }) {
  return <label id={id} className="bk-input-label" {...props}>{children}</label>;
}

interface MenuItemProps extends BoxProps { value?: string; selected?: boolean; dense?: boolean; sx?: SxProps }
export function MenuItem({ value, selected, dense: _dense, sx, className, children, ...props }: MenuItemProps) {
  return <button type="button" role="menuitem" aria-selected={selected || undefined} data-value={value} {...props} className={mergeClassNames("bk-menu-item", selected && "bk-menu-item-selected", sxClassName(sx, useTheme()), className)}>{children}</button>;
}

export function Select({ value, defaultValue, onChange, label, children, sx, className, startAdornment, labelId: _labelId, ...props }: BoxProps & { label?: ReactNode; startAdornment?: ReactNode; onChange?: (event: any) => void; labelId?: string }) {
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const item = child.props as { value?: string; children?: ReactNode; disabled?: boolean };
    return item.value === undefined ? [] : [{ value: item.value, label: item.children, disabled: item.disabled }];
  });
  return <AntSelect {...(props as any)} value={value} defaultValue={defaultValue} aria-label={typeof label === "string" ? label : undefined} options={options} prefix={startAdornment} className={mergeClassNames("bk-select", sxClassName(sx, useTheme()), className)} onChange={(nextValue) => onChange?.({ target: { value: nextValue } } as any)} />;
}

export function Checkbox({ checked, defaultChecked, onChange, sx, className, slotProps, ...props }: BoxProps & { slotProps?: { input?: Record<string, unknown> }; onChange?: (event: any) => void }) {
  return <AntCheckbox {...props} checked={checked} defaultChecked={defaultChecked} onChange={onChange} {...(slotProps?.input ?? {})} className={mergeClassNames("bk-checkbox", sxClassName(sx, useTheme()), className)} />;
}

export function Radio({ checked, value, sx, className, slotProps, ...props }: BoxProps & { slotProps?: { input?: Record<string, unknown> }; onChange?: (event: any) => void }) {
  return <AntRadio {...props} value={value} checked={checked} {...(slotProps?.input ?? {})} className={mergeClassNames("bk-radio", sxClassName(sx, useTheme()), className)} />;
}

export function FormControlLabel({ control, label, sx, className, ...props }: { control: ReactElement; label: ReactNode; sx?: SxProps; className?: string } & Record<string, unknown>) {
  const labelId = useId();
  const labelledControl = cloneElement(control as ReactElement<Record<string, unknown>>, { "aria-labelledby": labelId });
  return <span {...props} className={mergeClassNames("bk-form-control-label", sxClassName(sx, useTheme()), className)}>{labelledControl}<span id={labelId}>{label}</span></span>;
}

export function Switch({ checked, defaultChecked, onChange, sx, className, slotProps, ...props }: BoxProps & { slotProps?: { input?: Record<string, unknown> }; onChange?: (event: any, checked: boolean) => void }) {
  return <AntSwitch {...(props as any)} checked={checked} defaultChecked={defaultChecked} onChange={(next: boolean, event: any) => onChange?.({ ...(event ?? {}), target: { ...(event?.target ?? {}), checked: next } }, next)} {...(slotProps?.input ?? {})} className={mergeClassNames("bk-switch", sxClassName(sx, useTheme()), className)} />;
}

export function Slider({ value, defaultValue, onChange, sx, className, ...props }: BoxProps & { value?: number | number[]; defaultValue?: number | number[]; onChange?: (event: any, value: number | number[]) => void }) {
  return <AntSlider {...(props as any)} value={value as any} defaultValue={defaultValue as any} onChange={(nextValue) => onChange?.(undefined, nextValue as number | number[])} className={mergeClassNames("bk-slider", sxClassName(sx, useTheme()), className)} />;
}

export function List({ sx, className, children, ...props }: BoxProps) {
  return <div {...props} className={mergeClassNames("bk-list", sxClassName(sx, useTheme()), className)}>{children}</div>;
}

export function ListItem({ secondaryAction, divider, sx, className, children, ...props }: BoxProps & { secondaryAction?: ReactNode; divider?: boolean }) {
  return <div {...props} className={mergeClassNames("bk-list-item", divider && "bk-list-item-divider", sxClassName(sx, useTheme()), className)}><div className="bk-list-item-content">{children}</div>{secondaryAction && <div className="bk-list-item-secondary">{secondaryAction}</div>}</div>;
}

export function ListItemButton({ selected, divider, sx, className, children, ...props }: BoxProps & { selected?: boolean; dense?: boolean; divider?: boolean }) {
  return <button type="button" {...props} aria-pressed={selected || undefined} className={mergeClassNames("bk-list-item-button", selected && "bk-list-item-button-selected", divider && "bk-list-item-divider", sxClassName(sx, useTheme()), className)}>{children}</button>;
}

export function ListItemIcon({ sx, className, children, ...props }: BoxProps) {
  return <Box {...props} sx={{ display: "inline-flex", alignItems: "center", minWidth: 40, ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-list-item-icon", className)}>{children}</Box>;
}

export function ListItemText({ primary, secondary, sx, className, ...props }: { primary?: ReactNode; secondary?: ReactNode; sx?: SxProps; className?: string } & Record<string, unknown>) {
  return <span {...props} className={mergeClassNames("bk-list-item-text", sxClassName(sx, useTheme()), className)}><span className="bk-list-item-primary">{primary}</span>{secondary && <span className="bk-list-item-secondary-text">{secondary}</span>}</span>;
}

interface OverlayProps extends Record<string, any> { open?: boolean; onClose?: () => void; anchorEl?: HTMLElement | null; anchorPosition?: { top: number; left: number }; children?: ReactNode; sx?: SxProps; role?: string; className?: string }
function Overlay({ open, onClose, anchorEl, anchorPosition, children, sx, role = "menu", className, anchorReference: _anchorReference, marginThreshold: _marginThreshold, anchorOrigin, transformOrigin, ...props }: OverlayProps) {
  const theme = useTheme();
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !overlayRef.current?.contains(event.target) && !anchorEl?.contains(event.target)) onClose?.();
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
      anchorEl?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open, onClose, anchorEl]);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!open || !overlayRef.current) return;
    const overlay = overlayRef.current;
    const update = () => {
      const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--spacing-2")) || 8;
      const view = window.visualViewport;
      const width = view?.width ?? window.innerWidth;
      const height = view?.height ?? window.innerHeight;
      const ox = view?.offsetLeft ?? 0;
      const oy = view?.offsetTop ?? 0;
      overlay.style.maxHeight = `${Math.max(0, height - gap * 2)}px`;
      overlay.style.maxWidth = `${Math.max(0, width - gap * 2)}px`;
      const rect = anchorEl?.getBoundingClientRect();
      const box = overlay.getBoundingClientRect();
      const offset = (value: string | number | undefined, size: number) => typeof value === "number" ? value : value === "center" ? size / 2 : value === "bottom" || value === "right" ? size : 0;
      const ax = anchorPosition?.left ?? (rect ? rect.left + offset(anchorOrigin?.horizontal ?? "right", rect.width) : ox + gap);
      const ay = anchorPosition?.top ?? (rect ? rect.top + offset(anchorOrigin?.vertical ?? "bottom", rect.height) + gap : oy + gap);
      let left = ax - offset(transformOrigin?.horizontal ?? "right", box.width);
      let top = ay - offset(transformOrigin?.vertical ?? "top", box.height);
      if (rect && top + box.height > oy + height - gap && rect.top - gap - box.height >= oy + gap) top = rect.top - gap - box.height;
      left = Math.max(ox + gap, Math.min(left, ox + width - box.width - gap));
      top = Math.max(oy + gap, Math.min(top, oy + height - box.height - gap));
      setPosition(old => old.top === top && old.left === left ? old : { top, left });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(overlay);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); window.visualViewport?.removeEventListener("resize", update); window.visualViewport?.removeEventListener("scroll", update); };
  }, [open, anchorEl, anchorPosition?.top, anchorPosition?.left, anchorOrigin?.horizontal, anchorOrigin?.vertical, transformOrigin?.horizontal, transformOrigin?.vertical]);
  if (!open || typeof document === "undefined") return null;
  const style: CSSProperties = { position: "fixed", zIndex: 1400, minWidth: "min(220px, calc(100vw - var(--spacing-2) * 2))", maxWidth: "min(94vw, 420px)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-popover)", padding: "var(--spacing-2)", ...flattenSx(sx, theme), ...position };
  return createPortal(<div {...props} ref={overlayRef} role={role} className={mergeClassNames("bk-overlay", className)} style={style}>{children}</div>, document.body);
}

export function Menu({ open, onClose, anchorEl, children, slotProps, ...props }: OverlayProps & { slotProps?: { paper?: { sx?: SxProps } } }) {
  return <Overlay open={open} onClose={onClose} anchorEl={anchorEl} sx={slotProps?.paper?.sx} {...props}>{children}</Overlay>;
}

export function Popover({ open, onClose, anchorEl, children, slotProps, ...props }: OverlayProps & { slotProps?: { paper?: { sx?: SxProps } } }) {
  return <Overlay open={open} onClose={onClose} anchorEl={anchorEl} role="dialog" sx={slotProps?.paper?.sx} {...props}>{children}</Overlay>;
}

export function Drawer({ open, onClose, anchor = "left", children, slotProps, ...props }: OverlayProps & { anchor?: "left" | "right" | "top" | "bottom"; slotProps?: { paper?: { sx?: SxProps } } }) {
  const paperStyle = flattenSx(slotProps?.paper?.sx, useTheme());
  return <AntDrawer open={open} onClose={onClose} placement={anchor} styles={{ body: { padding: 0 }, section: { background: "var(--color-surface)", ...paperStyle as CSSProperties } } as any} {...props}>{children}</AntDrawer>;
}

const DialogContext = createContext<{ titleId: string }>({ titleId: "" });
export function Dialog({ open, onClose, children, fullWidth, maxWidth = "sm", fullScreen, slotProps, sx, ...props }: { open?: boolean; onClose?: () => void; children?: ReactNode; fullWidth?: boolean; maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false; fullScreen?: boolean; slotProps?: { paper?: { sx?: SxProps } }; sx?: SxProps } & Record<string, unknown>) {
  const titleId = useId();
  const width = fullScreen ? "100vw" : maxWidth === "xs" ? 360 : maxWidth === "sm" ? 560 : maxWidth === "md" ? 760 : maxWidth === "lg" ? 1040 : 1280;
  return <DialogContext.Provider value={{ titleId }}><AntModal {...(props as any)} open={open} onCancel={onClose} destroyOnHidden role="presentation" footer={null} className="bk-dialog" width={fullWidth ? width : undefined} centered={!fullScreen} transitionName="" maskTransitionName="" modalRender={(node) => <div role="dialog" aria-modal="true" aria-labelledby={titleId}>{node}</div>} styles={{ container: { background: "var(--color-surface)", borderRadius: "var(--radius-xl)", padding: 0, ...flattenSx(sx, useTheme()), ...flattenSx(slotProps?.paper?.sx, useTheme()) as CSSProperties }, body: { maxHeight: fullScreen ? "calc(100vh - 80px)" : undefined, overflow: "auto" } } as any}>{children}</AntModal></DialogContext.Provider>;
}

export function DialogTitle({ sx, className, children, ...props }: BoxProps) {
  const { titleId } = useContext(DialogContext);
  return <Typography component="h2" id={titleId} variant="h5" sx={{ p: 3, pb: 1.5, ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-dialog-title", className)} {...props}>{children}</Typography>;
}

export function DialogContent({ sx, className, children, dividers, ...props }: BoxProps & { dividers?: boolean }) {
  return <Box {...props} sx={{ p: 3, ...(dividers ? { borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" } : {}), ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-dialog-content", className)}>{children}</Box>;
}

export function DialogActions({ sx, className, children, ...props }: BoxProps) {
  return <Stack {...props} direction="row" sx={{ p: 3, justifyContent: "flex-end", alignItems: "center", gap: 1, ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-dialog-actions", className)}>{children}</Stack>;
}

export function Snackbar({ open, message, onClose, autoHideDuration = 4000, children }: { open?: boolean; message?: ReactNode; onClose?: () => void; autoHideDuration?: number; children?: ReactNode }) {
  useEffect(() => {
    if (!open || !onClose) return undefined;
    const timer = window.setTimeout(onClose, autoHideDuration);
    return () => window.clearTimeout(timer);
  }, [autoHideDuration, onClose, open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div role="status" className="bk-snackbar">{message ?? children}</div>, document.body);
}

export function Breadcrumbs({ children, separator = "/", sx, className, ...props }: BoxProps & { separator?: ReactNode }) {
  const items = Children.toArray(children);
  return <nav aria-label="面包屑" {...props} className={mergeClassNames("bk-breadcrumbs", sxClassName(sx, useTheme()), className)}>{items.map((item, index) => <Fragment key={index}>{index > 0 && <span className="bk-breadcrumb-separator">{separator}</span>}{item}</Fragment>)}</nav>;
}

export function Link({ component: Component = "a", sx, className, children, ...props }: BoxProps & { underline?: string; color?: string }) {
  return createElement(Component, { ...props, className: mergeClassNames("bk-link", sxClassName(sx, useTheme()), className) }, children);
}

export function TableContainer({ sx, className, children, ...props }: BoxProps) {
  return <div {...props} className={mergeClassNames("bk-table-container", sxClassName(sx, useTheme()), className)}>{children}</div>;
}
export function Table({ sx, className, children, ...props }: HTMLAttributes<HTMLTableElement> & { sx?: SxProps }) { return <table {...props} className={mergeClassNames("bk-table", sxClassName(sx, useTheme()), className)}>{children}</table>; }
const TableSectionContext = createContext<"head" | "body">("body");
export function TableHead({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <TableSectionContext.Provider value="head"><thead {...props}>{children}</thead></TableSectionContext.Provider>; }
export function TableBody({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <TableSectionContext.Provider value="body"><tbody {...props}>{children}</tbody></TableSectionContext.Provider>; }
export function TableRow({ sx, className, children, hover: _hover, ...props }: HTMLAttributes<HTMLTableRowElement> & { sx?: SxProps; hover?: boolean }) { return <tr {...props} className={mergeClassNames(sxClassName(sx, useTheme()), className)}>{children}</tr>; }
export function TableCell({ sx, className, children, align, component, ...props }: BoxProps & { sx?: SxProps; align?: "left" | "center" | "right"; component?: ElementType }) {
  const section = useContext(TableSectionContext);
  const Cell = component ?? (section === "head" ? "th" : "td");
  return createElement(Cell, { ...props, align, className: mergeClassNames(sxClassName(sx, useTheme()), className) }, children);
}

export function Chip({ label, icon, color, variant = "filled", sx, className, children, clickable, onClick, ...props }: { label?: ReactNode; icon?: ReactNode; color?: string; variant?: "filled" | "outlined"; sx?: SxProps; className?: string; children?: ReactNode; clickable?: boolean; onClick?: (event: any) => void } & Record<string, unknown>) {
  const chipColorClass = color && color !== "default" ? `bk-chip-color-${color.replace(".", "-")}` : undefined;
  const content = <>{icon}{label ?? children}</>;
  if (clickable) return <button type="button" {...props} onClick={onClick} className={mergeClassNames("bk-chip", "bk-chip-clickable", chipColorClass, sxClassName(sx, useTheme()), className)}>{content}</button>;
  return <AntTag {...props} variant={variant === "outlined" ? "outlined" : "filled"} className={mergeClassNames("bk-chip", chipColorClass, sxClassName(sx, useTheme()), className)}>{content}</AntTag>;
}

export function Paper({ sx, className, children, elevation: _elevation, variant = "elevation", ...props }: BoxProps & { elevation?: number; variant?: "elevation" | "outlined" }) {
  const theme = useTheme();
  return <Box {...props} sx={{ backgroundColor: "background.paper", ...(variant === "outlined" ? { border: 1, borderColor: "divider" } : {}), ...flattenSx(sx, theme) }} className={mergeClassNames("bk-paper", className)}>{children}</Box>;
}

export { AntList as _AntList, AntTable as _AntTable };

export function CssBaseline() {
  useEffect(() => {
    document.documentElement.style.backgroundColor = "var(--color-canvas)";
    document.body.style.margin = "0";
    document.body.style.backgroundColor = "var(--color-canvas)";
    document.body.style.color = "var(--color-text-primary)";
  }, []);
  return null;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);
  return matches;
}

export function alpha(color: string, opacity: number) {
  const normalized = cssVarPath(color);
  const match = normalized.match(/^#([0-9a-f]{6})$/i);
  if (match) {
    const hex = match[1];
    return `rgba(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)}, ${opacity})`;
  }
  return `color-mix(in srgb, ${normalized} ${Math.round(opacity * 100)}%, transparent)`;
}

export function keyframes(frames: Record<string, CSSProperties>) {
  const name = `bk-keyframes-${keyframeCounter += 1}`;
  if (typeof document !== "undefined") {
    const tag = document.createElement("style");
    tag.dataset.bookkinKeyframes = name;
    tag.textContent = `@keyframes ${name}{${Object.entries(frames).map(([key, value]) => `${key}{${Object.entries(value).map(([property, propertyValue]) => `${kebabCase(property)}:${propertyValue};`).join("")}}`).join("")}}`;
    document.head.appendChild(tag);
  }
  return name;
}

export {
  AntInput as _AntInput,
  AntRadio as _AntRadio,
  AntSwitch as _AntSwitch,
  AntSlider as _AntSlider,
  AntProgress as _AntProgress,
  AntAvatar as _AntAvatar,
  AntCard as _AntCard,
  AntModal as _AntModal,
  AntDrawer as _AntDrawer,
};

// Native data tables keep column alignment and spacing within Ant Design.
export { AntTable as DataTable };
export function TableAction(props: React.ComponentProps<typeof AntButton>) {
  return <AntButton {...props} type="link" size="small" style={{ padding: 0, height: "auto" }} />;
}

export { default as Form } from "antd/es/form";
export { default as Input } from "antd/es/input";
