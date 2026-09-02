import { BookmarkAddOutlined } from "@/ui/icons";
import { DeleteOutlined } from "@/ui/icons";
import { DriveFileMoveOutlined } from "@/ui/icons";
import { EditNoteRounded } from "@/ui/icons";
import { MoreVert } from "@/ui/icons";
import { PlayArrowRounded } from "@/ui/icons";
import { Box } from "@/ui";
import { Card } from "@/ui";
import { CardActionArea } from "@/ui";
import { IconButton } from "@/ui";
import { Menu } from "@/ui";
import { MenuItem } from "@/ui";
import { Stack } from "@/ui";
import { Typography } from "@/ui";
import { useState } from "react";
import type { Book, FileOperationType } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

interface BookCardProps {
  book: Book;
  onOpen: (book: Book) => void;
  onRead: (book: Book) => void;
  onEditMetadata?: (book: Book) => void;
  onFileOperation?: (book: Book, type: FileOperationType) => void;
  onAddToBooklist?: (book: Book) => void;
}

export function BookCard({ book, onOpen, onRead, onEditMetadata, onFileOperation, onAddToBooklist }: BookCardProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <Card sx={{ bgcolor: "transparent", overflow: "visible", contentVisibility: "auto", containIntrinsicSize: "420px" }}>
      <CardActionArea
        onClick={() => onOpen(book)}
        sx={{
          borderRadius: `${tokens.radius.lg}px`,
          overflow: "hidden",
          "&:hover": { opacity: 1 },
        }}
      >
        <Box
          component="img"
          src={book.coverUrl}
          alt={`${book.title}封面`}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          sx={{
            width: "100%",
            aspectRatio: "2 / 3",
            display: "block",
            objectFit: "cover",
            bgcolor: "background.paper",
            boxShadow: tokens.shadow.cover,
          }}
        />
      </CardActionArea>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", justifyContent: "space-between", mt: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" noWrap title={book.title}>{book.title}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{book.author}</Typography>
        </Box>
        <Stack direction="row" sx={{ alignItems: "center", gap: `${tokens.spacing[1]}px`, flexShrink: 0 }}>
          {book.progress > 0 && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>已读 {Math.round(book.progress)}%</Typography>}
          <IconButton size="small" aria-label={`${book.title}更多操作`} onClick={(event: any) => setAnchor(event.currentTarget)}>
            <MoreVert fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => { setAnchor(null); onRead(book); }}><PlayArrowRounded sx={{ mr: 1.5 }} />开始阅读</MenuItem>
        {onAddToBooklist && <MenuItem onClick={() => { setAnchor(null); onAddToBooklist(book); }}><BookmarkAddOutlined sx={{ mr: 1.5 }} />加入书单</MenuItem>}
        {onEditMetadata && <MenuItem onClick={() => { setAnchor(null); onEditMetadata(book); }}><EditNoteRounded sx={{ mr: 1.5 }} />编辑元信息</MenuItem>}
        {onFileOperation && ([
          { type: "MOVE", label: "移动", icon: <DriveFileMoveOutlined key="move" /> },
          { type: "TRASH", label: "移入回收站", icon: <DeleteOutlined key="trash" /> },
        ] satisfies Array<{ type: FileOperationType; label: string; icon: React.ReactNode }>).map(({ type, label, icon }) => (
          <MenuItem key={type} onClick={() => { setAnchor(null); onFileOperation(book, type); }} sx={{ color: type === "TRASH" ? "error.main" : undefined }}>
            <Box component="span" sx={{ display: "inline-flex", mr: 1.5 }}>{icon}</Box>{label}
          </MenuItem>
        ))}
      </Menu>
    </Card>
  );
}
