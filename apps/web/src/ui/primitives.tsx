import { FeedbackBubble } from "./notifications";
import type { CSSProperties, ElementType, HTMLAttributes, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Children,
  Fragment,
  cloneElement,
  createContext,
  createElement,
  forwardRef,
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

const breakpointValues: Record<string, number> = {
  xs: 0,
  sm: tokens.layout.breakpointMobile,
  md: tokens.layout.breakpointTablet,
  lg: tokens.layout.breakpointDesktop,
  xl: 1920,
};

const defaultTheme: UiTheme = {
  palette: {
    mode: "light",
    primary: { main: tokens.color.semantic.primary, light: tokens.color.semantic.primarySoft, dark: tokens.color.semantic.primaryHover },
    secondary: { main: tokens.color.semantic.accentTeal },
    success: { main: tokens.color.semantic.success },
    warning: { main: tokens.color.semantic.warning },
    error: { main: tokens.color.semantic.error },
    background: { default: tokens.color.semantic.canvas, paper: tokens.color.semantic.surface },
    text: {
      primary: tokens.color.semantic.textPrimary,
      secondary: tokens.color.semantic.textSecondary,
      disabled: tokens.color.semantic.textMutedSoft,
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
  breakpoints: { down: (key) => `@media (max-width: ${(breakpointValues[key] ?? tokens.layout.breakpointMobile) - 0.05}px)`, up: (key) => `@media (min-width: ${breakpointValues[key] ?? 0}px)` },
  zIndex: { fab: 1100 },
};

const UiThemeContext = createContext<UiTheme>(defaultTheme);
export function useTheme() {
  return useContext(UiThemeContext);
}

export function UiThemeProvider({ theme, children }: { theme: UiTheme; children: ReactNode }) {
  return <UiThemeContext.Provider value={theme}>{children}</UiThemeContext.Provider>;
}


const styleCache = new Set<string>();
let keyframeCounter = 0;

export function cssVarPath(value: string) {
  const colors: Record<string, string> = {
    "text.primary": "var(--color-text-primary)",
    "text.secondary": "var(--color-text-secondary)",
    "text.disabled": "var(--color-text-muted)",
    "primary.main": "var(--color-primary)",
    primary: "var(--color-primary)",
    "primary.light": "var(--color-primary-soft)",
    "primary.dark": "var(--color-primary-hover)",
    "secondary.main": "var(--color-accent-teal)",
    // MUI derived `secondary.dark` was used by the original theme for the
    // reading-progress card and the authentication artwork layer.  Keep the
    // semantic mapping here so those surfaces do not silently fall back to an
    // invalid CSS value after the Ant Design migration.
    "secondary.light": "color-mix(in srgb, var(--color-accent-teal) 78%, var(--color-primitive-white))",
    "secondary.dark": "color-mix(in srgb, var(--color-accent-teal) 78%, var(--color-primitive-black))",
    "text.strong": "var(--color-body-strong)",
    "text.muted": "var(--color-text-muted)",
    "text.mutedSoft": "var(--color-text-muted-soft)",
    "text.onDark": "var(--color-text-on-dark)",
    "text.onDarkSoft": "var(--color-text-on-dark-soft)",
    "text.onPrimary": "var(--color-text-on-primary)",
    "accent.teal": "var(--color-accent-teal)",
    "accent.amber": "var(--color-accent-amber)",
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

export function flattenSx(sx: SxProps | undefined, theme: UiTheme): SxObject {
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

export function sxClassName(sx: SxProps | undefined, theme: UiTheme) {
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

export function mergeClassNames(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ") || undefined;
}

export type BoxProps = Record<string, any> & {
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
  h1: { fontFamily: "var(--typography-font-family-display)", fontSize: "var(--typography-font-size-display-lg)", fontWeight: 400, lineHeight: "var(--typography-line-height-tight)", letterSpacing: "var(--typography-letter-spacing-display-xl)" },
  h2: { fontFamily: "var(--typography-font-family-display)", fontSize: "var(--typography-font-size-display)", fontWeight: 400, lineHeight: "var(--typography-line-height-display-lg)", letterSpacing: "var(--typography-letter-spacing-display-lg)" },
  h3: { fontFamily: "var(--typography-font-family-display)", fontSize: "var(--typography-font-size-heading)", fontWeight: 400, lineHeight: "var(--typography-line-height-display-md)", letterSpacing: "var(--typography-letter-spacing-display-md)" },
  h4: { fontFamily: "var(--typography-font-family-display)", fontSize: "var(--typography-font-size-heading-sm)", fontWeight: 400, lineHeight: "var(--typography-line-height-display-sm)", letterSpacing: "var(--typography-letter-spacing-display-sm)" },
  h5: { fontFamily: "var(--typography-font-family-body)", fontSize: "var(--typography-font-size-title)", fontWeight: 500, lineHeight: "var(--typography-line-height-title-lg)" },
  h6: { fontFamily: "var(--typography-font-family-body)", fontSize: "var(--typography-font-size-label)", fontWeight: 500, lineHeight: "var(--typography-line-height-title-sm)" },
  subtitle1: { fontFamily: "var(--typography-font-family-body)", fontSize: "var(--typography-font-size-title-sm)", fontWeight: 500, lineHeight: "var(--typography-line-height-title-md)" },
  subtitle2: { fontFamily: "var(--typography-font-family-body)", fontSize: "var(--typography-font-size-label)", fontWeight: 500, lineHeight: "var(--typography-line-height-title-sm)" },
  body1: { fontFamily: "var(--typography-font-family-body)", fontSize: "var(--typography-font-size-body)", fontWeight: 400, lineHeight: "var(--typography-line-height-body)" },
  body2: { fontFamily: "var(--typography-font-family-body)", fontSize: "var(--typography-font-size-body-sm)", fontWeight: 400, lineHeight: "var(--typography-line-height-body)" },
  caption: { fontFamily: "var(--typography-font-family-body)", fontSize: "var(--typography-font-size-caption)", fontWeight: 500, lineHeight: "var(--typography-line-height-caption)" },
  overline: { fontFamily: "var(--typography-font-family-body)", fontSize: "var(--typography-font-size-caption-uppercase)", fontWeight: 500, lineHeight: "var(--typography-line-height-caption)", letterSpacing: "1.5px", textTransform: "uppercase" },
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

export const CardContent = forwardRef<HTMLDivElement, BoxProps>(function CardContent({ sx, className, ...props }, ref) {
  return <Box ref={ref} sx={{ p: 4, ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-card-content", className)} {...props} />;
});

export function CardActionArea({ component: Component, to, href, sx, className, children, ...props }: BoxProps & { to?: string; href?: string }) {
  const classes = mergeClassNames("bk-card-action-area", sxClassName(sx, useTheme()), className);
  if (Component) return createElement(Component, { ...props, to, href, className: classes }, children);
  return <button type="button" {...props} className={classes}>{children}</button>;
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


export function FormControlLabel({ control, label, sx, className, ...props }: { control: ReactElement; label: ReactNode; sx?: SxProps; className?: string } & Record<string, unknown>) {
  const labelId = useId();
  const labelledControl = cloneElement(control as ReactElement<Record<string, unknown>>, { "aria-labelledby": labelId });
  return <span {...props} className={mergeClassNames("bk-form-control-label", sxClassName(sx, useTheme()), className)}>{labelledControl}<span id={labelId}>{label}</span></span>;
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


export function Snackbar({ open, message, onClose, autoHideDuration = 4000, children }: { open?: boolean; message?: ReactNode; onClose?: () => void; autoHideDuration?: number; children?: ReactNode }) {
  if (!open) return null;
  // Alert children already render a notification through the shared provider.
  return message !== undefined
    ? <FeedbackBubble duration={autoHideDuration / 1000} onClose={onClose}>{message}</FeedbackBubble>
    : children;

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


export function Paper({ sx, className, children, elevation: _elevation, variant = "elevation", ...props }: BoxProps & { elevation?: number; variant?: "elevation" | "outlined" }) {
  const theme = useTheme();
  return <Box {...props} sx={{ backgroundColor: "background.paper", ...(variant === "outlined" ? { border: 1, borderColor: "divider" } : {}), ...flattenSx(sx, theme) }} className={mergeClassNames("bk-paper", className)}>{children}</Box>;
}

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
