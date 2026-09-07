import { Box } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import type { ReactElement, ReactNode } from "react";
import { tokens } from "../theme/generated-tokens";

export function OverviewCardHeader({
  id,
  icon,
  children,
  inverse = false,
}: {
  id: string;
  icon: ReactElement;
  children: ReactNode;
  inverse?: boolean;
}) {
  return (
    <Stack
      direction="row"
      sx={{
        minHeight: `${tokens.typography.fontSize.title}px`,
        alignItems: "center",
        gap: `${tokens.spacing[2]}px`,
        // The progress card is a dark surface in every site theme.  Keep its
        // heading/icon at the same size and rhythm as the other cards while
        // switching to the high-contrast text token instead of a theme
        // primary tint that becomes muddy in Night mode.
        color: inverse ? "common.white" : "primary.main",
      }}
    >
      <Box
        component="span"
        aria-hidden="true"
        sx={{
          display: "inline-flex",
          flexShrink: 0,
          "& .bk-icon": { fontSize: `${tokens.typography.fontSize.title}px` },
        }}
      >
        {icon}
      </Box>
      <Typography
        id={id}
        variant="h6"
        component="h2"
        sx={{ fontWeight: tokens.typography.fontWeight.semibold }}
      >
        {children}
      </Typography>
    </Stack>
  );
}
