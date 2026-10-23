// 阅读器共用导航与工具入口，动作由父级传入以保持 EPUB/PDF 行为一致。
// Shared reader navigation/tools delegate actions to parents for consistent EPUB/PDF behavior.
import { ArrowBackRounded } from "@/ui/icons";
import { BookmarkBorderRounded } from "@/ui/icons";
import { BookmarkRounded } from "@/ui/icons";
import { FormatListBulletedRounded } from "@/ui/icons";
import { MoreVert } from "@/ui/icons";
import { NotesOutlined } from "@/ui/icons";
import { SettingsBrightnessOutlined } from "@/ui/icons";
import { AppBar } from "@/ui/primitives";
import { Box } from "@/ui/primitives";
import { IconButton } from "@/ui/buttons";
import { Menu } from "@/ui/primitives";
import { MenuItem } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Toolbar } from "@/ui/primitives";
import { Tooltip } from "@/ui/feedback";
import { Typography } from "@/ui/primitives";
import { useMediaQuery } from "@/ui/primitives";
import { useState, type MouseEvent, type MouseEventHandler, type ReactNode } from "react";
import type { BookFormat } from "../../domain/types";
import { tokens } from "../../theme/generated-tokens";
import { readerWidthSx, topNavigationSurfaceSx } from "../PageHeader";
import { READER_PROGRESS_HEIGHT } from "./reader-layout";

interface ReaderTopBarProps {
  title: string;
  subtitle: string;
  format: BookFormat | "ARTICLE";
  notesLabel?: string;
  progressPercent: number;
  tableOfContentsAvailable: boolean;
  bookmarked: boolean;
  bookmarkBusy: boolean;
  onBack: () => void;
  backLabel?: string;
  onOpenTableOfContents: () => void;
  onToggleBookmark: () => void;
  onOpenSettings: MouseEventHandler<HTMLButtonElement>;
  onOpenNotes: () => void;
  privateActions?: boolean;
  notesAvailable?: boolean;
  assistant?: ReactNode;
}

export function ReaderTopBar({
  title,
  subtitle,
  format,
  progressPercent,
  tableOfContentsAvailable,
  bookmarked,
  bookmarkBusy,
  onBack,
  backLabel = "返回书库",
  onOpenTableOfContents,
  onToggleBookmark,
  onOpenSettings,
  onOpenNotes,
  privateActions = true,
  notesLabel = "本书笔记",
  notesAvailable = privateActions,
  assistant,
}: ReaderTopBarProps) {
  const safeProgress = Math.max(0, Math.min(100, progressPercent));
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const compactChrome = !useMediaQuery(`(min-width: ${tokens.layout.breakpointMobile}px)`);
  const hasSecondaryActions = tableOfContentsAvailable || privateActions || notesAvailable;
  const closeMore = () => setMoreAnchor(null);
  const touchIconSx = { width: tokens.layout.touchTarget, height: tokens.layout.touchTarget };

  return (
    <AppBar
      component="section"
      className="bk-top-nav bk-reader-control-bar"
      position="sticky"
      elevation={0}
      data-reader-format={format}
      data-reader-layout="shared"
      sx={topNavigationSurfaceSx}
    >
      <Toolbar
        component="nav"
        aria-label="阅读器顶部导航"
        sx={{
          ...readerWidthSx,
          minHeight: `${tokens.layout.navHeight}px !important`,
        }}
      >
        <Tooltip title={backLabel}>
          <IconButton onClick={onBack} color="inherit" aria-label={backLabel} sx={touchIconSx}><ArrowBackRounded /></IconButton>
        </Tooltip>
        <Box sx={{ minWidth: 0, ml: 1, flex: 1 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: tokens.typography.fontWeight.semibold }}>{title}</Typography>
          {!compactChrome && <Typography variant="caption" noWrap color="text.secondary" sx={{ display: "block" }}>{subtitle}</Typography>}
        </Box>
        {assistant}
        {compactChrome ? <Stack direction="row" sx={{ alignItems: "center", flexShrink: 0 }}>
          <Tooltip title="阅读设置">
            <IconButton onClick={onOpenSettings} color="inherit" aria-label="阅读设置" sx={touchIconSx}><SettingsBrightnessOutlined /></IconButton>
          </Tooltip>
          {hasSecondaryActions && (
            <Tooltip title="更多阅读操作">
              <IconButton
                onClick={(event: MouseEvent<HTMLButtonElement>) => setMoreAnchor(event.currentTarget)}
                color="inherit"
                aria-label="更多阅读操作"
                aria-haspopup="menu"
                aria-expanded={Boolean(moreAnchor)}
                sx={touchIconSx}
              >
                <MoreVert />
              </IconButton>
            </Tooltip>
          )}
        </Stack> : <Stack direction="row" sx={{ alignItems: "center", flexShrink: 0 }}>
          {tableOfContentsAvailable && (
            <Tooltip title="目录">
              <IconButton onClick={onOpenTableOfContents} color="inherit" aria-label="打开目录" sx={touchIconSx}><FormatListBulletedRounded /></IconButton>
            </Tooltip>
          )}
          {privateActions && <Tooltip title={bookmarked ? "移除书签" : "添加书签"}>
            <span>
              <IconButton disabled={bookmarkBusy} onClick={onToggleBookmark} color="inherit" aria-label="切换书签" aria-pressed={bookmarked} sx={touchIconSx}>
                {bookmarked ? <BookmarkRounded color="primary" /> : <BookmarkBorderRounded />}
              </IconButton>
            </span>
          </Tooltip>}
          <Tooltip title="阅读设置">
            <IconButton onClick={onOpenSettings} color="inherit" aria-label="阅读设置" sx={touchIconSx}><SettingsBrightnessOutlined /></IconButton>
          </Tooltip>
          {notesAvailable && <Tooltip title={notesLabel}>
            <IconButton onClick={onOpenNotes} color="inherit" aria-label="打开笔记" sx={touchIconSx}><NotesOutlined /></IconButton>
          </Tooltip>}
        </Stack>}
      </Toolbar>
      <Box sx={{ height: READER_PROGRESS_HEIGHT, bgcolor: "divider" }}>
        <Box sx={{ height: "100%", width: `${safeProgress}%`, bgcolor: "primary.main", transition: "width 180ms ease" }} />
      </Box>
      <Menu
        anchorEl={moreAnchor}
        open={Boolean(moreAnchor)}
        onClose={closeMore}
        slotProps={{ paper: { sx: { minWidth: `calc(100vw - ${tokens.spacing[8]}px)`, maxWidth: `calc(100vw - ${tokens.spacing[8]}px)`, maxHeight: `calc(100dvh - ${tokens.spacing[8]}px)`, overflowY: "auto", overscrollBehavior: "contain" } } }}
      >
        {tableOfContentsAvailable && <MenuItem onClick={() => { closeMore(); onOpenTableOfContents(); }}>目录</MenuItem>}
        {privateActions && (
          <MenuItem disabled={bookmarkBusy} onClick={() => { closeMore(); onToggleBookmark(); }}>{bookmarked ? "移除书签" : "添加书签"}</MenuItem>
        )}
        {notesAvailable && <MenuItem onClick={() => { closeMore(); onOpenNotes(); }}>{notesLabel}</MenuItem>}
      </Menu>
    </AppBar>
  );
}
