import { overviewContentSpacing } from "./overviewCardLayout";
// 概览卡空态保留共享高度与标题对齐，文案由具体业务模块提供。
// Overview empty states preserve shared sizing/alignment while business modules supply their copy.
import { EmptyStateIllustration } from "../ui/empty-state";
import { Box } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import type { ReactNode } from "react";
import { tokens } from "../theme/generated-tokens";

export function OverviewEmptyState({
  title,
  description,
  titleId,
  inverse = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  titleId?: string;
  inverse?: boolean;
}) {
  return (
    <Stack
      sx={{
        gap: `${tokens.spacing[3]}px`,
        minHeight: `${tokens.spacing[20]}px`,
        alignItems: "center",
        textAlign: "center",
        justifyContent: "center",
        flex: 1,
        mt: overviewContentSpacing,
      }}
    >
      <EmptyStateIllustration compact />
      <Box>
        <Typography id={titleId} variant="h4">{title}</Typography>
        {description != null ? (
          <Typography
            variant="body2"
            color={inverse ? "inherit" : "text.secondary"}
            sx={{ mt: `${tokens.spacing[1]}px`, ...(inverse ? { opacity: 0.68 } : {}) }}
          >
            {description}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}
