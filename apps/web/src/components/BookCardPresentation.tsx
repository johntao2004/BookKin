import { Box, CardActionArea, Menu, MenuItem, Stack, Typography } from "@/ui/primitives";
import { Card } from "@/ui/cards";
import { IconButton } from "@/ui/buttons";
import { MoreVert, PlayArrowRounded } from "@/ui/icons";
import { Link, useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { tokens } from "../theme/generated-tokens";

export interface BookCardAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

// 所有书籍集合共用一套书卡布局与操作入口。
/** One catalog layout and action entry point across all book collections. */
export function BookCardPresentation({ book, onOpen, onRead, actions = [] }: {
  book: { id: string; title: string; author: string; coverUrl: string; available?: boolean };
  onOpen?: () => void;
  onRead?: () => void;
  actions?: BookCardAction[];
}) {
  const available = book.available !== false;
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <Card variant="borderless" sx={{ "&.ant-card": { boxShadow: "none" }, minWidth: 0, bgcolor: "transparent", overflow: "visible", contentVisibility: "auto", containIntrinsicSize: "420px" }}>
      <CardActionArea component={onOpen ? "button" : available ? Link : "div"} to={!onOpen && available ? `/reader/${book.id}` : undefined} type={onOpen ? "button" : undefined} onClick={onOpen} disabled={!available} sx={{ borderRadius: `${tokens.radius.lg}px`, overflow: "hidden", "&:hover": { opacity: 1 } }}>
        <Box component="img" src={book.coverUrl} alt={`${book.title}封面`} loading="lazy" decoding="async" sx={{ width: "100%", aspectRatio: "2 / 3", display: "block", objectFit: "cover", bgcolor: "background.paper", boxShadow: tokens.shadow.cover, opacity: available ? 1 : 0.62 }} />
      </CardActionArea>
      <Box sx={{ display: "grid", gridTemplateColumns: `minmax(0, 1fr) ${tokens.layout.iconButtonSize}px`, alignItems: "start", gap: `${tokens.spacing[2]}px`, mt: `${tokens.spacing[3]}px` }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" noWrap title={book.title}>{book.title}</Typography>
          <Stack direction="row" sx={{ alignItems: "baseline", gap: `${tokens.spacing[2]}px`, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap title={book.author} sx={{ minWidth: 0, flex: 1 }}>{book.author}</Typography>
          </Stack>
          {!available && <Typography variant="caption" color="warning.main">文件暂不可读</Typography>}
        </Box>
        <IconButton aria-label={`${book.title}更多操作`} onClick={(event: any) => setAnchor(event.currentTarget)}><MoreVert fontSize="small" /></IconButton>
      </Box>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem disabled={!available} onClick={() => { setAnchor(null); if (available) { if (onRead) onRead(); else navigate(`/reader/${book.id}`); } }}><PlayArrowRounded sx={{ mr: `${tokens.spacing[3]}px` }} />开始阅读</MenuItem>
        {actions.map(action => <MenuItem key={action.label} onClick={() => { setAnchor(null); action.onClick(); }} sx={{ color: action.danger ? "error.main" : undefined }}>{action.icon && <Box component="span" sx={{ display: "inline-flex", mr: `${tokens.spacing[3]}px` }}>{action.icon}</Box>}{action.label}</MenuItem>)}
      </Menu>
    </Card>
  );
}
