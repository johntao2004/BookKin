import type { ReactNode } from "react";
import { Box, Typography } from "@/ui/primitives";
import { ActionToolbar } from "./PageHeader";
import { tokens } from "../theme/generated-tokens";

/** Shared collection heading, responsive tools and result flow. */
export function CatalogSection({ title, tools, summary, children }: {
  title: string;
  tools?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return <Box component="section" sx={{ minWidth: 0 }}>
    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: `${tokens.spacing[4]}px`, mb: `${tokens.spacing[4]}px` }}>
      <Typography variant="h4" component="h2" sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>{title}</Typography>
      {tools && <ActionToolbar>{tools}</ActionToolbar>}
    </Box>
    {summary && <Box sx={{ mb: `${tokens.spacing[4]}px` }}>{summary}</Box>}
    {children}
  </Box>;
}
