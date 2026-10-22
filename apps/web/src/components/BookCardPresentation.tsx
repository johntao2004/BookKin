import { BOOK_COVER_ASPECT_RATIO, BookCover } from "./BookCover";
import { Box, CardActionArea, Menu, MenuItem, Stack, Typography } from "@/ui/primitives";
import { Card } from "@/ui/cards";
import { IconButton } from "@/ui/buttons";
import { DescriptionOutlined, MenuBookRounded, MoreVert } from "@/ui/icons";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { tokens } from "../theme/generated-tokens";

export interface BookCardAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export type BookCardVariant = "book" | "article";
export const cardCoverAspectRatio = { book: BOOK_COVER_ASPECT_RATIO, article: "2.35 / 1" } as const;

// 所有书籍集合共用一套书卡布局与操作入口。
/** One catalog layout and action entry point across all book collections. */
export function BookCardPresentation({ book, variant = "book", href, description, status, onOpen, onRead, actions = [] }: {
  book: { id: string; title: string; author: string; coverUrl?: string; available?: boolean };
  variant?: BookCardVariant;
  href?: string;
  description?: string;
  status?: string;
  onOpen?: () => void;
  onRead?: () => void;
  actions?: BookCardAction[];
}) {
  const available = book.available !== false;
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [failedCoverUrl, setFailedCoverUrl] = useState<string>();
  const coverFailed = failedCoverUrl === book.coverUrl;
  const destination = href ?? (variant === "article" ? `/articles/${book.id}` : `/reader/${book.id}`);
  const coverAspectRatio = cardCoverAspectRatio[variant];

  return (
    <Card variant="borderless" sx={{ "&.ant-card": { boxShadow: "none" }, minWidth: 0, bgcolor: "transparent", overflow: "visible", contentVisibility: "auto", containIntrinsicSize: "420px" }}>
      <CardActionArea component={onOpen ? "button" : available ? Link : "div"} to={!onOpen && available ? destination : undefined} type={onOpen ? "button" : undefined} onClick={onOpen} disabled={!available} sx={{ width: "100%", aspectRatio: coverAspectRatio, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: `${tokens.radius.lg}px`, overflow: variant === "book" ? "visible" : "hidden", "&:hover": { opacity: 1 } }}>
        {variant === "book" ? <BookCover src={book.coverUrl} alt={`${book.title}封面`} title={book.title} sx={{ opacity: available ? 1 : 0.62 }} /> : book.coverUrl && !coverFailed ? (
          <Box component="img" src={book.coverUrl} alt={`${book.title}封面`} loading="lazy" decoding="async" onError={() => setFailedCoverUrl(book.coverUrl)} sx={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", display: "block", objectFit: "cover", borderRadius: `${tokens.radius.lg}px`, bgcolor: "background.paper", boxShadow: tokens.shadow.cover, opacity: available ? 1 : 0.62 }} />
        ) : (
          <Box sx={{ width: "100%", aspectRatio: coverAspectRatio, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: `${tokens.spacing[4]}px`, p: `${tokens.spacing[4]}px`, bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, opacity: available ? 1 : 0.62 }}>
            {variant === "article" ? <DescriptionOutlined /> : <MenuBookRounded />}
            <Typography sx={{ textAlign: "center", overflowWrap: "anywhere" }}>{variant === "article" ? "暂无封面" : book.title}</Typography>
          </Box>
        )}
      </CardActionArea>
      <Box sx={{ display: "grid", gridTemplateColumns: `minmax(0, 1fr) ${tokens.layout.iconButtonSize}px`, alignItems: "start", gap: `${tokens.spacing[2]}px`, mt: `${tokens.spacing[3]}px` }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" noWrap={variant !== "article"} title={book.title} sx={variant === "article" ? { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, minHeight: "2lh", overflow: "hidden", overflowWrap: "anywhere" } : undefined}>{book.title}</Typography>
          <Stack direction="row" sx={{ alignItems: "baseline", gap: `${tokens.spacing[2]}px`, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap title={book.author} sx={{ minWidth: 0, flex: 1 }}>{book.author}</Typography>
            {status ? <Typography variant="body2" color="text.secondary" noWrap sx={{ flexShrink: 0 }}>{status}</Typography> : null}
          </Stack>
          {variant === "article" && description ? <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, minHeight: "2lh", overflow: "hidden", overflowWrap: "anywhere", mt: `${tokens.spacing[2]}px` }}>{description}</Typography> : null}
          {!available && <Typography variant="caption" color="warning.main">文件暂不可读</Typography>}
        </Box>
        <IconButton aria-label={`${book.title}更多操作`} onClick={(event: any) => setAnchor(event.currentTarget)}><MoreVert fontSize="small" /></IconButton>
      </Box>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem disabled={!available} onClick={() => { setAnchor(null); if (available) { if (onRead) onRead(); else if (variant === "article" && onOpen) onOpen(); else navigate(destination); } }}>{variant === "article" ? "打开文章" : "开始阅读"}</MenuItem>
        {actions.map(action => <MenuItem key={action.label} onClick={() => { setAnchor(null); action.onClick(); }} sx={{ color: action.danger ? "error.main" : undefined }}>{action.label}</MenuItem>)}
      </Menu>
    </Card>
  );
}
