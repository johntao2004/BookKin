import { RequestErrorPage } from "./HttpErrorPage";
import { usePermissions } from "../auth/permissions";
import { BookGridSkeleton } from "../components/BookGridSkeleton";
import { KeyboardArrowUpRounded } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Fab } from "@/ui/buttons";
import { Snackbar } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Tooltip } from "@/ui/feedback";
import { Typography } from "@/ui/primitives";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CatalogAdvancedFilters, CatalogAdvancedFilterToggle } from "../components/CatalogAdvancedFilters";
import { useCatalogFilterParams } from "../hooks/useCatalogFilterParams";
import { CatalogFilters } from "../components/CatalogFilters";
import { CatalogSection } from "../components/CatalogSection";
import { BookCard } from "../components/BookCard";
import { bookGridSx } from "../components/bookGrid";
import { AddToBooklistDialog } from "../components/AddToBooklistDialog";
import { BookUploadDialog } from "../components/BookUploadDialog";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { FileOperationDialog } from "../components/FileOperationDialog";
import { flattenUniquePaginatedItems, PaginatedItemReveal } from "../components/PaginatedItemReveal";
import { PageContainer } from "../components/PageHeader";
import { LibraryPageHeader, LibraryScopeFilter } from "../components/LibraryPageHeader";
import { PublicLibraryPage } from "./PublicLibraryPage";
import type { Book, FileOperationType } from "../domain/types";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { tokens } from "../theme/generated-tokens";
import { EMPTY_CATALOG_TITLE } from "../ui/empty-state-copy";

export function LibraryPage() {
  const { user, ready } = useAuth();
  const [params] = useSearchParams();
  if (!ready) return <PageContainer><BookGridSkeleton label="正在加载藏书" /></PageContainer>;
  return user && params.get("scope") !== "public" ? <MemberLibraryPage key={user.id} /> : <PublicLibraryPage />;
}

function MemberLibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { query: rawQuery, categoryId, subjectCode, format, sort, updateParam, clearFilters: clearBookFilters, activeCount } = useCatalogFilterParams();
  const location = useLocation();
  const [operation, setOperation] = useState<{ book: Book; type: FileOperationType } | null>(null);
  const editMetadata = (book: Book) => navigate(`/library/books/${book.id}/edit`, { state: { bookReturnTo: `${location.pathname}${location.search}` } });
  const [booklistBook, setBooklistBook] = useState<Book | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [notice, setNotice] = useState("");
  const query = rawQuery.trim().toLocaleLowerCase("zh-CN");
  const deferredQuery = useDeferredValue(query);
  const { can } = usePermissions();
  // 查询键包含检索、格式和排序；请求接收取消信号，游标页属于该组查询条件。
  // The query key includes search, format and sort; requests receive cancellation signals and cursor pages belong to those filters.
  const booksQuery = useInfiniteQuery({
    queryKey: ["books", deferredQuery, format, sort, categoryId, subjectCode, user?.id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.listBooks({
      q: deferredQuery || undefined,
      categoryId: categoryId || undefined, subjectCode: subjectCode || undefined,
      format: format === "ALL" ? undefined : format as "EPUB" | "PDF",
      sort,
      cursor: pageParam,
      limit: 36,
      signal,
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: 15_000,
  });
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

  const loadNextPage = useCallback(() => {
    if (booksQuery.hasNextPage && !booksQuery.isFetchingNextPage) void booksQuery.fetchNextPage();
  }, [booksQuery.fetchNextPage, booksQuery.hasNextPage, booksQuery.isFetchingNextPage]);
  const { triggerRef, supported: automaticLoadingSupported } = useInfiniteScrollTrigger({
    enabled: Boolean(booksQuery.hasNextPage && !booksQuery.isFetchingNextPage && !booksQuery.isFetchNextPageError),
    onLoadMore: loadNextPage,
  });

  const bookEntries = useMemo(() => loadedBookEntries.filter(({ item }) => item.status === "AVAILABLE"), [loadedBookEntries]);
  const books = useMemo(() => bookEntries.map(({ item }) => item), [bookEntries]);


  if (booksQuery.isError && !booksQuery.data) return <RequestErrorPage error={booksQuery.error} retrying={booksQuery.isFetching} onRetry={() => void booksQuery.refetch()} />;
  return (
    <>
      <PageContainer>
        <LibraryPageHeader />



        <CatalogSection title="全部藏书" tools={
          <CatalogFilters
            extraTools={<Stack direction="row" sx={{ flexWrap: "wrap", gap: `${tokens.spacing[3]}px` }}><LibraryScopeFilter /><CatalogAdvancedFilterToggle /></Stack>}
            actions={can("library.upload") ? <Button variant="contained" onClick={() => setUploadOpen(true)} sx={{ whiteSpace: "nowrap" }}>上传书籍</Button> : undefined}
            filter={{ label: "格式", value: format, onChange: value => updateParam("format", value, "ALL"), options: [
              { value: "ALL", label: "全部格式" }, { value: "EPUB", label: "EPUB" }, { value: "PDF", label: "PDF" },
            ] }}
            sort={{ label: "排序", value: sort, onChange: value => updateParam("sort", value, "recent"), options: [
              { value: "recent", label: "最近入库" }, { value: "title", label: "按书名" }, { value: "author", label: "按作者" },
            ] }}
          />
        }>

        <CatalogAdvancedFilters />

        {activeCount > 0 && <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{query ? `找到 ${books.length} 本相关藏书` : `已加载 ${books.length} 本匹配藏书`}</Typography>}

        {booksQuery.isPending ? (
          <BookGridSkeleton label="正在加载藏书" />
        ) : booksQuery.isError && !booksQuery.data ? (
          <Alert severity="error">书库暂时无法读取，请检查网络与书库连接。</Alert>
        ) : books.length === 0 ? (
          <BookCatalogEmptyState title={activeCount ? "未找到匹配的书籍" : EMPTY_CATALOG_TITLE}
            action={activeCount ? <Button variant="outlined" onClick={clearBookFilters}>清除筛选</Button> : undefined}
          />
        ) : (
          <Box sx={bookGridSx}>
            {bookEntries.map(({ item: book, pageIndex, itemIndex }) => (
              <PaginatedItemReveal key={book.id} animate={pageIndex > 0} order={itemIndex}>
                <BookCard
                  book={book}
                  onOpen={(book) => navigate(`/library/books/${book.id}`, { state: { bookReturnTo: location.pathname + location.search } })}
                  onRead={(value) => navigate(`/reader/${value.id}`)}
                  onAddToBooklist={can("booklists.edit") ? setBooklistBook : undefined}
                  onEditMetadata={can("library.edit") ? editMetadata : undefined}
                  onFileOperation={can("library.files") || can("library.trash") ? (value, type) => setOperation({ book: value, type }) : undefined}
                />
              </PaginatedItemReveal>
            ))}
          </Box>
        )}
        {(booksQuery.hasNextPage || booksQuery.isFetchingNextPage) && !booksQuery.isFetchNextPageError && (
          <Stack ref={triggerRef} role="status" aria-live="polite" sx={{ minHeight: 96, alignItems: "center", justifyContent: "center", mt: 3 }}>
            {booksQuery.isFetchingNextPage ? (
              <CircularProgress aria-label="正在加载更多藏书" />
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
        </CatalogSection>
      </PageContainer>

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
