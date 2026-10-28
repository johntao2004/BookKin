import type { ReactNode } from "react";
import { Box, headingTypographySx, Stack } from "@/ui/primitives";
import { tokens } from "../theme/generated-tokens";
import { BookCover } from "./BookCover";

// Upload review, editing and saved details share the same bibliographic geometry.
export const bookMetadataTitleSx = {
  ...headingTypographySx("h2"),
  overflowWrap: "anywhere",
};

export const bookMetadataFieldsSx = {
  display: "grid",
  gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
  columnGap: `${tokens.spacing[6]}px`,
  rowGap: `${tokens.spacing[4]}px`,
  minWidth: 0,
};

export function BookMetadataLayout({ coverUrl, coverAlt, coverActions, children }: {
  coverUrl?: string;
  coverAlt: string;
  coverActions?: ReactNode;
  children: ReactNode;
}) {
  return <Box sx={{ display: "grid", gridTemplateColumns: {
    xs: "minmax(0, 1fr)", sm: `${tokens.spacing[24] * 2}px minmax(0, 1fr)`, md: `${tokens.spacing[24] * 3}px minmax(0, 1fr)`,
  }, gap: { xs: `${tokens.spacing[6]}px`, md: `${tokens.spacing[8]}px` }, alignItems: "start" }}>
    <Stack sx={{ minWidth: 0, alignItems: "stretch", gap: `${tokens.spacing[3]}px` }}>
      <BookCover src={coverUrl} alt={coverAlt} sx={{ maxWidth: { xs: `${tokens.spacing[24] * 2}px`, sm: "100%" }, mx: { xs: "auto", sm: 0 } }} />
      {coverActions}
    </Stack>
    <Stack sx={{ minWidth: 0, gap: `${tokens.spacing[5]}px` }}>{children}</Stack>
  </Box>;
}
