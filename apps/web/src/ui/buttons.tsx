import { RefreshRounded } from "./icons";
import AntButton from "antd/es/button";
import type { ElementType, ForwardedRef, ReactNode } from "react";
import { createElement, forwardRef } from "react";
import { tokens } from "../theme/generated-tokens";
import { flattenSx, mergeClassNames, sxClassName, useTheme, type SxProps } from "./primitives";

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

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button({ variant = "outlined", color, size = "medium", fullWidth, startIcon, endIcon, component: Component, to, href, sx, className, children, type, ...props }, ref) {
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

// Inline reader markers and unstyled interaction surfaces opt out of action chrome.
export const ButtonBase = forwardRef<HTMLElement, ButtonProps>(function ButtonBase(props, ref) {
  return <Button ref={ref} variant="text" {...props} />;
});

export const IconButton = forwardRef<HTMLElement, ButtonProps>(function IconButton({ sx, className, children, ...props }, ref) {
  return <Button ref={ref} variant="text" size="small" sx={{ minWidth: tokens.layout.iconButtonSize, width: tokens.layout.iconButtonSize, minHeight: tokens.layout.iconButtonSize, height: tokens.layout.iconButtonSize, borderRadius: `${tokens.radius.md}px`, p: 0, ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-icon-button", className)} {...props}>{children}</Button>;
});

export function Fab({ sx, className, children, ...props }: ButtonProps) {
  return <Button variant="contained" className={mergeClassNames("bk-fab", className)} sx={{ minWidth: tokens.layout.touchTarget, width: tokens.layout.touchTarget, height: tokens.layout.touchTarget, borderRadius: `${tokens.radius.md}px`, p: 0, ...flattenSx(sx, useTheme()) }} {...props}>{children}</Button>;
}

/** Shared secondary action for reloading data across pages. */
export function RefreshButton({ children = "刷新", ...props }: ButtonProps) {
  return <Button {...props} variant="outlined" size="medium" startIcon={<RefreshRounded />}>{children}</Button>;
}

/** Shared primary action for persisting a settings form. */
export function SaveButton(props: ButtonProps) {
  return <Button {...props} variant="contained" size="medium" />;
}
