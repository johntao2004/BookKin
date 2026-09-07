import { FeedbackBubble } from "./notifications";
import AntAvatar from "antd/es/avatar";
import AntDivider from "antd/es/divider";
import AntProgress from "antd/es/progress";
import AntSpin from "antd/es/spin";
import AntTag from "antd/es/tag";
import AntTooltip from "antd/es/tooltip";
import type { ReactElement, ReactNode } from "react";
import { cssVarPath, mergeClassNames, sxClassName, useTheme, type BoxProps, type SxProps } from "./primitives";

export function Alert({ severity = "info", action, children, onClose }: BoxProps & { severity?: "error" | "info" | "success" | "warning"; action?: ReactNode; icon?: ReactNode }) {
  return <FeedbackBubble severity={severity} action={action} duration={severity === "success" ? 4 : 0} onClose={onClose as (() => void) | undefined}>{children}</FeedbackBubble>;
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

export function Chip({ label, icon, color, variant = "filled", sx, className, children, clickable, onClick, ...props }: { label?: ReactNode; icon?: ReactNode; color?: string; variant?: "filled" | "outlined"; sx?: SxProps; className?: string; children?: ReactNode; clickable?: boolean; onClick?: (event: any) => void } & Record<string, unknown>) {
  const chipColorClass = color && color !== "default" ? `bk-chip-color-${color.replace(".", "-")}` : undefined;
  const content = <>{icon}{label ?? children}</>;
  if (clickable) return <button type="button" {...props} onClick={onClick} className={mergeClassNames("bk-chip", "bk-chip-clickable", chipColorClass, sxClassName(sx, useTheme()), className)}>{content}</button>;
  return <AntTag {...props} variant={variant === "outlined" ? "outlined" : "filled"} className={mergeClassNames("bk-chip", chipColorClass, sxClassName(sx, useTheme()), className)}>{content}</AntTag>;
}
