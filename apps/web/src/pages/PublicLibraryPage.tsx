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
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { flattenUniquePaginatedItems, PaginatedItemReveal } from "../components/PaginatedItemReveal";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { bookGridSx } from "../components/bookGrid";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { PageContainer, PageHeader } from "../components/PageHeader";
import type { DisplayBook } from "../domain/types";

export function PublicLibraryPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q")?.trim() ?? "";
  const deferredQuery = useDeferredValue(query);
  const displayQuery = useInfiniteQuery({
    queryKey: ["display-books", deferredQuery],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.listDisplayBooks({ q: deferredQuery || undefined, cursor: pageParam, limit: 36, signal }),
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
      <PageHeader
        eyebrow="HOME"
        title="首页"
      />
      {displayQuery.isPending ? (
        <BookGridSkeleton label="正在打开首页" />
      ) : displayQuery.isError && !displayQuery.data ? (
        <Alert severity="error">首页暂时无法读取，请稍后刷新。</Alert>
      ) : books.length === 0 ? (
        <BookCatalogEmptyState title={query ? "未找到匹配的书籍" : "暂无公开书籍"} />
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
      {query && books.length === 0 && <Button sx={{ mt: 2 }} onClick={() => setParams({})}>清除搜索</Button>}
    </PageContainer>
  );
}

function PublicBookCard({ book }: { book: DisplayBook }) {
  return <BookCardPresentation book={book} />;
}
