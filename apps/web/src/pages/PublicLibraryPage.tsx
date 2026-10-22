// 公共首页只消费公开展示目录，管理入口不改变匿名数据可见范围。
// The public homepage consumes display-catalog data only; management links do not expand anonymous visibility.
import { BookGridSkeleton } from "../components/BookGridSkeleton";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { BookCardPresentation } from "../components/BookCardPresentation";
import { CircularProgress } from "@/ui/feedback";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useMemo } from "react";
import { useCatalogFilterParams } from "../hooks/useCatalogFilterParams";
import { CatalogAdvancedFilters, CatalogAdvancedFilterToggle } from "../components/CatalogAdvancedFilters";
import { CatalogFilters } from "../components/CatalogFilters";
import { CatalogSection } from "../components/CatalogSection";
import { api } from "../api/client";
import { flattenUniquePaginatedItems, PaginatedItemReveal } from "../components/PaginatedItemReveal";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { bookGridSx } from "../components/bookGrid";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { PageContainer } from "../components/PageHeader";
import { LibraryPageHeader, LibraryScopeFilter } from "../components/LibraryPageHeader";
import { useAuth } from "../auth/AuthContext";
import type { DisplayBook } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function PublicLibraryPage() {
  const { user } = useAuth();
  const { query, categoryId, subjectCode, format, sort, updateParam, clearFilters, activeCount } = useCatalogFilterParams();
  const deferredQuery = useDeferredValue(query);
  const displayQuery = useInfiniteQuery({
    queryKey: ["display-books", deferredQuery, categoryId, subjectCode, format, sort, user?.id ?? "anonymous"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.listDisplayBooks({ q: deferredQuery.trim() || undefined, categoryId: categoryId || undefined, subjectCode: subjectCode || undefined, format: format === "ALL" ? undefined : format as "EPUB" | "PDF", sort, cursor: pageParam, limit: 36, signal }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: 15_000,
  });
  const bookEntries = useMemo(() => flattenUniquePaginatedItems(displayQuery.data?.pages), [displayQuery.data]);
  const books = useMemo(() => bookEntries.map(({ item }) => item), [bookEntries]);
  const loadNextPage = useCallback(() => {
    if (displayQuery.hasNextPage && !displayQuery.isFetchingNextPage) void displayQuery.fetchNextPage();
  }, [displayQuery.fetchNextPage, displayQuery.hasNextPage, displayQuery.isFetchingNextPage]);
  const { triggerRef, supported } = useInfiniteScrollTrigger({
    enabled: Boolean(displayQuery.hasNextPage && !displayQuery.isFetchingNextPage),
    onLoadMore: loadNextPage,
  });

  return (
    <PageContainer>
      <LibraryPageHeader />
      <CatalogSection title="公开藏书" tools={<CatalogFilters
        extraTools={<Stack direction="row" sx={{ flexWrap: "wrap", gap: `${tokens.spacing[3]}px` }}><LibraryScopeFilter /><CatalogAdvancedFilterToggle /></Stack>}
        filter={{ label: "格式", value: format, onChange: value => updateParam("format", value, "ALL"), options: [{ value: "ALL", label: "全部格式" }, { value: "EPUB", label: "EPUB" }, { value: "PDF", label: "PDF" }] }}
        sort={{ label: "排序", value: sort, onChange: value => updateParam("sort", value, "recent"), options: [{ value: "recent", label: "最近入库" }, { value: "title", label: "按书名" }, { value: "author", label: "按作者" }] }}
      />}>
      <CatalogAdvancedFilters />
      {activeCount > 0 && <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>已加载 {books.length} 本匹配藏书</Typography>}
      {displayQuery.isPending ? (
        <BookGridSkeleton label="正在加载公开藏书" />
      ) : displayQuery.isError && !displayQuery.data ? (
        <Alert severity="error">公开藏书暂时无法读取，请稍后刷新。</Alert>
      ) : books.length === 0 ? (
        <BookCatalogEmptyState title={activeCount ? "未找到匹配的书籍" : "暂无公开书籍"} action={activeCount ? <Button onClick={clearFilters}>清除筛选</Button> : undefined} />
      ) : (
        <Box sx={bookGridSx}>
          {bookEntries.map(({ item: book, pageIndex, itemIndex }) => (
            <PaginatedItemReveal key={book.id} animate={pageIndex > 0} order={itemIndex}>
              <PublicBookCard book={book} />
            </PaginatedItemReveal>
          ))}
        </Box>
      )}
      {(displayQuery.hasNextPage || displayQuery.isFetchingNextPage) && (
        <Stack ref={triggerRef} role="status" aria-live="polite" sx={{ minHeight: 96, alignItems: "center", justifyContent: "center", mt: 3 }}>
          {displayQuery.isFetchingNextPage ? <CircularProgress size={22} /> : supported ? <Typography variant="caption" color="text.disabled">继续向下浏览，将自动加载更多书目</Typography> : <Button variant="outlined" onClick={loadNextPage}>继续加载</Button>}
        </Stack>
      )}
      {displayQuery.isFetchNextPageError && <Alert severity="warning" sx={{ mt: 3 }}>更多展示书目加载失败，请重试。</Alert>}
      </CatalogSection>
    </PageContainer>
  );
}

function PublicBookCard({ book }: { book: DisplayBook }) {
  return <BookCardPresentation book={book} />;
}
