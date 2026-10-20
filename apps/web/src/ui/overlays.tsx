// 统一抽屉与对话框结构及视口边界，关闭回调不等同于业务提交。
// Unifies drawer/dialog structure and viewport bounds; closing is not a business commit.
import AntDrawer from "antd/es/drawer";
import AntModal from "antd/es/modal";
import type { CSSProperties, ReactNode } from "react";
import { createContext, useContext, useId } from "react";
import { Box, flattenSx, mergeClassNames, Stack, Typography, useTheme, sxClassName, type BoxProps, type SxProps } from "./primitives";

type OverlayProps = Record<string, any> & { open?: boolean; onClose?: () => void; children?: ReactNode; sx?: SxProps; };

export function Drawer({ open, onClose, anchor = "left", children, slotProps, title, closeLabel, closable, className, ...props }: OverlayProps & { anchor?: "left" | "right" | "top" | "bottom"; slotProps?: { paper?: { sx?: SxProps } } }) {
  const theme = useTheme();
  const { width, height, ...paperStyle } = flattenSx(slotProps?.paper?.sx, theme);
  const dimension = anchor === "left" || anchor === "right" ? width : height;
  const length = (value: unknown) => typeof value === "number" ? `${value}px` : value;
  const responsiveSize = dimension && typeof dimension === "object"
    ? Object.fromEntries(Object.entries(dimension).map(([key, value]) => [key, length(value)]))
    : length(dimension);
  return <AntDrawer {...props} open={open} onClose={onClose} placement={anchor}
    title={typeof title === "string" ? <span role="heading" aria-level={2}>{title}</span> : title}
    closable={closable ?? (title ? { placement: "end", disabled: !onClose, ...(closeLabel ? { "aria-label": closeLabel } : {}) } : false)}
    className={mergeClassNames("bk-drawer", className)}
    size={dimension === undefined ? props.size : "var(--bk-drawer-size)"}
    classNames={{
      wrapper: sxClassName({ "--bk-drawer-size": responsiveSize, maxWidth: "var(--app-viewport-width, 100vw)", maxHeight: "var(--app-viewport-height, 100dvh)" }, theme),
      section: sxClassName({ bgcolor: "var(--color-surface)", ...paperStyle }, theme),
    }} styles={{ body: { padding: 0 } }}>{children}</AntDrawer>;
}

const DialogContext = createContext<{ titleId: string }>({ titleId: "" });
export function Dialog({ open, onClose, children, fullWidth, maxWidth = "sm", fullScreen, slotProps, sx, ...props }: { open?: boolean; onClose?: () => void; children?: ReactNode; fullWidth?: boolean; maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false; fullScreen?: boolean; slotProps?: { paper?: { sx?: SxProps } }; sx?: SxProps } & Record<string, unknown>) {
  const titleId = useId();
  const theme = useTheme();
  const width = fullScreen ? "100vw" : maxWidth === "xs" ? 360 : maxWidth === "sm" ? 560 : maxWidth === "md" ? 760 : maxWidth === "lg" ? 1040 : 1280;
  return <DialogContext.Provider value={{ titleId }}><AntModal {...(props as any)} open={open} onCancel={onClose} destroyOnHidden role="presentation" footer={null} className="bk-dialog" width={fullWidth ? width : undefined} centered={!fullScreen} transitionName="" maskTransitionName="" modalRender={(node) => <div role="dialog" aria-modal="true" aria-labelledby={titleId}>{node}</div>} classNames={{ container: sxClassName({ bgcolor: "var(--color-surface)", ...flattenSx(sx, theme), ...flattenSx(slotProps?.paper?.sx, theme) }, theme) }} styles={{ container: { padding: 0, borderRadius: "var(--radius-xl)" }, body: { overflow: "auto", padding: 0 } } as Record<string, CSSProperties>}>{children}</AntModal></DialogContext.Provider>;
}

export function DialogTitle({ sx, className, children, ...props }: BoxProps) {
  const { titleId } = useContext(DialogContext);
  return <Typography component="h2" id={titleId} variant="h5" sx={{ p: 3, pb: 1.5, ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-dialog-title", className)} {...props}>{children}</Typography>;
}

export function DialogContent({ sx, className, children, dividers, ...props }: BoxProps & { dividers?: boolean }) {
  return <Box {...props} sx={{ p: 3, ...(dividers ? { borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" } : {}), ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-dialog-content", className)}>{children}</Box>;
}

export function DialogActions({ sx, className, children, ...props }: BoxProps) {
  return <Stack {...props} direction="row" sx={{ p: 3, minWidth: 0, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 1, ...flattenSx(sx, useTheme()) }} className={mergeClassNames("bk-dialog-actions", className)}>{children}</Stack>;
}
