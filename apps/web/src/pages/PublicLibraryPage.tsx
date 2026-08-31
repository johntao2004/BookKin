import { AutoStoriesOutlined, MenuBookRounded } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardActionArea, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { flattenUniquePaginatedItems, PaginatedItemReveal } from "../components/PaginatedItemReveal";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { PageContainer, PageHeader } from "../components/PageHeader";
import type { DisplayBook } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

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
  const revision = displayQuery.data?.pages.at(-1)?.revision ?? 0;

  return (
    <PageContainer sx={{ pt: { xs: 3, md: 5 } }}>
      <PageHeader
        eyebrow="HOME"
        title="首页"
        action={<Chip icon={<AutoStoriesOutlined />} label={`${books.length}${displayQuery.hasNextPage ? "+" : ""} 本展示书目`} variant="outlined" />}
      />
      {displayQuery.isPending ? (
        <Stack spacing={2} sx={{ alignItems: "center", py: 12 }}><CircularProgress /><Typography color="text.secondary">正在打开首页…</Typography></Stack>
      ) : displayQuery.isError && !displayQuery.data ? (
        <Alert severity="error">首页暂时无法读取，请稍后刷新。</Alert>
      ) : books.length === 0 ? (
        <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center", py: 12 }}>
          <AutoStoriesOutlined color="primary" sx={{ fontSize: 42 }} />
          <Typography variant="h4">还没有公开书目</Typography>
          <Typography color="text.secondary">登录后可以在“展示书目设置”中添加书籍。</Typography>
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" }, gap: { xs: 2, sm: 3, md: 4 } }}>
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
      {revision > 0 && <Typography variant="caption" color="text.disabled" sx={{ display: "block", textAlign: "center", mt: 6 }}>公共书单版本 {revision}</Typography>}
      {displayQuery.isFetchNextPageError && <Alert severity="warning" sx={{ mt: 3 }}>更多展示书目加载失败，请重试。</Alert>}
      {query && books.length === 0 && <Button sx={{ mt: 2 }} onClick={() => setParams({})}>清除搜索</Button>}
    </PageContainer>
  );
}

function PublicBookCard({ book }: { book: DisplayBook }) {
  return (
    <Card sx={{ bgcolor: "transparent", overflow: "visible", contentVisibility: "auto", containIntrinsicSize: "420px" }}>
      <CardActionArea component={Link} to={`/reader/${book.id}`} sx={{ borderRadius: `${tokens.radius.lg}px`, overflow: "hidden" }}>
        <Box component="img" src={book.coverUrl} alt={`${book.title}封面`} loading="lazy" decoding="async" sx={{ width: "100%", aspectRatio: "2 / 3", display: "block", objectFit: "cover", bgcolor: "background.paper", boxShadow: tokens.shadow.cover }} />
      </CardActionArea>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", justifyContent: "space-between", mt: 1.5 }}>
        <Box sx={{ minWidth: 0 }}><Typography variant="h6" noWrap title={book.title}>{book.title}</Typography><Typography variant="body2" color="text.secondary" noWrap>{book.author}</Typography></Box>
        <Button component={Link} to={`/reader/${book.id}`} size="small" aria-label={`阅读 ${book.title}`} sx={{ minWidth: 0, px: 0.5 }}><MenuBookRounded fontSize="small" /></Button>
      </Stack>
    </Card>
  );
}
