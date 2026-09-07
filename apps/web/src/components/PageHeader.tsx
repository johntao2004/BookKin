import { Box } from "@/ui";
import { Stack } from "@/ui";
import { Typography } from "@/ui";
import type { SxProps, Theme } from "@/ui";
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
        pt: { xs: 2, md: 3 },
        pb: { xs: 4, md: 6 },
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
    <Stack sx={{ alignItems: "stretch", gap: embedded ? 2 : 4, mb: action || embedded ? 2 : 4 }}>
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && !embedded && <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, letterSpacing: "0.12em" }}>{eyebrow}</Typography>}
        <Typography variant={embedded ? "h5" : "h2"} component={embedded ? "h2" : "h1"}>{title}</Typography>
        {description && <Typography color="text.secondary" sx={{ mt: 1 }}>{description}</Typography>}
      </Box>
      {action && <ActionToolbar>{action}</ActionToolbar>}
    </Stack>
  );
}

export function ActionToolbar({ children }: { children: ReactNode }) {
  return <Stack direction="row" sx={{ width: "100%", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>{children}</Stack>;
}
