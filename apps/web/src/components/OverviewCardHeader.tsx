import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
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
        color: inverse ? "primary.light" : "primary.main",
      }}
    >
      <Box
        component="span"
        aria-hidden="true"
        sx={{
          display: "inline-flex",
          flexShrink: 0,
          "& .MuiSvgIcon-root": { fontSize: `${tokens.typography.fontSize.title}px` },
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
