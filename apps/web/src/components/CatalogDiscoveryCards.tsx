import { AddRounded } from "@/ui/icons";
import { AutoStoriesOutlined } from "@/ui/icons";
import { LockOutlined } from "@/ui/icons";
import { MenuBookRounded } from "@/ui/icons";
import { PeopleAltOutlined } from "@/ui/icons";
import { PublicOutlined } from "@/ui/icons";
import { Box } from "@/ui";
import { Button } from "@/ui";
import { Card } from "@/ui";
import { CardActionArea } from "@/ui";
import { Chip } from "@/ui";
import { IconButton } from "@/ui";
import { Stack } from "@/ui";
import { Tooltip } from "@/ui";
import { Typography } from "@/ui";
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
        p: `${tokens.spacing[3]}px`,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
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
          sx={{ width: "100%", height: "100%", minHeight: 0, objectFit: "cover", borderRadius: `${tokens.radius.sm}px`, boxShadow: tokens.shadow.cover }}
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
          <Typography color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "3.3em" }}>
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
    <Card sx={{ width: "100%", maxWidth: { xs: "none", sm: 292 }, bgcolor: "transparent", overflow: "visible" }}>
      <CardActionArea
        component={Link}
        to={`/booklists/${booklist.id}`}
        sx={{ display: "block", borderRadius: `${tokens.radius.xl}px`, textAlign: "left", "&:hover": { opacity: 1 } }}
      >
        <CoverMosaic books={booklist.previewBooks} label={`${booklist.title}书单封面`} />
        <Stack sx={{ pt: `${tokens.spacing[4]}px`, gap: `${tokens.spacing[2]}px` }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: `${tokens.spacing[3]}px` }}>
            <Typography variant="h5" component="h3">{booklist.title}</Typography>
            <VisibilityChip visibility={booklist.visibility} />
          </Stack>
          <Typography color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "3.3em" }}>
            {booklist.description || "创建者还没有写下这份书单的说明。"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {booklist.kind === "OFFICIAL" ? "官方书单" : `由 ${booklist.ownerDisplayName} 创建`} · {booklist.bookCount} 本
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
  return (
    <Card sx={{ bgcolor: "transparent", overflow: "visible", contentVisibility: "auto", containIntrinsicSize: "420px" }}>
      <CardActionArea
        component={book.available ? Link : "div"}
        to={book.available ? `/reader/${book.id}` : undefined}
        disabled={!book.available}
        sx={{ borderRadius: `${tokens.radius.lg}px`, overflow: "hidden", "&:hover": { opacity: 1 } }}
      >
        <Box component="img" src={book.coverUrl} alt={`${book.title}封面`} loading="lazy" decoding="async" sx={{ width: "100%", aspectRatio: "2 / 3", display: "block", objectFit: "cover", bgcolor: "background.paper", boxShadow: tokens.shadow.cover, opacity: book.available ? 1 : 0.62 }} />
      </CardActionArea>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", justifyContent: "space-between", mt: `${tokens.spacing[3]}px` }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" noWrap title={book.title}>{book.title}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{book.author}</Typography>
          {!book.available ? <Typography variant="caption" color="warning.main">文件暂不可读</Typography> : null}
        </Box>
        <Stack direction="row" sx={{ flexShrink: 0 }}>
          {onAdd ? <Tooltip title="加入书单"><IconButton size="small" aria-label={`将 ${book.title} 加入书单`} onClick={() => onAdd(book)}><AddRounded fontSize="small" /></IconButton></Tooltip> : null}
          {onRemove ? <Button size="small" color="error" onClick={() => onRemove(book)} sx={{ minWidth: 0, px: 1 }}>移出</Button> : null}
          {!onAdd && !onRemove && book.available ? <Tooltip title="开始阅读"><IconButton component={Link} to={`/reader/${book.id}`} size="small" aria-label={`阅读 ${book.title}`}><MenuBookRounded fontSize="small" /></IconButton></Tooltip> : null}
        </Stack>
      </Stack>
    </Card>
  );
}
