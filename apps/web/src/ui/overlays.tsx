import AntDrawer from "antd/es/drawer";
import AntModal from "antd/es/modal";
import type { CSSProperties, ReactNode } from "react";
import { createContext, useContext, useId } from "react";
import { Box, flattenSx, mergeClassNames, Stack, Typography, useTheme, type BoxProps, type SxProps } from "./primitives";

type OverlayProps = Record<string, any> & { open?: boolean; onClose?: () => void; children?: ReactNode; sx?: SxProps; };

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
