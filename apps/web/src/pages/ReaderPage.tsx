import { HttpErrorPage, pageFailure } from "./HttpErrorPage";
import { usePermissions } from "../auth/permissions";
import { AiAssistantButton } from "../features/ai/AiAssistant";
import { EmptyState } from "../ui/empty-state";
import type { IndependentReaderSource } from "../components/readers/independent-reader-source";
import { registerSessionSaver } from "../auth/session-save";
import { BookmarkRounded } from "@/ui/icons";
import { IconButton } from "@/ui/buttons";
import { bookmarkIsVisible, bookmarkLabel, bookmarkTocIndex } from "../components/readers/reader-bookmarks";
import { AutoStoriesRounded } from "@/ui/icons";
import { CheckRounded } from "@/ui/icons";
import { FontDownloadRounded } from "@/ui/icons";
import { FormatBoldRounded } from "@/ui/icons";
import { FormatSizeRounded } from "@/ui/icons";
import { FormatUnderlinedRounded } from "@/ui/icons";
import { NavigateBeforeRounded } from "@/ui/icons";
import { NavigateNextRounded } from "@/ui/icons";
import { NoteAddOutlined } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { ButtonBase } from "@/ui/buttons";
import { Chip } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { Dialog } from "@/ui/overlays";
import { DialogActions } from "@/ui/overlays";
import { DialogContent } from "@/ui/overlays";
import { DialogTitle } from "@/ui/overlays";
import { Divider } from "@/ui/feedback";
import { Drawer } from "@/ui/overlays";
import { List } from "@/ui/primitives";
import { ListItemButton } from "@/ui/primitives";
import { ListItemText } from "@/ui/primitives";
import { Menu } from "@/ui/primitives";
import { MenuItem } from "@/ui/primitives";
import { Popover } from "@/ui/primitives";
import { Slider } from "@/ui/forms";
import { Snackbar } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Switch } from "@/ui/forms";
import { TextField } from "@/ui/forms";
import { Tooltip } from "@/ui/feedback";
import { Typography } from "@/ui/primitives";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { readReferenceReaderState } from './reference-library-view';
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { READER_SHELL_HEIGHT, readerShellHeight } from "../components/readers/reader-layout";
import { PageTurnShade } from "../components/readers/PageTurnShade";
import { ReaderTopBar } from "../components/readers/ReaderTopBar";
import { isEditableReaderTarget, isReaderSwipe } from "../components/readers/reader-navigation";
import { readerSelectionFromRect, type ReaderSelection, type TocItem } from "../components/readers/types";
import { useReaderPageLayout } from "../components/readers/use-reader-page-layout";
import { useReaderVisibleHeight } from "../components/readers/use-reader-visible-height";
import { usePageTurnTransition } from "../components/readers/use-page-turn-transition";
import { readerWidthSx } from "../components/PageHeader";
import { demoChapter } from "../data/demo";
import { annotationColorHex, highlightColorPresets, readerHighlightStyle, type AnnotationTextTheme } from "../domain/annotation-colors";
import type { Annotation, AnnotationStyle, Book, DisplayBook, HighlightColor } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { useBookKinTheme } from "../theme/BookKinThemeProvider";
import { bookKinThemeOptions } from "../theme/theme";
import { DEFAULT_READER_SETTINGS, PRESET_READER_FONTS, readReaderSettings, readerFontFamily, type ReaderSettings, type ReaderTheme } from "../components/readers/reader-fonts";

const EpubDocumentReader = lazy(() => import("../components/readers/EpubDocumentReader"));
const PdfDocumentReader = lazy(() => import("../components/readers/PdfDocumentReader"));

function isPrivateBook(book: Book | DisplayBook): book is Book {
  return "progress" in book;
}

export function ReaderPage() {
  const { bookId } = useParams();
  return <ReaderWorkspace key={bookId} />;
}

// 文章与书籍共享完整阅读界面，独立来源只注入内容和持久化。
/** Books and independent content share one reader UI and inject their own persistence. */
export function ReaderWorkspace({ source }: { source?: IndependentReaderSource }) {
  const { bookId: routeBookId = "" } = useParams();
  const bookId = source?.id ?? routeBookId;
  const { user } = useAuth();
  const { can } = usePermissions();
  const canAnnotate = Boolean(source) || can("reader.annotate");
  const { mode: readerTheme, setMode: setBookKinTheme } = useBookKinTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const readerLocation = useLocation();
  const libraryReturnState = user ? readReferenceReaderState(readerLocation.state) : null;
  const returnToLibrary = () => source ? source.onBack() : libraryReturnState
    ? navigate('/virtual-library', {state: libraryReturnState})
    : navigate(user ? "/library/all" : "/library");
  const annotationTarget = source ? source.initialLocator : searchParams.get("locator") ?? undefined;
  const queryClient = useQueryClient();
  // 访客走公开书籍接口且不读取私有批注；认证缓存隔离由 AuthProvider 管理。
  // Guests use public book APIs without private annotations; AuthProvider owns identity-related cache isolation.
  const guest = !user;
  const bookQuery = useQuery<Book | DisplayBook>({ queryKey: ["reader-book", bookId, guest], queryFn: async () => guest ? api.getDisplayBook(bookId) : api.getBook(bookId), enabled: Boolean(bookId) && !source });
  const annotationQueryKey = ["annotations", bookId] as const;
  const annotationsQuery = useQuery({ queryKey: annotationQueryKey, queryFn: () => api.listAnnotations(bookId), enabled: Boolean(user) && !source });
  const readerSettingsKey = `bookkin-reader-settings:${user?.id ?? "anonymous"}`;
  const readerFontsQuery = useQuery({ queryKey: ["reader-fonts"], queryFn: api.listReaderFonts, staleTime: 5 * 60_000, enabled: Boolean(user) });
  const availableFonts = readerFontsQuery.data ?? PRESET_READER_FONTS;
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(() => readReaderSettings(readerSettingsKey));
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [targetRevision, setTargetRevision] = useState(0);
  const jumpTo = (locator?: string) => { if (!locator) return; setReaderTarget(locator); setTargetRevision(value => value + 1); };
  const [readerTarget, setReaderTarget] = useState<string | undefined>(annotationTarget);
  const [selection, setSelection] = useState<ReaderSelection | null>(() => {
    const previewParams = new URLSearchParams(window.location.search);
    if (!import.meta.env.DEV || previewParams.get("preview") !== "annotation-toolbar") return null;
    const previewX = Number(previewParams.get("previewX"));
    const previewY = Number(previewParams.get("previewY"));
    return {
      quote: "河面先暗了一层",
      locator: "epubcfi(/6/14!/4/2)",
      x: Number.isFinite(previewX) && previewX > 0 ? previewX : window.innerWidth / 2,
      y: Number.isFinite(previewY) && previewY > 0 ? previewY : window.innerWidth < tokens.layout.breakpointMobile ? 289 : 315,
      placement: "ABOVE",
    };
  });
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [highlightColor, setHighlightColor] = useState<HighlightColor>("YELLOW");
  const [annotationBusy, setAnnotationBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [currentLocator, setCurrentLocator] = useState(source ? source.initialLocator ?? "" : api.isDemo ? "epubcfi(/6/14!/4/2)" : "");
  const [visibleEndLocator, setVisibleEndLocator] = useState<string | undefined>();
  const [readerProgress, setReaderProgress] = useState<number | null>(null);
  const visibleHeight = useReaderVisibleHeight();
  const currentFont = availableFonts.find((font) => font.id === readerSettings.fontId && font.status === "ENABLED") ?? PRESET_READER_FONTS[0];
  const currentTheme = bookKinThemeOptions[readerTheme].reader;
  const fontSize = readerSettings.fontSize;
  const fontFamily = readerFontFamily(currentFont);
  const bookAnnotations = useMemo(() => user ? (source?.annotations ?? annotationsQuery.data ?? []).filter((item) => item.bookId === bookId) : [], [source?.annotations, annotationsQuery.data, bookId, user]);
  const annotations = useMemo(() => bookAnnotations.filter((item) => item.type !== "BOOKMARK"), [bookAnnotations]);
  const bookmarks = useMemo(() => bookAnnotations.filter((item): item is Annotation & { locator: string } => item.type === "BOOKMARK" && Boolean(item.locator)), [bookAnnotations]);
  const bookmark = bookmarks.find(item => bookmarkIsVisible(item.locator, currentLocator, visibleEndLocator));
  const bookmarkSections = bookmarks.map(item => bookmarkTocIndex(item.locator, tocItems));
  useReadingTimeTracking(bookId, !source && bookQuery.isSuccess && Boolean(user));
  const readerDocument = source ?? bookQuery.data;
  const demo = !source && api.isDemo;
  const notesTitle = source ? guest ? "文章信息" : "阅文札记" : "本书笔记";
  const noteDraftKey = user && bookId ? `bookkin-${source ? "article-note-draft" : "note-draft"}:${user.id}:${bookId}` : undefined;

  useEffect(() => {
    if (!readerFontsQuery.isSuccess) return;
    const validFont = availableFonts.some((font) => font.id === readerSettings.fontId && font.status === "ENABLED");
    if (!validFont) setReaderSettings((current) => ({ ...current, fontId: DEFAULT_READER_SETTINGS.fontId }));
  }, [availableFonts, readerFontsQuery.isSuccess, readerSettings.fontId]);

  useEffect(() => {
    localStorage.setItem(readerSettingsKey, JSON.stringify({ ...readerSettings, theme: readerTheme }));
  }, [readerSettings, readerSettingsKey, readerTheme]);

  useEffect(() => {
    if(!noteDraftKey) return;
    const key=noteDraftKey;
    try { const draft=JSON.parse(localStorage.getItem(key) ?? "null"); if(draft?.selection) {setNote(draft.note ?? "");setSelection(draft.selection);setNoteComposerOpen(Boolean(draft.note));} } catch { /* 忽略损坏的本地草稿。 */ /* Ignore damaged local drafts. */ }
  },[noteDraftKey]);
  useEffect(() => {
    if(noteDraftKey && selection) localStorage.setItem(noteDraftKey,JSON.stringify({note,selection}));
  },[noteDraftKey,noteComposerOpen,note,selection]);
  const handleReaderSelection = useCallback((nextSelection: ReaderSelection) => {
    if (!user) return;
    setSelection(nextSelection);
    setNoteComposerOpen(false);
    setNote("");
  }, [user]);
  const handleNavigation = useCallback((items: TocItem[]) => setTocItems(items), []);
  const independentPosition = source?.onPosition;
  const handlePosition = useCallback((locator: string, progress: number, endLocator?: string) => {
    setCurrentLocator(locator);
    setVisibleEndLocator(endLocator);
    setReaderProgress(progress);
    independentPosition?.(locator, progress);
  }, [independentPosition]);
  useEffect(() => setReaderTarget(annotationTarget), [annotationTarget]);

  const captureSelection = () => {
    const nativeSelection = window.getSelection();
    const quote = nativeSelection?.toString().trim() ?? "";
    if (!quote || quote.length > 600) return;
    const range = nativeSelection?.rangeCount ? nativeSelection.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();
    if (rect) {
      setSelection(readerSelectionFromRect({ quote, locator: currentLocator, rect }));
      setNoteComposerOpen(false);
      setNote("");
    }
  };

  const closeSelection = () => {
    if(noteDraftKey) localStorage.removeItem(noteDraftKey);
    setSelection(null);
    setNoteComposerOpen(false);
    setNote("");
    window.getSelection()?.removeAllRanges();
  };

  const saveAnnotation = async (style: AnnotationStyle, withNote = false, color = highlightColor) => {
    if (!canAnnotate || !user || !selection || !readerDocument || annotationBusy) return;
    setAnnotationBusy(true);
    setNotice("");
    try {
      const draft = {
        bookId,
        bookTitle: readerDocument.title,
        type: withNote ? "NOTE" as const : "HIGHLIGHT" as const,
        quote: selection.quote,
        note: withNote ? note.trim() : "",
        locator: selection.locator,
        style,
        color,
      };
      const saved = source ? await source.createAnnotation(draft) : await api.createAnnotation(draft);
      if (!source) queryClient.setQueryData(annotationQueryKey, (current: unknown) => [saved, ...(Array.isArray(current) ? current : [])]);
      closeSelection();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "批注同步失败");
    } finally {
      setAnnotationBusy(false);
    }
  };

  const removeAnnotation = async (id: string) => {
    if (!user) return;
    if (source) await source.deleteAnnotation(id);
    else {
      await api.deleteAnnotation(id);
      queryClient.setQueryData(annotationQueryKey, (current: unknown) => Array.isArray(current)
        ? current.filter((item) => typeof item !== "object" || item === null || !("id" in item) || item.id !== id)
        : []);
    }
  };
  const removeFromNotes = async (id: string) => {
    try { await removeAnnotation(id); setNotice("批注已删除"); }
    catch (error) { setNotice(error instanceof Error ? error.message : "批注删除失败"); }
  };

  const toggleBookmark = async () => {
    if (!canAnnotate || !user || !readerDocument || bookmarkBusy || (!bookmark && !currentLocator)) return;
    setBookmarkBusy(true);
    try {
      if (bookmark) {
        await removeAnnotation(bookmark.id);
        setNotice("书签已移除");
      } else {
        const draft = {
          bookId,
          bookTitle: readerDocument.title,
          type: "BOOKMARK" as const,
          quote: "",
          note: "",
          locator: currentLocator,
          style: "HIGHLIGHT" as const,
          color: "GOLD" as const,
        };
        const saved = source ? await source.createAnnotation(draft) : await api.createAnnotation(draft);
        if (!source) queryClient.setQueryData(annotationQueryKey, (current: unknown) => [saved, ...(Array.isArray(current) ? current : [])]);
        setNotice("本页已加入书签并同步");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "书签同步失败");
    } finally {
      setBookmarkBusy(false);
    }
  };

  if (!source && bookQuery.isPending) return <Stack spacing={2} sx={{ minHeight: READER_SHELL_HEIGHT, alignItems: "center", justifyContent: "center" }}><CircularProgress /><Typography color="text.secondary">正在展开书页…</Typography></Stack>;
  if (!source && (bookQuery.isError || !bookQuery.data)) return <HttpErrorPage failure={pageFailure(bookQuery.error)} title="无法打开这本书" actions={<><Button onClick={() => void bookQuery.refetch()}>重试</Button><Button onClick={returnToLibrary}>返回书库</Button></>} />;
  const book = readerDocument;
  if (!book) return null;
  if (!book.format) return <Stack spacing={2} sx={{ minHeight: READER_SHELL_HEIGHT, alignItems: "center", justifyContent: "center" }}><Alert severity="info">这本展示书目暂时没有可用文件</Alert><Button onClick={returnToLibrary}>返回书架</Button></Stack>;
  const privateBook = !source && bookQuery.data && isPrivateBook(bookQuery.data) ? bookQuery.data : undefined;
  const savedProgress = source?.progress ?? (privateBook ? privateBook.progress / 100 : 0);
  const progressPercent = source ? Math.round((readerProgress ?? savedProgress) * 100) : privateBook ? (demo ? savedProgress * 100 : Math.round((readerProgress ?? savedProgress) * 100)) : 0;
  const readerSubtitle = `${book.author} · ${privateBook && demo ? "第七章" : `${source?.label ?? book.format} · ${guest ? "只读阅读" : `已读 ${progressPercent}%`}`}`;

  return (
    <Box data-reader-visible-height={visibleHeight || undefined} sx={{ height: readerShellHeight(visibleHeight), minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "background.default", color: "text.primary", transition: "background-color 180ms ease" }}>
      <ReaderTopBar
        title={book.title}
        subtitle={readerSubtitle}
        format={source ? "ARTICLE" : book.format}
        notesLabel={notesTitle}
        notesAvailable={Boolean(source) || !guest}
        progressPercent={progressPercent}
        tableOfContentsAvailable={!demo || bookmarks.length > 0}
        bookmarked={Boolean(bookmark)}
        bookmarkBusy={bookmarkBusy || !currentLocator || (!source && annotationsQuery.isPending)}
        privateActions={!guest && canAnnotate}
        onBack={returnToLibrary}
        backLabel={source?.backLabel ?? (libraryReturnState ? "返回书楼漫游" : user ? "返回全部书籍" : "返回书库")}
        onOpenTableOfContents={() => setTocOpen(true)}
        onToggleBookmark={() => void toggleBookmark()}
        onOpenSettings={(event: any) => setSettingsAnchor(event.currentTarget)}
        onOpenNotes={() => setNotesOpen(true)}
        assistant={!guest && can(source ? "articles.view" : "reader.read") ? <AiAssistantButton source={source ? "ARTICLE" : "BOOK"} id={bookId} /> : undefined}
      />

      {source?.error && <Alert severity="error">{source.error}</Alert>}
      <Box sx={{ position: "relative", flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}>
        {!demo ? (
          <Suspense fallback={<Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center" }}><CircularProgress /></Stack>}>
            {book.format === "PDF"
              ? <PdfDocumentReader bookId={bookId} annotations={annotations} theme={currentTheme} fontSize={fontSize} fontFamily={fontFamily} pageTurnEnabled={readerSettings.pageTurnEnabled} fontSourceUrl={!guest && currentFont.source === "CUSTOM" ? `/api/v1/reader-fonts/${currentFont.id}/content` : undefined} contentUrl={source?.contentUrl ?? (guest ? `/api/v1/display-books/${bookId}/content` : undefined)} readOnly={Boolean(source) || guest} target={readerTarget} targetRevision={targetRevision} onNavigation={handleNavigation} onSelect={handleReaderSelection} onPosition={handlePosition} />
              : <EpubDocumentReader flow={source?.flow} contentLabel={source?.label} bookId={bookId} annotations={annotations} theme={currentTheme} fontSize={fontSize} fontFamily={fontFamily} pageTurnEnabled={readerSettings.pageTurnEnabled} fontSourceUrl={!guest && currentFont.source === "CUSTOM" ? `/api/v1/reader-fonts/${currentFont.id}/content` : undefined} contentUrl={source?.contentUrl ?? (guest ? `/api/v1/display-books/${bookId}/content` : undefined)} readOnly={Boolean(source) || guest} target={readerTarget} targetRevision={targetRevision} onNavigation={handleNavigation} onSelect={handleReaderSelection} onPosition={handlePosition} />}
          </Suspense>
        ) : <DemoPagedSurface bookTitle={book.title} format={book.format} theme={currentTheme} night={readerTheme === "NIGHT"} fontFamily={fontFamily} fontSize={fontSize} pageTurnEnabled={readerSettings.pageTurnEnabled} paragraphs={demoChapter} annotations={annotations} onMouseUp={captureSelection} />}
      </Box>

      <Popover
        open={Boolean(canAnnotate && user && selection) && !noteComposerOpen}
        onClose={closeSelection}
        anchorReference="anchorPosition"
        anchorPosition={selection ? { left: Math.round(selection.x), top: Math.max(12, Math.round(selection.y)) } : undefined}
        transformOrigin={{ vertical: selection?.placement === "BELOW" ? "top" : "bottom", horizontal: "center" }}
        marginThreshold={8}
        slotProps={{ paper: { sx: { bgcolor: currentTheme.background, color: currentTheme.foreground, border: `1px solid ${readerTheme === "NIGHT" ? "rgba(255,255,255,.14)" : "rgba(42,39,34,.12)"}` } } }}
      >
        <Stack role="toolbar" aria-label="批注工具" sx={{ p: 0.5 }}>
          <Stack direction="row">
            <AnnotationToolButton label="高亮＋笔记" icon={<NoteAddOutlined fontSize="small" />} disabled={annotationBusy} onClick={() => setNoteComposerOpen(true)} />
            <AnnotationToolButton label="下划线" icon={<FormatUnderlinedRounded fontSize="small" />} disabled={annotationBusy} onClick={() => void saveAnnotation("UNDERLINE")} />
            <AnnotationToolButton label="加粗" icon={<FormatBoldRounded fontSize="small" />} disabled={annotationBusy} onClick={() => void saveAnnotation("BOLD")} />
          </Stack>
          <Divider sx={{ my: 0 }} />
          <AnnotationColorSwatches
            value={highlightColor}
            onChange={(color) => {
              setHighlightColor(color);
              void saveAnnotation("HIGHLIGHT", false, color);
            }}
            disabled={annotationBusy}
            applyImmediately
          />
        </Stack>
      </Popover>

      <Dialog
        open={Boolean(canAnnotate && user && selection) && noteComposerOpen}
        onClose={() => { setNoteComposerOpen(false); setNote(""); }}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { bgcolor: currentTheme.background, color: currentTheme.foreground } } }}
      >
        <DialogTitle sx={{ pb: 1 }}>高亮并写笔记</DialogTitle>
        <DialogContent>
          <Typography component="div" variant="body2" sx={{ mb: 2, color: currentTheme.foreground, fontFamily: tokens.typography.fontFamily.display, maxHeight: 86, overflow: "auto" }}><Box component="span" sx={{ ...readerHighlightStyle(highlightColor, currentTheme), borderRadius: "var(--radius-md)", boxDecorationBreak: "clone" }}>“{selection?.quote}”</Box></Typography>
          <Typography variant="caption" color="text.secondary">高亮颜色</Typography>
          <AnnotationColorSwatches value={highlightColor} onChange={setHighlightColor} disabled={annotationBusy} compact />
          <TextField label="写下这段文字带来的想法" multiline minRows={3} fullWidth value={note} onChange={(event: any) => setNote(event.target.value)} autoFocus />
          {noteComposerOpen && can("notes.edit") && <AiAssistantButton source="NOTE_DRAFT" label="AI 整理笔记" draft={note} disabled={annotationBusy} onApply={setNote} />}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}><Button color="inherit" disabled={annotationBusy} onClick={() => { setNoteComposerOpen(false); setNote(""); }}>返回</Button><Button variant="contained" disabled={!note.trim() || annotationBusy} onClick={() => void saveAnnotation("HIGHLIGHT", true)}>保存笔记</Button></DialogActions>
      </Dialog>

      <Menu anchorEl={settingsAnchor} open={Boolean(settingsAnchor)} onClose={() => setSettingsAnchor(null)} slotProps={{ paper: { sx: { width: { xs: `calc(100vw - ${tokens.spacing[6]}px)`, sm: 360 }, maxWidth: `calc(100vw - ${tokens.spacing[6]}px)`, maxHeight: `calc(100dvh - ${tokens.spacing[8]}px)`, overflowY: "auto", overscrollBehavior: "contain", p: 1 } } }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}><FontDownloadRounded /><Typography sx={{ fontWeight: 700 }}>阅读设置</Typography></Stack>
          <Typography variant="caption" color="text.secondary">字体</Typography>
          <Stack spacing={0.5} sx={{ mt: 0.75 }}>
            {availableFonts.map((font) => <MenuItem key={font.id} selected={readerSettings.fontId === font.id} onClick={() => setReaderSettings((current) => ({ ...current, fontId: font.id }))} sx={{ borderRadius: 1.5, display: "block", py: 1 }}>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}><Typography sx={{ fontFamily: readerFontFamily(font), fontSize: tokens.typography.fontSize.titleSm }}>{font.displayName}</Typography><Chip size="small" variant="outlined" label={font.kind === "SERIF" ? "衬线" : "无衬线"} sx={{ ml: "auto" }} />{readerSettings.fontId === font.id && <CheckRounded fontSize="small" color="primary" />}</Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, fontFamily: readerFontFamily(font) }}>在正文中预览这款字体</Typography>
            </MenuItem>)}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1.5, mb: 1 }}><FormatSizeRounded /><Typography sx={{ fontWeight: 700 }}>字号</Typography><Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>{fontSize}px</Typography></Stack>
          <Slider min={16} max={28} step={1} value={fontSize} onChange={(_: any, value: any) => setReaderSettings((current) => ({ ...current, fontSize: value as number }))} valueLabelDisplay="auto" />
          {source?.flow !== "scrolled-doc" && <Stack direction="row" sx={{ alignItems: "center", gap: 1.25, mt: 1.5 }}>
            <AutoStoriesRounded />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>翻页效果</Typography>
              <Typography variant="caption" color="text.secondary">
                {readerSettings.pageTurnEnabled ? "仅在移动端模拟纸张翻动" : "关闭后直接切换页面"}
              </Typography>
            </Box>
            <Switch
              checked={readerSettings.pageTurnEnabled}
              onChange={(event: any) => setReaderSettings((current) => ({ ...current, pageTurnEnabled: event.target.checked }))}
              slotProps={{ input: { "aria-label": "启用翻页效果" } }}
              sx={{ ml: "auto" }}
            />
          </Stack>}
        </Box>
        <Divider />
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 1.5, display: "block" }}>阅读主题</Typography>
        {(Object.keys(bookKinThemeOptions) as ReaderTheme[]).map((key) => <MenuItem key={key} selected={readerTheme === key} onClick={() => setBookKinTheme(key)}><Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: bookKinThemeOptions[key].reader.background, border: 1, borderColor: "divider", mr: 1.5 }} />{bookKinThemeOptions[key].label}{readerTheme === key && <CheckRounded sx={{ ml: "auto" }} />}</MenuItem>)}
      </Menu>

      <Drawer anchor="right" title={notesTitle} closeLabel={`关闭${notesTitle}`} open={notesOpen} onClose={() => setNotesOpen(false)} slotProps={{ paper: { sx: { width: { xs: `calc(100vw - ${tokens.spacing[6]}px)`, sm: 390 }, maxWidth: "100vw" } } }}>
        <Box role="complementary" sx={{ width: "100%", maxWidth: "100%", height: "100%", overflowY: "auto", overscrollBehavior: "contain", p: { xs: 2, sm: 3 } }}>
          {source?.extraActions && <Stack sx={{ mb: 3, gap: 1.5 }}>{source.extraActions}</Stack>}
          {!guest && <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>仅你可见 · {annotations.length} 条</Typography>}
          {guest ? null : annotations.length === 0 ? <EmptyState compact title="暂无批注" /> : <Stack divider={<Divider flexItem />} spacing={2}>
            {annotations.map((item) => <Box key={item.id} sx={{ pb: 2 }}>
              <Chip size="small" label={annotationLabel(item)} sx={{ mb: 1.25 }} />
              {item.quote && <Typography sx={{ fontFamily: tokens.typography.fontFamily.display }}><Box component="span" sx={{ ...(item.style === "HIGHLIGHT" ? readerHighlightStyle(item.color, currentTheme) : {}), borderRadius: "var(--radius-md)", boxDecorationBreak: "clone" }}>“{item.quote}”</Box></Typography>}
              {item.note && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{item.note}</Typography>}
              <Stack direction="row" sx={{ mt: 1, gap: 1 }}>
                <Button size="small" disabled={!item.locator} onClick={() => { jumpTo(item.locator); setNotesOpen(false); }}>返回原文</Button>
                {canAnnotate && <Button size="small" color="error" onClick={() => void removeFromNotes(item.id)}>删除批注</Button>}
              </Stack>
            </Box>)}
          </Stack>}
        </Box>
      </Drawer>
      <Drawer anchor="left" title="目录" closeLabel="关闭目录" open={tocOpen} onClose={() => setTocOpen(false)} slotProps={{ paper: { sx: { width: { xs: `calc(100vw - ${tokens.spacing[6]}px)`, sm: 360 }, maxWidth: "100vw" } } }}>
        <Box role="navigation" aria-label={source ? "文章目录" : "书籍目录"} sx={{ width: "100%", maxWidth: "100%", height: "100%", overflowY: "auto", overscrollBehavior: "contain", p: 0 }}>
          {tocItems.length === 0 && bookmarks.length === 0 && <EmptyState compact title="暂无目录或书签" />}
          <List sx={{ p: 0 }}>
            {tocItems.map((item, index) => <Box key={`${item.href}-${index}`} sx={{ display: "flex", alignItems: "center" }}>
              <ListItemButton onClick={() => { jumpTo(item.href); setTocOpen(false); }} sx={{ flex: 1, minWidth: 0, pl: { xs: 2 + Math.min(item.depth, 3) * 2, sm: 3 + Math.min(item.depth, 3) * 2 }, pr: { xs: 2, sm: 3 } }}><ListItemText primary={item.label} /></ListItemButton>
              {bookmarks.map((saved, bookmarkIndex) => bookmarkSections[bookmarkIndex] === index && <Tooltip key={saved.id} title={`跳转书签：${item.label}`}><IconButton aria-label={`跳转书签：${item.label}（${bookmarkIndex + 1}）`} color="primary" onClick={() => { jumpTo(saved.locator); setTocOpen(false); }}><BookmarkRounded /></IconButton></Tooltip>)}
            </Box>)}
            {bookmarks.map((saved, index) => bookmarkSections[index] < 0 && <ListItemButton key={saved.id} onClick={() => { jumpTo(saved.locator); setTocOpen(false); }}>
              <BookmarkRounded color="primary" /><ListItemText primary={bookmarkLabel(saved.locator, index)} />
            </ListItemButton>)}
          </List>
        </Box>
      </Drawer>
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice("")} message={notice} />
    </Box>
  );
}

// 仅为已登录且书籍加载成功的阅读累计时间；离开时提交最多 60 秒的本次增量。
// Track time only for signed-in readers after successful book load; leaving flushes the current delta capped at 60 seconds.
function useReadingTimeTracking(bookId: string, enabled: boolean) {
  const lastRecordedAt = useRef(Date.now());

  useEffect(() => {
    if (!enabled || !bookId) return;
    lastRecordedAt.current = Date.now();
    const flush = (includeElapsedBeforeLeaving = false) => {
      const now = Date.now();
      const elapsedSeconds = Math.min(60, Math.floor((now - lastRecordedAt.current) / 1000));
      const active = includeElapsedBeforeLeaving || (document.visibilityState === "visible" && document.hasFocus());
      lastRecordedAt.current = now;
      if (active && elapsedSeconds > 0) return api.recordReadingTime(bookId, elapsedSeconds).catch(() => undefined);
    };
    const unregister = registerSessionSaver(() => flush(true));
    const interval = window.setInterval(() => { void flush(); }, 30_000);
    const handleBlur = () => flush(true);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flush(true);
      else lastRecordedAt.current = Date.now();
    };
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      unregister();
      window.clearInterval(interval);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
      flush(true);
    };
  }, [bookId, enabled]);
}

function AnnotationToolButton({ label, icon, disabled, onClick }: { label: string; icon: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <ButtonBase className="reader-annotation-action" aria-label={label} disabled={disabled} onClick={onClick} sx={{ minWidth: { xs: 68, sm: 76 }, minHeight: 52, px: 1, borderRadius: 1.5, flexDirection: "column", gap: 0.375, color: "inherit", "&:hover": { bgcolor: "action.hover" }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 } }}>
      {icon}
      <Typography component="span" variant="caption" sx={{ lineHeight: 1.2, whiteSpace: "nowrap" }}>{label}</Typography>
    </ButtonBase>
  );
}

function AnnotationColorSwatches({ value, onChange, disabled, compact = false, applyImmediately = false }: { value: HighlightColor; onChange: (color: HighlightColor) => void; disabled: boolean; compact?: boolean; applyImmediately?: boolean }) {
  return (
    <Stack direction="row" spacing={compact ? 1 : 0.75} sx={{ alignItems: "center", justifyContent: compact ? "flex-start" : "center", px: compact ? 0 : 1, py: compact ? 1.25 : 1 }}>
      {!compact && <Typography variant="caption" color="text.secondary" sx={{ mr: 0.25 }}>{applyImmediately ? "直接高亮" : "颜色"}</Typography>}
      {highlightColorPresets.map((preset) => (
        <Tooltip key={preset.value} title={applyImmediately ? `使用${preset.label}荧光笔高亮` : `${preset.label}荧光笔`}>
          <ButtonBase
            className="reader-annotation-swatch"
            aria-label={applyImmediately ? `使用${preset.label}荧光笔高亮` : `选择${preset.label}荧光笔`}
            aria-pressed={applyImmediately ? undefined : value === preset.value}
            disabled={disabled}
            onClick={() => onChange(preset.value)}
            sx={{
              width: compact ? 30 : 28,
              height: compact ? 30 : 28,
              borderRadius: "50%",
              bgcolor: preset.hex,
              border: "2px solid",
              borderColor: !applyImmediately && value === preset.value ? "text.primary" : "divider",
              boxShadow: !applyImmediately && value === preset.value ? `0 0 0 2px ${preset.hex}66` : "none",
              color: tokens.color.primitive.ink800,
              transition: "transform 120ms ease, border-color 120ms ease",
              "&:hover": { transform: "scale(1.08)" },
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
            }}
          >
            {!applyImmediately && value === preset.value && <CheckRounded sx={{ fontSize: 17 }} />}
          </ButtonBase>
        </Tooltip>
      ))}
    </Stack>
  );
}

function annotationStyleLabel(style: AnnotationStyle) {
  return ({ HIGHLIGHT: "高亮", UNDERLINE: "下划线", BOLD: "加粗" } satisfies Record<AnnotationStyle, string>)[style];
}

function annotationLabel(annotation: Annotation) {
  return annotation.type === "NOTE" ? "高亮笔记" : annotationStyleLabel(annotation.style);
}

function renderAnnotatedText(paragraph: string, annotations: Annotation[], theme: AnnotationTextTheme) {
  const ranges = annotations
    .filter((annotation) => annotation.quote && paragraph.includes(annotation.quote))
    .map((annotation) => ({ annotation, start: paragraph.indexOf(annotation.quote!), end: paragraph.indexOf(annotation.quote!) + annotation.quote!.length }))
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((range, index, all) => index === 0 || range.start >= all[index - 1].end);
  if (ranges.length === 0) return paragraph;

  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(({ annotation, start, end }) => {
    if (start > cursor) pieces.push(paragraph.slice(cursor, start));
    const style = annotation.style;
    pieces.push(
      <Box
        component="mark"
        key={annotation.id}
        data-highlight-color={annotation.color ?? "YELLOW"}
        sx={{
          ...(style === "HIGHLIGHT" ? readerHighlightStyle(annotation.color, theme) : { color: "inherit", background: "transparent" }),
          borderRadius: style === "HIGHLIGHT" ? "var(--radius-md)" : 0,
          fontWeight: style === "BOLD" ? 700 : "inherit",
          textDecoration: style === "UNDERLINE" ? "underline" : "none",
          textDecorationColor: style === "UNDERLINE" ? annotationColorHex(annotation.color) : undefined,
          textDecorationThickness: style === "UNDERLINE" ? "3px" : undefined,
          textUnderlineOffset: style === "UNDERLINE" ? "4px" : undefined,
          textDecorationSkipInk: style === "UNDERLINE" ? "none" : undefined,
          boxDecorationBreak: "clone",
        }}
      >
        {paragraph.slice(start, end)}
      </Box>,
    );
    cursor = end;
  });
  if (cursor < paragraph.length) pieces.push(paragraph.slice(cursor));
  return pieces;
}

function DemoPagedSurface({ bookTitle, format, theme, night, fontFamily, fontSize, pageTurnEnabled, paragraphs, annotations, onMouseUp }: { bookTitle: string; format: "EPUB" | "PDF"; theme: { background: string; foreground: string; muted: string }; night: boolean; fontFamily: string; fontSize: number; pageTurnEnabled: boolean; paragraphs: string[]; annotations: Annotation[]; onMouseUp: () => void }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const touchStartXRef = useRef<number | null>(null);
  const pageSurfaceRef = useRef<HTMLDivElement | null>(null);
  const pageLayout = useReaderPageLayout(pageSurfaceRef);
  const wideSpread = pageLayout?.spread ?? false;
  const columnWidth = pageLayout?.columnWidth ?? null;
  const columnGap = pageLayout?.columnGap ?? tokens.layout.readerPageGap;
  const pageStride = pageLayout?.pageStride ?? 0;
  const pagePadding = pageLayout?.pagePadding ?? tokens.spacing[5];
  const annotationRevision = useMemo(
    () => annotations.map((annotation) => `${annotation.id}:${annotation.updatedAt ?? annotation.createdAt}:${annotation.style}:${annotation.color ?? ""}`).join(","),
    [annotations],
  );
  const pageSnapshotKey = `${bookTitle}:${format}:${pageIndex}:${pageCount}:${wideSpread}:${theme.background}:${theme.foreground}:${fontSize}:${fontFamily}:${annotationRevision}`;
  const { turnPage, turning } = usePageTurnTransition(
    pageSurfaceRef,
    pageTurnEnabled,
    { spread: wideSpread, snapshotKey: pageSnapshotKey },
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || columnWidth === null) return;
    const measure = () => {
      const visibleColumns = wideSpread ? 2 : 1;
      const totalColumns = Math.max(1, Math.round((frame.scrollWidth + columnGap) / (columnWidth + columnGap)));
      const nextCount = Math.max(1, Math.ceil(totalColumns / visibleColumns));
      setPageCount(nextCount);
      setPageIndex((current) => Math.min(current, nextCount - 1));
    };
    const timer = window.setTimeout(measure, 0);
    return () => window.clearTimeout(timer);
  }, [columnGap, columnWidth, fontFamily, fontSize, pageLayout?.articleWidth, paragraphs, wideSpread]);

  const goPrevious = useCallback(() => {
    if (pageIndex > 0) void turnPage("PREVIOUS", () => setPageIndex((current) => Math.max(0, current - 1)));
  }, [pageIndex, turnPage]);
  const goNext = useCallback(() => {
    if (pageIndex < pageCount - 1) void turnPage("NEXT", () => setPageIndex((current) => Math.min(pageCount - 1, current + 1)));
  }, [pageCount, pageIndex, turnPage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableReaderTarget(event.target)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrevious]);

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (event: React.TouchEvent) => {
    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined || !isReaderSwipe(touchStartXRef.current, endX)) return;
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX !== null && endX < startX) goNext();
    else goPrevious();
  };

  return (
    <Stack className="reader-viewport" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} sx={{ height: "100%", minHeight: 0, overflow: "hidden", bgcolor: theme.background, color: theme.foreground }}>
      <Stack direction="row" sx={{ ...readerWidthSx, flex: `0 0 ${tokens.layout.readerControlHeight}px`, minHeight: tokens.layout.readerControlHeight, alignItems: "center", justifyContent: "center", gap: 1, overflowX: "auto", borderBottom: 1, borderColor: "divider" }}>
        <Button color="inherit" startIcon={<NavigateBeforeRounded />} disabled={turning || pageIndex <= 0} onClick={goPrevious}>上一页</Button>
        <Typography variant="body2" sx={{ minWidth: 0, flex: "1 1 auto", textAlign: "center", whiteSpace: "nowrap", color: theme.muted }}>第 {pageIndex + 1} / {pageCount} 页</Typography>
        <Button color="inherit" endIcon={<NavigateNextRounded />} disabled={turning || pageIndex >= pageCount - 1} onClick={goNext}>下一页</Button>
      </Stack>
      <Box ref={pageSurfaceRef} className="reader-page-turn-surface" data-reader-spread={wideSpread} sx={{ position: "relative", flex: "1 1 auto", height: "100%", minHeight: 0, ...readerWidthSx, overflow: "hidden", bgcolor: theme.background, backfaceVisibility: "hidden", transformStyle: "preserve-3d", willChange: turning ? "transform, opacity, filter, clip-path" : "auto" }}>
        <Box sx={{ height: "100%", width: pageLayout ? `${pageLayout.articleWidth}px` : "100%", maxWidth: "100%", mx: "auto", overflow: "hidden" }}>
        <Box ref={frameRef} component="article" className="reader-paged-text" aria-label={`${format} 阅读正文`} onMouseUp={onMouseUp} onTouchEnd={onMouseUp} sx={{ height: "100%", width: pageLayout ? `${pageLayout.articleWidth}px` : "100%", maxWidth: "100%", mx: "auto", overflow: "visible", transform: columnWidth === null ? `translateX(-${pageIndex * 100}%)` : `translateX(-${pageIndex * pageStride}px)`, transition: "none", columnCount: "auto", columnWidth: columnWidth === null ? "auto" : `${columnWidth}px`, columnGap: `${columnGap}px`, columnFill: "auto", direction: "ltr", writingMode: "horizontal-tb", textOrientation: "mixed", unicodeBidi: "normal", px: `${pagePadding}px`, pt: `${tokens.spacing[6]}px`, pb: `${tokens.spacing[6]}px`, fontFamily, fontSize, lineHeight: 1.95, color: theme.foreground, background: theme.background, "& > *": { breakInside: "auto" }, "& h1, & h2": { breakInside: "avoid" } }}>
          <Typography variant="overline" component="p" sx={{ color: theme.muted, letterSpacing: ".18em" }}>{format === "EPUB" ? "第七章" : bookTitle}</Typography>
          <Typography component="h1" variant="h2" color="inherit" sx={{ mt: 2, mb: 5, fontFamily: "inherit" }}>{format === "EPUB" ? "灯下" : "海岸与迁徙"}</Typography>
          {paragraphs.map((paragraph, index) => <Typography component="p" key={paragraph} sx={{ fontFamily: "inherit", fontSize: "inherit", lineHeight: 1.95, mb: "1.55em", textIndent: index === 0 ? 0 : "2em", "&::first-letter": index === 0 ? { float: "left", fontSize: "3.5em", lineHeight: 0.9, pr: 1.2, color: "primary.main" } : undefined }}>{renderAnnotatedText(paragraph, annotations, theme)}</Typography>)}
          <Divider sx={{ borderColor: night ? "rgba(255,255,255,.14)" : "divider", my: 5 }} />
          {format !== "PDF" && <Typography variant="caption" component="p" sx={{ textAlign: "center", color: theme.muted, breakInside: "avoid" }}>本章结束</Typography>}
        </Box>
        </Box>
        <PageTurnShade />
      </Box>
    </Stack>
  );
}
