import { Box } from "@/ui";
import { Stack } from "@/ui";
import { Typography } from "@/ui";
import type { SxProps, Theme } from "@/ui";
import type { ReactNode } from "react";
import { tokens } from "../theme/generated-tokens";

export function PageContainer({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: tokens.layout.contentMax,
        mx: "auto",
        px: { xs: 2, sm: 3, lg: 0 },
        py: { xs: 4, md: 6 },
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
  return (
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "flex-end" }, gap: 2, mb: 4 }}>
      <Box sx={{ maxWidth: 720 }}>
        {eyebrow && <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, letterSpacing: "0.12em" }}>{eyebrow}</Typography>}
        <Typography variant="h2" component="h1">{title}</Typography>
        {description && <Typography color="text.secondary" sx={{ mt: 1 }}>{description}</Typography>}
      </Box>
      {action}
    </Stack>
  );
}
