import { Skeleton } from "@/ui";
import { AutoAwesomeOutlined } from "@/ui/icons";
import { BookmarkAddOutlined } from "@/ui/icons";
import { EditNoteRounded } from "@/ui/icons";
import { FilterListRounded } from "@/ui/icons";
import { DriveFileRenameOutlineRounded } from "@/ui/icons";
import { KeyboardArrowUpRounded } from "@/ui/icons";
import { MenuBookRounded } from "@/ui/icons";
import { CloudUploadOutlined } from "@/ui/icons";
import { ScheduleRounded } from "@/ui/icons";
import { Alert } from "@/ui";
import { Box } from "@/ui";
import { Button } from "@/ui";
import { Chip } from "@/ui";
import { Dialog } from "@/ui";
import { DialogActions } from "@/ui";
import { DialogContent } from "@/ui";
import { Divider } from "@/ui";
import { Fab } from "@/ui";
import { FormControl } from "@/ui";
import { MenuItem } from "@/ui";
import { Select } from "@/ui";
import { Snackbar } from "@/ui";
import { Stack } from "@/ui";
import { Tooltip } from "@/ui";
import { Typography } from "@/ui";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { BookCard } from "../components/BookCard";
import { BatchRenameDialog } from "../components/BatchRenameDialog";
import { AddToBooklistDialog } from "../components/AddToBooklistDialog";
import { BookUploadDialog } from "../components/BookUploadDialog";
import { FileOperationDialog } from "../components/FileOperationDialog";
import { MetadataDialog } from "../components/MetadataDialog";
import { OverviewCardHeader } from "../components/OverviewCardHeader";
import { OverviewEmptyState } from "../components/OverviewEmptyState";
import { flattenUniquePaginatedItems, PaginatedItemReveal } from "../components/PaginatedItemReveal";
import { PageContainer } from "../components/PageHeader";
import { ReadingStatsPanel } from "../components/ReadingStatsPanel";
import { RecentAnnotationsPanel } from "../components/RecentAnnotationsPanel";
import type { Book, FileOperationType } from "../domain/types";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { tokens } from "../theme/generated-tokens";

type SortKey = "recent" | "title" | "author";

export function LibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [operation, setOperation] = useState<{ book: Book; type: FileOperationType } | null>(null);
  const [metadataBook, setMetadataBook] = useState<Book | null>(null);
  const [booklistBook, setBooklistBook] = useState<Book | null>(null);
  const [batchRenameOpen, setBatchRenameOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [notice, setNotice] = useState("");
  const query = params.get("q")?.trim().toLocaleLowerCase("zh-CN") ?? "";
  const deferredQuery = useDeferredValue(query);
  const format = params.get("format") ?? "ALL";
  const sort = (params.get("sort") ?? "recent") as SortKey;
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";
  const booksQuery = useInfiniteQuery({
    queryKey: ["books", deferredQuery, format, sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.listBooks({
      q: deferredQuery || undefined,
      format: format === "ALL" ? undefined : format as "EPUB" | "PDF",
      sort,
      cursor: pageParam,
      limit: 36,
      signal,
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: 15_000,
  });
  const readingStatsQuery = useQuery({ queryKey: ["reading-stats", "weekly"], queryFn: api.getWeeklyReadingStats });
  useEffect(() => {
    const updateBackToTopVisibility = () => {
      const nextVisible = window.scrollY > tokens.spacing[20];
      setShowBackToTop((currentVisible) => currentVisible === nextVisible ? currentVisible : nextVisible);
    };

    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTopVisibility);
  }, []);
  const loadedBookEntries = useMemo(() => flattenUniquePaginatedItems(booksQuery.data?.pages), [booksQuery.data]);
  const loadedBooks = useMemo(() => loadedBookEntries.map(({ item }) => item), [loadedBookEntries]);

  const loadNextPage = useCallback(() => {
    if (booksQuery.hasNextPage && !booksQuery.isFetchingNextPage) void booksQuery.fetchNextPage();
  }, [booksQuery.fetchNextPage, booksQuery.hasNextPage, booksQuery.isFetchingNextPage]);
  const { triggerRef, supported: automaticLoadingSupported } = useInfiniteScrollTrigger({
    enabled: Boolean(booksQuery.hasNextPage && !booksQuery.isFetchingNextPage && !booksQuery.isFetchNextPageError),
    onLoadMore: loadNextPage,
  });

  const bookEntries = useMemo(() => loadedBookEntries.filter(({ item }) => item.status === "AVAILABLE"), [loadedBookEntries]);
  const books = useMemo(() => bookEntries.map(({ item }) => item), [bookEntries]);

  const updateParam = (key: string, value: string, defaultValue?: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const reading = loadedBooks.find((book) => book.progress > 0);
  const featured = books[0] ?? reading;

  return (
    <>
      <PageContainer sx={{ pt: { xs: 3, md: 5 } }}>
        <Box
          component="section"
          aria-label="书库概览"
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "minmax(0, 1.18fr) minmax(0, 0.82fr)",
              lg: "minmax(0, 1.38fr) minmax(0, 0.62fr)",
            },
            // Keep the four overview cards on a shared two-row rhythm.  A
            // fixed token-derived track prevents the compact empty states
            // from collapsing while the featured cover and weekly chart set
            // the height of the upper row.
            gridAutoRows: `${tokens.spacing[24] * 3.5}px`,
            gap: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[6]}px` },
            mb: { xs: `${tokens.spacing[6]}px`, md: `${tokens.spacing[8]}px` },
            alignItems: "stretch",
          }}
        >
          {booksQuery.isPending ? Array.from({ length: 4 }, (_, index) => (
            <Box key={index} role="status" aria-label="正在加载书库概览" sx={{ p: 3, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.xl}px`, bgcolor: "background.paper" }}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Box>
          )) : <>
          {featured && (
            <>
              <Box
                component="article"
                aria-labelledby="featured-book-title"
                sx={{
                  minWidth: 0,
                  gridColumn: { sm: 1 },
                  gridRow: { sm: 1 },
                  display: "flex",
                  flexDirection: "column",
                  p: { xs: `${tokens.spacing[6]}px`, lg: `${tokens.spacing[8]}px` },
                  bgcolor: "background.paper",
                  border: 1,
                  borderColor: "divider",
                  borderRadius: `${tokens.radius.xl}px`,
                  overflow: "hidden",
                }}
              >
                <OverviewCardHeader id="featured-card-title" icon={<AutoAwesomeOutlined />}>本周新藏</OverviewCardHeader>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "minmax(0, 0.72fr) minmax(0, 1.28fr)", sm: "minmax(0, 0.68fr) minmax(0, 1.32fr)" },
                    gap: { xs: `${tokens.spacing[4]}px`, md: `${tokens.spacing[6]}px` },
                    flex: 1,
                    minHeight: 0,
                    mt: `${tokens.spacing[4]}px`,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0, minHeight: 0 }}>
                    <Box component="img" src={featured.coverUrl} alt={`${featured.title}封面`} loading="eager" decoding="async" fetchPriority="high" sx={{ display: "block", width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%", borderRadius: `${tokens.radius.lg}px` }} />
                  </Box>
                  <Stack sx={{ minWidth: 0, justifyContent: "center", alignItems: "flex-start" }}>
                    <Typography id="featured-book-title" variant="h4" component="h3">{featured.title}</Typography>
                    <Typography color="text.secondary" sx={{ mt: `${tokens.spacing[2]}px` }}>{featured.author}</Typography>
                    <Stack direction="row" sx={{ flexWrap: "wrap", gap: `${tokens.spacing[3]}px`, mt: `${tokens.spacing[5]}px` }}>
                      <Button variant="contained" startIcon={<MenuBookRounded />} onClick={() => navigate(`/reader/${featured.id}`)}>开始阅读</Button>
                    </Stack>
                  </Stack>
                </Box>
              </Box>

              <Box sx={{ minWidth: 0, gridColumn: { sm: 1 }, gridRow: { sm: 2 }, display: "flex", "& > *": { flex: 1 } }}>
                <RecentAnnotationsPanel embedded />
              </Box>
            </>
          )}

          <>
            <Box sx={{ minWidth: 0, gridColumn: { sm: 2 }, gridRow: { sm: 1 }, display: "flex", "& > *": { flex: 1 } }}>
              <ReadingStatsPanel stats={readingStatsQuery.data} loading={readingStatsQuery.isPending} error={readingStatsQuery.isError} />
            </Box>
            <Stack
              component="article"
              aria-labelledby="currently-reading-title"
              sx={{
                gridColumn: { sm: 2 },
                gridRow: { sm: 2 },
                justifyContent: "flex-start",
                p: { xs: `${tokens.spacing[6]}px`, lg: `${tokens.spacing[8]}px` },
                bgcolor: "secondary.dark",
                color: "common.white",
                borderRadius: `${tokens.radius.xl}px`,
              }}
            >
              <OverviewCardHeader id="reading-progress-card-title" icon={<MenuBookRounded />} inverse>阅读进度</OverviewCardHeader>
              {reading ? (
                <>
                  <Stack sx={{ minWidth: 0, flex: 1, gap: `${tokens.spacing[3]}px`, mt: `${tokens.spacing[4]}px` }}>
                    <Typography id="currently-reading-title" variant="h4">{reading.title}</Typography>
                    <Typography sx={{ opacity: 0.68 }}>{reading.author}</Typography>
                    <Box sx={{ mt: `${tokens.spacing[2]}px` }}>
                      <Box sx={{ height: `${tokens.spacing[1]}px`, bgcolor: "rgba(255,255,255,.18)", mb: `${tokens.spacing[2]}px`, borderRadius: `${tokens.radius.pill}px`, overflow: "hidden" }}>
                        <Box sx={{ width: `${reading.progress}%`, height: "100%", bgcolor: "primary.light" }} />
                      </Box>
                      <Stack direction="row" sx={{ justifyContent: "space-between", opacity: 0.64 }}>
                        <Typography variant="caption">已读 {reading.progress}%</Typography>
                        <Typography variant="caption">第 7 章</Typography>
                      </Stack>
                    </Box>
                  </Stack>
                  <Button
                    variant="contained"
                    onClick={() => navigate(`/reader/${reading.id}`)}
                    sx={{ mt: "auto", bgcolor: "background.paper", color: "text.primary", "&:hover": { bgcolor: "background.default" } }}
                  >
                    继续阅读
                  </Button>
                </>
              ) : (
                <OverviewEmptyState
                  titleId="currently-reading-title"
                  title="请开始阅读"
                  description="打开任意一本书后，阅读进度会显示在这里。"
                  inverse
                />
              )}
            </Stack>
          </>
          </>}
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "flex-end" }, gap: 2, mb: 3 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3">全部藏书</Typography>
            {query && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>找到 {books.length} 本相关藏书</Typography>}
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{
              width: { xs: "100%", md: "auto" },
              flexWrap: { xs: "nowrap", sm: "wrap" },
              alignItems: { xs: "stretch", sm: "center" },
            }}
          >
            {canManage && <Button variant="contained" startIcon={<CloudUploadOutlined />} onClick={() => setUploadOpen(true)} sx={{ whiteSpace: "nowrap" }}>上传书籍</Button>}
            {canManage && <Button variant="outlined" startIcon={<DriveFileRenameOutlineRounded />} onClick={() => setBatchRenameOpen(true)} sx={{ whiteSpace: "nowrap" }}>批量重命名</Button>}
            <FormControl size="small" sx={{ minWidth: 118 }}>
              <Select label="格式" value={format} onChange={(event: any) => updateParam("format", event.target.value, "ALL")} startAdornment={<FilterListRounded sx={{ mr: 1, color: "text.secondary" }} />}>
                <MenuItem value="ALL">全部格式</MenuItem>
                <MenuItem value="EPUB">EPUB</MenuItem>
                <MenuItem value="PDF">PDF</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 126 }}>
              <Select label="排序" value={sort} onChange={(event: any) => updateParam("sort", event.target.value, "recent")}>
                <MenuItem value="recent">最近入库</MenuItem>
                <MenuItem value="title">按书名</MenuItem>
                <MenuItem value="author">按作者</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>

        {booksQuery.isPending ? (
          <Box role="status" aria-label="正在加载藏书" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 3 }}>
            {Array.from({ length: 4 }, (_, index) => <Box key={index}><Box sx={{ aspectRatio: "2 / 3", bgcolor: "action.hover", borderRadius: `${tokens.radius.lg}px`, mb: 2 }} /><Skeleton active title={false} paragraph={{ rows: 2 }} /></Box>)}
          </Box>
        ) : booksQuery.isError && !booksQuery.data ? (
          <Alert severity="error">书库暂时无法读取，请检查 API 与 NAS 状态。</Alert>
        ) : books.length === 0 ? (
          <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center", py: 12 }}>
            <AutoAwesomeOutlined color="primary" sx={{ fontSize: 42 }} />
            <Typography variant="h4">没有找到匹配的书</Typography>
            <Typography color="text.secondary">试试作者、书名或标签，或者清除格式筛选。</Typography>
            <Button onClick={() => setParams({})}>清除筛选</Button>
          </Stack>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" }, gap: { xs: 2, sm: 3, md: 4 } }}>
            {bookEntries.map(({ item: book, pageIndex, itemIndex }) => (
              <PaginatedItemReveal key={book.id} animate={pageIndex > 0} order={itemIndex}>
                <BookCard
                  book={book}
                  onOpen={setSelectedBook}
                  onRead={(value) => navigate(`/reader/${value.id}`)}
                  onAddToBooklist={setBooklistBook}
                  onEditMetadata={canManage ? setMetadataBook : undefined}
                  onFileOperation={canManage ? (value, type) => setOperation({ book: value, type }) : undefined}
                />
              </PaginatedItemReveal>
            ))}
          </Box>
        )}
        {(booksQuery.hasNextPage || booksQuery.isFetchingNextPage) && !booksQuery.isFetchNextPageError && (
          <Stack ref={triggerRef} role="status" aria-live="polite" sx={{ minHeight: 96, alignItems: "center", justifyContent: "center", mt: 3 }}>
            {booksQuery.isFetchingNextPage ? (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", color: "text.secondary" }}>
                <Skeleton active title={false} paragraph={{ rows: 2 }} />
                <Typography variant="body2">正在展开更多藏书…</Typography>
              </Stack>
            ) : automaticLoadingSupported ? (
              <Typography variant="caption" color="text.disabled">继续向下浏览，将自动加载更多藏书</Typography>
            ) : (
              <Button variant="outlined" onClick={loadNextPage}>继续加载</Button>
            )}
          </Stack>
        )}
        {booksQuery.isFetchNextPageError && (
          <Alert
            severity="warning"
            sx={{ mt: 4 }}
            action={<Button color="inherit" onClick={() => void booksQuery.fetchNextPage()}>重新加载</Button>}
          >
            更多藏书加载失败，已经显示的书籍不受影响。
          </Alert>
        )}
        {!booksQuery.hasNextPage && books.length > 36 && (
          <Typography variant="caption" color="text.disabled" sx={{ display: "block", textAlign: "center", mt: 6 }}>已加载全部 {books.length} 本藏书</Typography>
        )}
      </PageContainer>

      <BookDetailsDialog
        book={selectedBook}
        canManage={canManage}
        onClose={() => setSelectedBook(null)}
        onRead={(book) => navigate(`/reader/${book.id}`)}
        onAddToBooklist={(book) => { setSelectedBook(null); setBooklistBook(book); }}
        onOperation={(book, type) => { setSelectedBook(null); setOperation({ book, type }); }}
        onEditMetadata={(book) => { setSelectedBook(null); setMetadataBook(book); }}
      />
      <AddToBooklistDialog
        open={Boolean(booklistBook)}
        bookId={booklistBook?.id ?? ""}
        bookTitle={booklistBook?.title ?? ""}
        onClose={() => setBooklistBook(null)}
        onCompleted={(message) => { setBooklistBook(null); setNotice(message); }}
      />
      <FileOperationDialog
        book={operation?.book ?? null}
        type={operation?.type ?? null}
        onClose={() => setOperation(null)}
        onCompleted={(result) => { setNotice(result.status === "SUCCEEDED" ? `任务已完成：${result.stage ?? result.status}` : "文件任务已提交，可在文件任务页查看进度"); void queryClient.invalidateQueries({ queryKey: ["books"] }); void queryClient.invalidateQueries({ queryKey: ["recycle-bin"] }); }}
      />
      <MetadataDialog
        book={metadataBook}
        onClose={() => setMetadataBook(null)}
        onSavedImmediately={setNotice}
        onSaveFailed={setNotice}
        onCompleted={(message) => { setNotice(message); void queryClient.invalidateQueries({ queryKey: ["books"] }); }}
      />
      <BatchRenameDialog open={batchRenameOpen} books={books} onClose={() => setBatchRenameOpen(false)} onCompleted={(message) => { setNotice(message); void queryClient.invalidateQueries({ queryKey: ["books"] }); }} />
      <BookUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCompleted={(message) => { setNotice(message); void queryClient.invalidateQueries({ queryKey: ["books"] }); }} />
      <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice("")} message={notice} />
      {showBackToTop && (
        <Tooltip title="回到顶部">
          <Fab
            color="primary"
            size="medium"
            aria-label="回到顶部"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            sx={{
              position: "fixed",
              right: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[6]}px` },
              bottom: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[6]}px` },
              zIndex: (theme: any) => theme.zIndex.fab,
              boxShadow: tokens.shadow.popover,
            }}
          >
            <KeyboardArrowUpRounded />
          </Fab>
        </Tooltip>
      )}
    </>
  );
}

function BookDetailsDialog({ book, canManage, onClose, onRead, onOperation, onEditMetadata, onAddToBooklist }: {
  book: Book | null;
  canManage: boolean;
  onClose: () => void;
  onRead: (book: Book) => void;
  onAddToBooklist: (book: Book) => void;
  onOperation: (book: Book, type: FileOperationType) => void;
  onEditMetadata: (book: Book) => void;
}) {
  return (
    <Dialog
      open={Boolean(book)}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      sx={{
        width: { xs: `calc(100% - ${tokens.spacing[4]}px)`, sm: `calc(100% - ${tokens.spacing[12]}px)` },
        maxWidth: { xs: "none", sm: `${tokens.layout.readingMax}px` },
        maxHeight: { xs: `calc(100% - ${tokens.spacing[4]}px)`, sm: `calc(100% - ${tokens.spacing[12]}px)` },
        m: { xs: `${tokens.spacing[2]}px`, sm: `${tokens.spacing[6]}px` },
      }}
    >
      {book && (
        <>
          <DialogContent sx={{ p: { xs: `${tokens.spacing[3]}px`, sm: `${tokens.spacing[6]}px`, md: `${tokens.spacing[8]}px` }, minHeight: 0 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px minmax(0, 1fr)", md: "210px minmax(0, 1fr)" }, gap: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[6]}px`, md: `${tokens.spacing[8]}px` }, minWidth: 0 }}>
              <Box component="img" src={book.coverUrl} alt={`${book.title}封面`} sx={{ width: "100%", maxWidth: { xs: `${tokens.spacing[24]}px`, sm: "none" }, mx: { xs: "auto", sm: 0 }, aspectRatio: "2 / 3", objectFit: "cover", borderRadius: `${tokens.radius.lg}px`, boxShadow: tokens.shadow.cover }} />
              <Stack sx={{ alignItems: "flex-start", minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ mb: `${tokens.spacing[4]}px`, flexWrap: "wrap", rowGap: `${tokens.spacing[2]}px` }}><Chip label={book.format} variant="outlined" size="small" />{book.tags.map((tag) => <Chip key={tag} label={tag} size="small" />)}</Stack>
                <Typography variant="h2" sx={{ fontSize: { xs: `${tokens.typography.fontSize.heading}px`, md: `${tokens.typography.fontSize.display}px` }, overflowWrap: "anywhere" }}>{book.title}</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>{book.author}</Typography>
                {book.description && <Typography sx={{ mt: `${tokens.spacing[6]}px` }}>{book.description}</Typography>}
                <Divider flexItem sx={{ my: { xs: `${tokens.spacing[5]}px`, md: `${tokens.spacing[6]}px` } }} />
                <Stack spacing={1.2} sx={{ width: "100%", minWidth: 0 }}>
                  <Meta icon={<ScheduleRounded />} label="入库时间" value={new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(new Date(book.addedAt))} />
                  <Meta icon={<MenuBookRounded />} label="文件位置" value={`${book.libraryRoot}/${book.relativePath}`} />
                </Stack>
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: { xs: `${tokens.spacing[3]}px`, sm: `${tokens.spacing[6]}px`, md: `${tokens.spacing[8]}px` }, pt: { xs: `${tokens.spacing[2]}px`, sm: 0 }, pb: { xs: `${tokens.spacing[3]}px`, sm: `${tokens.spacing[6]}px` }, display: { xs: "grid", sm: "flex" }, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))" }, gap: `${tokens.spacing[2]}px`, alignItems: "stretch" }}>
            {canManage && (
              <Stack direction="row" spacing={1} sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, width: { xs: "100%", sm: "auto" }, flexWrap: "wrap" }}>
                <Button startIcon={<EditNoteRounded />} color="inherit" onClick={() => onEditMetadata(book)} sx={{ flex: { xs: "1 1 auto", sm: "0 0 auto" } }}>编辑元信息</Button>
                <Button color="inherit" onClick={() => onOperation(book, "RENAME")} sx={{ flex: { xs: "1 1 auto", sm: "0 0 auto" } }}>管理文件</Button>
              </Stack>
            )}
            <Box sx={{ display: { xs: "none", sm: "block" }, flex: 1 }} />
            <Stack direction="row" spacing={1} sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, width: { xs: "100%", sm: "auto" } }}>
              <Button onClick={onClose} color="inherit" sx={{ flex: { xs: 1, sm: "initial" } }}>关闭</Button>
              <Button startIcon={<BookmarkAddOutlined />} onClick={() => onAddToBooklist(book)} sx={{ flex: { xs: 1, sm: "initial" } }}>加入书单</Button>
              <Button variant="contained" onClick={() => onRead(book)} sx={{ flex: { xs: 1, sm: "initial" } }}>开始阅读</Button>
            </Stack>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

function Meta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", color: "text.secondary" }}>
      <Box sx={{ display: "inline-flex", mt: "2px" }}>{icon}</Box>
      <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}><Typography variant="caption">{label}</Typography><Typography variant="body2" color="text.primary" sx={{ overflowWrap: "anywhere" }}>{value}</Typography></Box>
    </Stack>
  );
}
