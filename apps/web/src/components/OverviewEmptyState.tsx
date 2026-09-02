import { Box } from "@/ui";
import { Stack } from "@/ui";
import { Typography } from "@/ui";
import type { ReactNode } from "react";
import { tokens } from "../theme/generated-tokens";

export function OverviewEmptyState({
  title,
  description,
  titleId,
  inverse = false,
}: {
  title: ReactNode;
  description: ReactNode;
  titleId?: string;
  inverse?: boolean;
}) {
  return (
    <Stack
      sx={{
        minHeight: `${tokens.spacing[20]}px`,
        alignItems: "flex-start",
        justifyContent: "center",
        mt: `${tokens.spacing[4]}px`,
      }}
    >
      <Box>
        <Typography id={titleId} variant="h4">{title}</Typography>
        <Typography
          variant="body2"
          color={inverse ? "inherit" : "text.secondary"}
          sx={{ mt: `${tokens.spacing[1]}px`, ...(inverse ? { opacity: 0.68 } : {}) }}
        >
          {description}
        </Typography>
      </Box>
    </Stack>
  );
}
