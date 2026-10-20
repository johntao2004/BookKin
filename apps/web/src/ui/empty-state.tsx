import Empty from "antd/es/empty";
import type { ReactNode } from "react";
import { Stack, Typography } from "./primitives";
import { tokens } from "../theme/generated-tokens";

/** Reuse the knowledge graph's Ant Design illustration across empty collections. */
export function EmptyStateIllustration({ compact = false }: { compact?: boolean }) {
  return <Empty image={Empty.PRESENTED_IMAGE_DEFAULT} description={false} style={{ margin: 0 }}
    styles={{ image: { height: compact ? tokens.spacing[12] : tokens.spacing[24], marginBottom: 0 } }} />;
}

export function EmptyState({ title, action, compact = false, padded = true }: {
  title: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  padded?: boolean;
}) {
  return <Stack sx={{ alignItems: "center", textAlign: "center", gap: `${tokens.spacing[3]}px`,
    py: padded ? `${compact ? tokens.spacing[4] : tokens.spacing[8]}px` : 0 }}>
    <EmptyStateIllustration compact={compact} />
    <Typography variant={compact ? "body2" : "h4"} color={compact ? "text.secondary" : "text.primary"}
      sx={compact ? undefined : { fontSize: { xs: tokens.typography.fontSize.title, sm: tokens.typography.fontSize.headingSm } }}>{title}</Typography>
    {action}
  </Stack>;
}
