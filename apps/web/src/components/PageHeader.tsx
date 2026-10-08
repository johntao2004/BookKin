import { Box } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { flattenSx, useTheme } from "@/ui/primitives";
import type { SxProps, Theme } from "@/ui/primitives";
import { createContext, useContext, type ReactNode } from "react";

export const EmbeddedSettingsContext = createContext(false);
import { tokens } from "../theme/generated-tokens";

export const pageWidthSx = {
  width: "100%",
  maxWidth: "none",
  mx: "auto",
  px: { xs: `${tokens.spacing[3]}px`, sm: `${tokens.spacing[6]}px` },
};

// Reader chrome and document surfaces share the exact page frame at every
// viewport width. A narrower intermediate reader frame makes the two stacked
// navigation bars visibly drift apart on tablets and small laptops.
export const readerWidthSx = pageWidthSx;

export const topNavigationSurfaceSx = {
  bgcolor: "background.default",
  color: "text.primary",
  borderBottom: 0,
  boxShadow: "none",
};

export function PageContainer({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  const embedded = useContext(EmbeddedSettingsContext);
  const theme = useTheme();
  if (embedded) return <Box sx={sx}>{children}</Box>;
  return (
    <Box sx={{
      ...pageWidthSx,
      pb: { xs: 6, md: 8 },
      ...flattenSx(sx, theme),
      width: pageWidthSx.width,
      maxWidth: pageWidthSx.maxWidth,
      mx: pageWidthSx.mx,
      px: pageWidthSx.px,
      pt: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[6]}px` },
    }}>{children}</Box>
  );
}

export function PageTitle({
  children,
  color,
  className,
  id,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
  id?: string;
}) {
  return <Typography id={id} className={className} variant="h3" component="h1" color={color}>{children}</Typography>;
}

export function PageHeader({
  eyebrow,
  title,
  embeddedDescription,
  action,
}: {
  eyebrow: string;
  title: string;
  /** Supporting copy for embedded settings headings; standard page headers omit descriptions. */
  embeddedDescription?: string;
  action?: ReactNode;
}) {
  const embedded = useContext(EmbeddedSettingsContext);
  return (
    <Stack sx={{ mb: embedded ? 0 : `${tokens.spacing[6]}px` }}>
      {!embedded && <Typography variant="overline" color="text.secondary" sx={{ fontWeight: tokens.typography.fontWeight.medium }}>{eyebrow}</Typography>}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: embedded ? 2 : 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {embedded
            ? <Typography variant="h5" component="h2">{title}</Typography>
            : <PageTitle>{title}</PageTitle>}
        </Box>
        {action && <ActionToolbar>{action}</ActionToolbar>}
      </Stack>
      {embedded && embeddedDescription && <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 720 }}>{embeddedDescription}</Typography>}
    </Stack>
  );
}

export function ActionToolbar({ children }: { children: ReactNode }) {
  return <Stack className="bk-action-toolbar" direction="row" sx={{ width: { xs: "100%", sm: "auto" }, justifyContent: { xs: "flex-start", sm: "flex-end" }, alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>{children}</Stack>;
}

export function FormActions({ children }: { children: ReactNode }) {
  return <Stack direction="row" sx={{ width: "100%", justifyContent: "flex-end" }}>{children}</Stack>;
}
