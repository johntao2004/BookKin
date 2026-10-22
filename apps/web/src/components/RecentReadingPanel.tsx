import { overviewCardSx, overviewContentSpacing } from "./overviewCardLayout";
import { BookCover } from "./BookCover";
import { Link } from "react-router-dom";
import { MenuBookRounded } from "@/ui/icons";
import { Box, Stack, Typography } from "@/ui/primitives";
import type { ReadingOverview } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { OverviewCardHeader } from "./OverviewCardHeader";
import { OverviewEmptyState } from "./OverviewEmptyState";

// EPUB CFI stores an exact position, not a trustworthy chapter number.
export function readingPositionLabel(locator: string, format: "EPUB" | "PDF"): string {
  const page = format === "PDF" ? locator.match(/^pdf:page=([1-9]\d*)(?:&|$)/u)?.[1] : undefined;
  return page ? `第 ${page} 页` : "已保存阅读位置";
}

export function RecentReadingPanel({ items }: { items: ReadingOverview["recentReading"] }) {
  return <Stack component="article" aria-labelledby="recent-reading-card-title" sx={{
    ...overviewCardSx,
    bgcolor: "secondary.dark", color: "common.white", border: 1, borderColor: "secondary.dark",
  }}>
    <OverviewCardHeader id="recent-reading-card-title" icon={<MenuBookRounded />} inverse>最近阅读</OverviewCardHeader>
    {items.length ? <Box component="ul" aria-label="最近阅读书籍" sx={{ listStyle: "none", p: 0, m: 0, mt: overviewContentSpacing,
      display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gridAutoRows: `${tokens.spacing[16]}px`, gap: `${tokens.spacing[3]}px`, minHeight: 0,
    }}>
      {items.map(({ book, position }) => <Box component="li" key={book.id} sx={{ minWidth: 0, minHeight: 0, display: "flex" }}>
        <Box component={Link} to={`/reader/${book.id}`} aria-label={`继续阅读《${book.title}》`} sx={{
          display: "flex", alignItems: "center", gap: `${tokens.spacing[3]}px`, flex: 1,
          minWidth: 0, minHeight: 0,
          color: "inherit", textDecoration: "none", borderRadius: `${tokens.radius.md}px`,
          "&:hover": { textDecoration: "underline" },
          "&:focus-visible": { outline: `${tokens.spacing[1] / 2}px solid ${tokens.color.semantic.textOnDark}`, outlineOffset: `${tokens.spacing[1]}px` },
        }}>
          <BookCover src={book.coverUrl} alt="" sx={{ width: `${tokens.spacing[12]}px` }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography component="span" variant="body1" noWrap title={book.title} sx={{ display: "block", mb: `${tokens.spacing[1]}px` }}>{book.title}</Typography>
            <Typography variant="caption" noWrap title={readingPositionLabel(position.locator, book.format)} sx={{ display: "block", opacity: 0.8 }}>
              已读 {Math.round(Math.max(0, Math.min(1, position.progress)) * 100)}% · {readingPositionLabel(position.locator, book.format)}
            </Typography>
          </Box>
        </Box>
      </Box>)}
    </Box> : <OverviewEmptyState titleId="currently-reading-title" title="请开始阅读" description="打开任意一本书后，阅读进度会显示在这里。" inverse />}
  </Stack>;
}
