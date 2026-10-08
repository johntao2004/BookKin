import { AutoStoriesOutlined } from "@/ui/icons";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import type { ReactNode } from "react";
import { tokens } from "../theme/generated-tokens";
import { EMPTY_CATALOG_TITLE } from "../ui/empty-state-copy";

export function BookCatalogEmptyState({ action }: { action?: ReactNode }) {
  return (
    <Stack sx={{ alignItems: "center", textAlign: "center", py: `${tokens.spacing[20]}px`, gap: `${tokens.spacing[3]}px` }}>
      <AutoStoriesOutlined color="primary" sx={{ fontSize: tokens.typography.fontSize.display }} />
      <Typography variant="h4">{EMPTY_CATALOG_TITLE}</Typography>
      {action}
    </Stack>
  );
}
