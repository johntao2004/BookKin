// 分类和书单发现卡片共用封面拼图与可见性展示，不自行授予书籍访问权。
// Discovery cards share cover mosaics and visibility presentation without granting book access themselves.
import { BookCardPresentation } from "./BookCardPresentation";
import { AddRounded } from "@/ui/icons";
import { AutoStoriesOutlined } from "@/ui/icons";
import { LockOutlined } from "@/ui/icons";
import { PeopleAltOutlined } from "@/ui/icons";
import { PublicOutlined } from "@/ui/icons";
import { Box } from "@/ui/primitives";
import { Card } from "@/ui/cards";
import { CardActionArea } from "@/ui/primitives";
import { Chip } from "@/ui/feedback";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { Link } from "react-router-dom";
import type { BooklistSummary, BooklistVisibility, BrowseBook, CategorySummary } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function CoverMosaic({ books, label, compact = false }: { books: BrowseBook[]; label: string; compact?: boolean }) {
  const visible = books.slice(0, 4);
  return (
    <Box
      role="img"
      aria-label={label}
      sx={{
        display: "grid",
        gridTemplateColumns: visible.length <= 1 ? "1fr" : "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: visible.length <= 2 ? "1fr" : "repeat(2, minmax(0, 1fr))",
        gap: `${tokens.spacing[2]}px`,
        aspectRatio: compact ? "4 / 3" : "1 / 1",
        minHeight: 0,
        bgcolor: "background.paper",
        borderRadius: `${tokens.radius.xl}px`,
        overflow: "hidden",
      }}
    >
      {visible.length ? visible.map((book) => (
        <Box
          key={book.id}
          component="img"
          src={book.coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          sx={{ width: "100%", height: "100%", minHeight: 0, objectFit: "cover", borderRadius: `${tokens.radius.sm}px` }}
        />
      )) : (
        <Stack sx={{ gridColumn: "1 / -1", gridRow: "1 / -1", alignItems: "center", justifyContent: "center", color: "text.disabled" }}>
          <AutoStoriesOutlined sx={{ fontSize: 48 }} />
        </Stack>
      )}
    </Box>
  );
}

export function CategoryCard({ category }: { category: CategorySummary }) {
  return (
    <Card sx={{ bgcolor: "transparent", overflow: "visible" }}>
      <CardActionArea
        component={Link}
        to={`/categories/${category.id}`}
        sx={{ display: "block", borderRadius: `${tokens.radius.xl}px`, textAlign: "left", "&:hover": { opacity: 1 } }}
      >
        <CoverMosaic books={category.previewBooks} label={`${category.name}分类封面`} compact />
        <Stack sx={{ pt: `${tokens.spacing[4]}px`, gap: `${tokens.spacing[1]}px` }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", gap: `${tokens.spacing[3]}px` }}>
            <Typography variant="h4" component="h2">{category.name}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{category.bookCount} 本</Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", height: `${tokens.typography.lineHeight.body * 2}em`, lineHeight: tokens.typography.lineHeight.body }}>
            {category.description || "等待馆藏慢慢填满这个分类。"}
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export function VisibilityChip({ visibility, size = "small" }: { visibility: BooklistVisibility; size?: "small" | "medium" }) {
  const config = {
    PRIVATE: { label: "仅自己", icon: <LockOutlined /> },
    MEMBERS: { label: "家庭成员", icon: <PeopleAltOutlined /> },
    PUBLIC: { label: "公开", icon: <PublicOutlined /> },
  }[visibility];
  return <Chip size={size} variant="outlined" icon={config.icon} label={config.label} />;
}

export function BooklistCard({ booklist }: { booklist: BooklistSummary }) {
  return (
    <Card variant="borderless" sx={{ "&.ant-card": { boxShadow: "none" }, width: "100%", maxWidth: { xs: "none", sm: tokens.spacing[24] * 3 }, bgcolor: "transparent", overflow: "visible" }}>
      <CardActionArea
        component={Link}
        to={`/booklists/${booklist.id}`}
        sx={{ display: "block", borderRadius: `${tokens.radius.xl}px`, textAlign: "left", "&:hover": { opacity: 1 } }}
      >
        <CoverMosaic books={booklist.previewBooks} label={`${booklist.title}书单封面`} />
        <Stack sx={{ pt: `${tokens.spacing[4]}px`, gap: `${tokens.spacing[1]}px` }}>
          <Typography variant="h5" component="h3" noWrap title={booklist.title}>{booklist.title}</Typography>
          <Typography color="text.secondary" noWrap title={booklist.description || undefined}>
            {booklist.description || "创建者还没有写下这份书单的说明。"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {booklist.ownerDisplayName ? `由 ${booklist.ownerDisplayName} 创建` : "共享书单"} · {booklist.bookCount} 本
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export function BrowseBookCard({ book, onAdd, onRemove }: {
  book: BrowseBook;
  onAdd?: (book: BrowseBook) => void;
  onRemove?: (book: BrowseBook) => void;
}) {
  return <BookCardPresentation book={book} actions={[
    ...(onAdd ? [{ label: "加入书单", icon: <AddRounded />, onClick: () => onAdd(book) }] : []),
    ...(onRemove ? [{ label: "移出", danger: true, onClick: () => onRemove(book) }] : []),
  ]} />;
}
