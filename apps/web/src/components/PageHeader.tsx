import { Box } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import type { SxProps, Theme } from "@/ui/primitives";
import { createContext, useContext, type ReactNode } from "react";

export const EmbeddedSettingsContext = createContext(false);
import { tokens } from "../theme/generated-tokens";

export const pageWidthSx = {
  width: "100%",
  maxWidth: tokens.layout.contentMax,
  mx: "auto",
  px: { xs: 2, sm: 3, lg: 0 },
};

export function PageContainer({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  const embedded = useContext(EmbeddedSettingsContext);
  if (embedded) return <Box sx={sx}>{children}</Box>;
  return (
    <Box
      sx={{
        ...pageWidthSx,
        pt: { xs: 4, sm: 6, md: 8 },
        pb: { xs: 6, md: 8 },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const embedded = useContext(EmbeddedSettingsContext);
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      sx={{
        alignItems: { xs: "stretch", sm: "flex-end" },
        justifyContent: "space-between",
        gap: embedded ? 2 : 3,
        mb: action || embedded ? 3 : 4,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && !embedded && <Typography variant="overline" color="text.secondary" sx={{ fontWeight: tokens.typography.fontWeight.medium }}>{eyebrow}</Typography>}
        <Typography variant={embedded ? "h5" : "h1"} component={embedded ? "h2" : "h1"} sx={embedded ? undefined : { fontSize: { xs: 32, sm: tokens.typography.fontSize.displayLg } }}>{title}</Typography>
        {description && <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 720 }}>{description}</Typography>}
      </Box>
      {action && <ActionToolbar>{action}</ActionToolbar>}
    </Stack>
  );
}

export function ActionToolbar({ children }: { children: ReactNode }) {
  return <Stack className="bk-action-toolbar" direction="row" sx={{ width: { xs: "100%", sm: "auto" }, justifyContent: { xs: "flex-start", sm: "flex-end" }, alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>{children}</Stack>;
}
