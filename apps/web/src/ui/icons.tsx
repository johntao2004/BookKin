import {
  AppstoreAddOutlined,
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  BgColorsOutlined,
  BlockOutlined,
  BoldOutlined,
  BookFilled,
  BookOutlined,
  CheckCircleOutlined as AntCheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  CloudUploadOutlined as AntCloudUploadOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined as AntDeleteOutlined,
  DragOutlined,
  EditOutlined as AntEditOutlined,
  EnterOutlined,
  ExclamationCircleOutlined,
  FileAddOutlined,
  FileOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  FolderOutlined as AntFolderOutlined,
  FontSizeOutlined,
  GlobalOutlined,
  HomeOutlined as AntHomeOutlined,
  LeftOutlined,
  LockOutlined as AntLockOutlined,
  LogoutOutlined as AntLogoutOutlined,
  MenuOutlined,
  MinusOutlined,
  MoreOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  QuestionOutlined,
  ReadOutlined,
  ReloadOutlined,
  RightOutlined,
  RollbackOutlined,
  RotateLeftOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SearchOutlined,
  SecurityScanOutlined,
  SettingOutlined,
  SlidersOutlined,
  StarOutlined,
  SunOutlined,
  SyncOutlined,
  TeamOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  UpOutlined,
  UploadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { createElement, forwardRef, type CSSProperties, type ForwardRefExoticComponent, type RefAttributes } from "react";

/**
 * Local icon contract for BookKin.
 *
 * Screens keep semantic icon names and occasionally pass legacy presentation
 * props (`sx`, `fontSize`, `color`). Keeping that semantic
 * contract here lets the application use Ant Design without leaking a
 * second icon system into every screen.
 */
export type BookKinIconProps = {
  sx?: Record<string, unknown>;
  fontSize?: "small" | "medium" | "large" | "inherit" | string;
  color?: string;
  className?: string;
  style?: CSSProperties;
  [key: string]: unknown;
};

type BookKinIcon = ForwardRefExoticComponent<BookKinIconProps & RefAttributes<HTMLSpanElement>>;

const sxAliases: Record<string, string> = {
  bgcolor: "backgroundColor",
  m: "margin",
  mt: "marginTop",
  mr: "marginRight",
  mb: "marginBottom",
  ml: "marginLeft",
  mx: "marginInline",
  my: "marginBlock",
  p: "padding",
  pt: "paddingTop",
  pr: "paddingRight",
  pb: "paddingBottom",
  pl: "paddingLeft",
  px: "paddingInline",
  py: "paddingBlock",
};

const spacingProperties = new Set([
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft", "marginInline", "marginBlock",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "paddingInline", "paddingBlock",
  "gap", "rowGap", "columnGap",
]);

const unitlessProperties = new Set([
  "animationIterationCount", "columnCount", "fillOpacity", "flex", "flexGrow", "flexShrink", "fontWeight",
  "gridArea", "gridColumn", "gridColumnEnd", "gridColumnStart", "gridRow", "gridRowEnd", "gridRowStart",
  "lineHeight", "opacity", "order", "orphans", "tabSize", "widows", "zIndex", "zoom",
]);

function sxValue(key: string, value: unknown): unknown {
  if (value === undefined || value === null || value === false || typeof value === "object") return undefined;
  if (typeof value === "string") return resolveColor(value);
  if (typeof value !== "number") return value;
  if (unitlessProperties.has(key)) return value;
  if (spacingProperties.has(key)) return `${value * 8}px`;
  if (key === "borderRadius") return `${value * 4}px`;
  return `${value}px`;
}

function sxToStyle(sx: Record<string, unknown> | undefined): CSSProperties {
  if (!sx) return {};
  const style: Record<string, unknown> = {};
  Object.entries(sx).forEach(([rawKey, rawValue]) => {
    if (rawKey.startsWith("&") || rawKey.startsWith("@")) return;
    const key = sxAliases[rawKey] ?? rawKey;
    const value = sxValue(key, rawValue);
    if (value !== undefined) style[key] = value;
  });
  return style as CSSProperties;
}

function resolveColor(color: string | undefined) {
  if (!color) return undefined;
  const colors: Record<string, string> = {
    primary: "var(--color-primary)",
    "primary.main": "var(--color-primary)",
    "primary.light": "var(--color-primary-soft)",
    "primary.dark": "var(--color-primary-hover)",
    secondary: "var(--color-focus)",
    "secondary.main": "var(--color-focus)",
    "secondary.light": "color-mix(in srgb, var(--color-focus) 78%, var(--color-primitive-white))",
    "secondary.dark": "color-mix(in srgb, var(--color-focus) 78%, var(--color-primitive-black))",
    success: "var(--color-success)",
    "success.main": "var(--color-success)",
    warning: "var(--color-warning)",
    "warning.main": "var(--color-warning)",
    error: "var(--color-error)",
    "error.main": "var(--color-error)",
    "text.primary": "var(--color-text-primary)",
    "text.secondary": "var(--color-text-secondary)",
    "text.disabled": "var(--color-text-muted)",
    "background.default": "var(--color-canvas)",
    "background.paper": "var(--color-surface)",
    divider: "var(--color-border)",
    "common.white": "var(--color-primitive-white)",
    "common.black": "var(--color-primitive-black)",
    inherit: "inherit",
  };
  return colors[color] ?? color;
}

function createIcon(Component: unknown): BookKinIcon {
  return forwardRef<HTMLSpanElement, BookKinIconProps>(function BookKinIcon({ sx, fontSize, color, className, style, ...rest }, ref) {
    const size = fontSize === "small" ? 16 : fontSize === "large" ? 24 : fontSize === "medium" ? 20 : typeof fontSize === "string" && fontSize !== "inherit" ? fontSize : undefined;
    const iconProps = { ref, "aria-hidden": rest["aria-label"] ? undefined : true, ...(rest as Record<string, unknown>) };
    return createElement("span", { className: `bk-icon ${className ?? ""}`.trim(), style: { display: "inline-flex", fontSize: size as CSSProperties["fontSize"], color: resolveColor(color as string | undefined), ...(style as CSSProperties), ...sxToStyle(sx as Record<string, unknown> | undefined) } }, createElement(Component as any, iconProps));
  });
}

const ant = {
  AppstoreAddOutlined, AppstoreOutlined, ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined,
  BgColorsOutlined, BlockOutlined, BoldOutlined, BookFilled, BookOutlined, CheckCircleOutlined: AntCheckCircleOutlined, CheckOutlined,
  ClockCircleOutlined, CloseOutlined, CloudUploadOutlined: AntCloudUploadOutlined, CopyOutlined, DatabaseOutlined, DeleteOutlined: AntDeleteOutlined,
  DragOutlined, EditOutlined: AntEditOutlined, EnterOutlined, ExclamationCircleOutlined, FileAddOutlined, FileOutlined,
  FileTextOutlined, FilterOutlined, FolderOpenOutlined, FolderOutlined: AntFolderOutlined, FontSizeOutlined, GlobalOutlined,
  HomeOutlined: AntHomeOutlined, LeftOutlined, LockOutlined: AntLockOutlined, LogoutOutlined: AntLogoutOutlined, MenuOutlined, MinusOutlined, MoreOutlined,
  PictureOutlined, PlayCircleOutlined, PlusOutlined, QuestionOutlined, ReadOutlined, ReloadOutlined, RightOutlined,
  RollbackOutlined, RotateLeftOutlined, SafetyCertificateOutlined, ScheduleOutlined, SearchOutlined, SecurityScanOutlined,
  SettingOutlined, SlidersOutlined, StarOutlined, SunOutlined, SyncOutlined, TeamOutlined, UnderlineOutlined,
  UndoOutlined, UnorderedListOutlined, UpOutlined, UploadOutlined, EyeInvisibleOutlined, EyeOutlined, WarningOutlined,
};
const icon = (name: keyof typeof ant) => createIcon(ant[name] ?? QuestionOutlined);

export const AccessTimeRounded = icon("ClockCircleOutlined");
export const AddRounded = icon("PlusOutlined");
export const AdminPanelSettingsOutlined = icon("SafetyCertificateOutlined");
export const ArrowBackIosNewRounded = icon("LeftOutlined");
export const ArrowBackRounded = icon("ArrowLeftOutlined");
export const ArrowDownwardRounded = icon("ArrowDownOutlined");
export const ArrowForwardIosRounded = icon("RightOutlined");
export const ArrowForwardRounded = icon("ArrowRightOutlined");
export const ArrowUpwardRounded = icon("ArrowUpOutlined");
export const AutoAwesomeOutlined = icon("StarOutlined");
export const AutoStoriesOutlined = icon("ReadOutlined");
export const AutoStoriesRounded = icon("ReadOutlined");
export const BookmarkAddOutlined = icon("FileAddOutlined");
export const BookmarkBorderRounded = icon("BookOutlined");
export const BookmarkRounded = icon("BookFilled");
export const CategoryOutlined = icon("AppstoreOutlined");
export const CheckCircleOutlineRounded = icon("CheckCircleOutlined");
export const CheckCircleOutlined = icon("CheckCircleOutlined");
export const CheckRounded = icon("CheckOutlined");
export const CloseRounded = icon("CloseOutlined");
export const CloudUploadOutlined = icon("CloudUploadOutlined");
export const CollectionsBookmarkOutlined = icon("BookOutlined");
export const ContentCopyRounded = icon("CopyOutlined");
export const DeleteForeverOutlined = icon("DeleteOutlined");
export const DeleteOutlineRounded = icon("DeleteOutlined");
export const DeleteOutlined = icon("DeleteOutlined");
export const DescriptionOutlined = icon("FileTextOutlined");
export const DragIndicatorRounded = icon("DragOutlined");
export const DriveFileMoveOutlined = icon("FolderOpenOutlined");
export const DriveFileRenameOutlineRounded = icon("EditOutlined");
export const EditNoteRounded = icon("EditOutlined");
export const EditOutlined = icon("EditOutlined");
export const ErrorOutlineRounded = icon("ExclamationCircleOutlined");
export const ErrorOutlined = icon("ExclamationCircleOutlined");
export const FilterListRounded = icon("FilterOutlined");
export const FolderOutlined = icon("FolderOutlined");
export const FontDownloadOutlined = icon("FontSizeOutlined");
export const FontDownloadRounded = icon("FontSizeOutlined");
export const FormatBoldRounded = icon("BoldOutlined");
export const FormatListBulletedRounded = icon("UnorderedListOutlined");
export const FormatQuoteRounded = icon("BlockOutlined");
export const FormatSizeRounded = icon("FontSizeOutlined");
export const FormatUnderlinedRounded = icon("UnderlineOutlined");
export const GppGoodOutlined = icon("SecurityScanOutlined");
export const GridOnRounded = icon("AppstoreOutlined");
export const HomeOutlined = icon("HomeOutlined");
export const ImageOutlined = icon("PictureOutlined");
export const InsertDriveFileOutlined = icon("FileOutlined");
export const KeyboardArrowUpRounded = icon("UpOutlined");
export const KeyboardReturnRounded = icon("EnterOutlined");
export const LibraryAddOutlined = icon("AppstoreAddOutlined");
export const LibraryBooksOutlined = icon("BookOutlined");
export const LockOutlined = icon("LockOutlined");
export const LockResetRounded = icon("SafetyCertificateOutlined");
export const LockRounded = icon("LockOutlined");
export const LogoutOutlined = icon("LogoutOutlined");
export const LogoutRounded = icon("LogoutOutlined");
export const MeetingRoomRounded = icon("EnterOutlined");
export const MenuBookOutlined = icon("BookOutlined");
export const MenuBookRounded = icon("BookOutlined");
export const MenuRounded = icon("MenuOutlined");
export const MoreVert = icon("MoreOutlined");
export const NavigateBeforeRounded = icon("LeftOutlined");
export const NavigateNextRounded = icon("RightOutlined");
export const NoteAddOutlined = icon("FileAddOutlined");
export const NotesOutlined = icon("FileTextOutlined");
export const PaletteOutlined = icon("BgColorsOutlined");
export const PeopleAltOutlined = icon("TeamOutlined");
export const PlayArrowRounded = icon("PlayCircleOutlined");
export const PublicOutlined = icon("GlobalOutlined");
export const RefreshRounded = icon("ReloadOutlined");
export const RemoveRounded = icon("MinusOutlined");
export const RestartAltOutlined = icon("UndoOutlined");
export const RestoreFromTrashOutlined = icon("RollbackOutlined");
export const ScheduleRounded = icon("ScheduleOutlined");
export const SearchRounded = icon("SearchOutlined");
export const SettingsBrightnessOutlined = icon("SunOutlined");
export const SettingsOutlined = icon("SettingOutlined");
export const StorageRounded = icon("DatabaseOutlined");
export const SyncRounded = icon("SyncOutlined");
export const ThreeDRotationOutlined = icon("RotateLeftOutlined");
export const TuneRounded = icon("SlidersOutlined");
export const UploadFileOutlined = icon("UploadOutlined");
export const VisibilityOffOutlined = icon("EyeInvisibleOutlined");
export const VisibilityOutlined = icon("EyeOutlined");
export const WarningAmberRounded = icon("WarningOutlined");
