import { ArrowBackRounded } from "@/ui/icons";
import { BookmarkBorderRounded } from "@/ui/icons";
import { BookmarkRounded } from "@/ui/icons";
import { FormatListBulletedRounded } from "@/ui/icons";
import { NotesOutlined } from "@/ui/icons";
import { SettingsBrightnessOutlined } from "@/ui/icons";
import { AppBar } from "@/ui/primitives";
import { Box } from "@/ui/primitives";
import { IconButton } from "@/ui/buttons";
import { Stack } from "@/ui/primitives";
import { Toolbar } from "@/ui/primitives";
import { Tooltip } from "@/ui/feedback";
import { Typography } from "@/ui/primitives";
import type { MouseEventHandler } from "react";
import type { BookFormat } from "../../domain/types";
import { tokens } from "../../theme/generated-tokens";
import { readerWidthSx, topNavigationSurfaceSx } from "../PageHeader";
import { READER_PROGRESS_HEIGHT } from "./reader-layout";

interface ReaderTopBarProps {
  title: string;
  subtitle: string;
  format: BookFormat;
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
}: ReaderTopBarProps) {
  const safeProgress = Math.max(0, Math.min(100, progressPercent));

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
          <IconButton onClick={onBack} color="inherit" aria-label={backLabel}><ArrowBackRounded /></IconButton>
        </Tooltip>
        <Box sx={{ minWidth: 0, ml: 1, flex: 1 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: tokens.typography.fontWeight.semibold }}>{title}</Typography>
          <Typography variant="caption" noWrap color="text.secondary" sx={{ display: "block" }}>{subtitle}</Typography>
        </Box>
        <Stack direction="row" sx={{ alignItems: "center", flexShrink: 0 }}>
          {tableOfContentsAvailable && (
            <Tooltip title="目录">
              <IconButton onClick={onOpenTableOfContents} color="inherit" aria-label="打开目录"><FormatListBulletedRounded /></IconButton>
            </Tooltip>
          )}
          {privateActions && <Tooltip title={bookmarked ? "移除书签" : "添加书签"}>
            <span>
              <IconButton disabled={bookmarkBusy} onClick={onToggleBookmark} color="inherit" aria-label="切换书签">
                {bookmarked ? <BookmarkRounded color="primary" /> : <BookmarkBorderRounded />}
              </IconButton>
            </span>
          </Tooltip>}
          <Tooltip title="阅读设置">
            <IconButton onClick={onOpenSettings} color="inherit" aria-label="阅读设置"><SettingsBrightnessOutlined /></IconButton>
          </Tooltip>
          {privateActions && <Tooltip title="本书笔记">
            <IconButton onClick={onOpenNotes} color="inherit" aria-label="打开笔记"><NotesOutlined /></IconButton>
          </Tooltip>}
        </Stack>
      </Toolbar>
      <Box sx={{ height: READER_PROGRESS_HEIGHT, bgcolor: "divider" }}>
        <Box sx={{ height: "100%", width: `${safeProgress}%`, bgcolor: "primary.main", transition: "width 180ms ease" }} />
      </Box>
    </AppBar>
  );
}
