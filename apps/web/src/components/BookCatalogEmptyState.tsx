import { EmptyState } from "../ui/empty-state";
import { Stack } from "@/ui/primitives";
import type { ReactNode } from "react";
import { tokens } from "../theme/generated-tokens";
import { EMPTY_CATALOG_TITLE } from "../ui/empty-state-copy";

export function BookCatalogEmptyState({ action, title = EMPTY_CATALOG_TITLE }: { action?: ReactNode; title?: string }) {
  return (
    <Stack sx={{ border: "1px dashed", borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, bgcolor: "transparent", px: `${tokens.spacing[6]}px`, alignItems: "center", textAlign: "center", py: { xs: `${tokens.spacing[10]}px`, sm: `${tokens.spacing[20]}px` }, gap: `${tokens.spacing[3]}px` }}>
      <EmptyState title={title} action={action} padded={false} />
    </Stack>
  );
}
