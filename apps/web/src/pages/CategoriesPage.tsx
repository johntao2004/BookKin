import { EMPTY_CATEGORIES_TITLE } from "../ui/empty-state-copy";
import { BookGridSkeleton } from "../components/BookGridSkeleton";
import { AddRounded } from "@/ui/icons";
import { TuneRounded } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Chip } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { Divider } from "@/ui/feedback";
import { FormControl } from "@/ui/primitives";
import { MenuItem } from "@/ui/primitives";
import { Paper } from "@/ui/primitives";
import { Select } from "@/ui/forms";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { BrowseBookCard } from "../components/CatalogDiscoveryCards";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { CategoryManagementDialog } from "../components/CategoryManagementDialog";
import { PageContainer, PageHeader } from "../components/PageHeader";
import { bookGridSx } from "../components/bookGrid";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { tokens } from "../theme/generated-tokens";

type SortKey = "recent" | "title" | "author";



export function CategoriesPage() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const categoryParam = params.get("category") ?? "";
  const query = params.get("q") ?? "";
  const deferredQuery = useDeferredValue(query);
  const format = params.get("format") ?? "ALL";
  const sort = (params.get("sort") ?? "recent") as SortKey;
  const audienceKey = user?.id ?? "anonymous";
  const manageOpen = params.get("manage") === "1";

  const categoriesQuery = useQuery({
    queryKey: ["categories", audienceKey],
    queryFn: ({ signal }) => api.listCategories({ signal }),
    enabled: ready,
  });
  const categories = categoriesQuery.data?.items ?? [];
  // 分类列表加载期间保持管理入口；响应到达后以服务端权限为准，角色回退仅防止页头跳动。
  // Keep the management action available while the category list is loading.
  // The server response remains authoritative once it arrives, while the
  // role fallback prevents the header from shifting and makes the action
  // discoverable immediately for owners and administrators.
  const canManage = categoriesQuery.data?.editable ?? (user?.role === "OWNER" || user?.role === "ADMIN");
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryParam) ?? categories[0],
    [categories, categoryParam],
  );

  const booksQuery = useInfiniteQuery({
    queryKey: ["category-books", selectedCategory?.id ?? "none", audienceKey, deferredQuery, format, sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      if (!selectedCategory) throw new Error("没有可读取的分类");
      return api.listCategoryBooks({
        id: selectedCategory.id,
        q: deferredQuery.trim() || undefined,
        format: format === "ALL" ? undefined : format as "EPUB" | "PDF",
        sort,
        cursor: pageParam,
        limit: 36,
        signal,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: ready && Boolean(selectedCategory),
  });
  const books = useMemo(() => booksQuery.data?.pages.flatMap((page) => page.items) ?? [], [booksQuery.data]);
  const loadNextPage = useCallback(() => {
    if (booksQuery.hasNextPage && !booksQuery.isFetchingNextPage) void booksQuery.fetchNextPage();
  }, [booksQuery.fetchNextPage, booksQuery.hasNextPage, booksQuery.isFetchingNextPage]);
  const { triggerRef, supported } = useInfiniteScrollTrigger({
    enabled: Boolean(booksQuery.hasNextPage && !booksQuery.isFetchingNextPage),
    onLoadMore: loadNextPage,
  });

  const updateParam = (key: string, value: string, defaultValue?: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const selectCategory = (categoryId: string) => {
    const next = new URLSearchParams(params);
    next.set("category", categoryId);
    next.delete("q");
    setParams(next, { replace: true });
  };

  const clearBookFilters = () => {
    const next = new URLSearchParams(params);
    next.delete("q");
    next.delete("format");
    setParams(next, { replace: true });
  };

  const setManageOpen = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set("manage", "1");
    else next.delete("manage");
    setParams(next, { replace: true });
  };

  const categoryManagementAction = canManage ? categoriesQuery.isSuccess && categories.length === 0 ? (
    <Button variant="contained" startIcon={<AddRounded />} onClick={() => setManageOpen(true)}>创建分类</Button>
  ) : (
    <Button variant="outlined" startIcon={<TuneRounded />} disabled={!categoriesQuery.isSuccess} onClick={() => setManageOpen(true)}>管理分类</Button>
  ) : undefined;
  const headerAction = categories.length ? (
    <Stack direction="row" sx={{ alignItems: "center", gap: `${tokens.spacing[3]}px`, flexWrap: "wrap" }}>
      <Chip variant="outlined" label={`${categories.length} 个主题`} />
      {categoryManagementAction}
    </Stack>
  ) : categoryManagementAction;

  return (
    <PageContainer>
      <PageHeader eyebrow="CATEGORIES" title="分类" action={headerAction} />

      {categoriesQuery.isPending ? (
        <Stack sx={{ alignItems: "center", py: `${tokens.spacing[20]}px` }}><CircularProgress /><Typography color="text.secondary" sx={{ mt: `${tokens.spacing[2]}px` }}>正在整理分类目录…</Typography></Stack>
      ) : categoriesQuery.isError ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void categoriesQuery.refetch()}>重试</Button>}>分类暂时无法读取。</Alert>
      ) : categories.length && selectedCategory ? (
        <>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[5]}px` },
              mb: `${tokens.spacing[6]}px`,
              bgcolor: "background.paper",
              borderColor: "divider",
              borderRadius: `${tokens.radius.lg}px`,
            }}
          >
            <FilterRow label="分类" ariaLabel="分类筛选">
              {categories.map((category) => {
                const selected = category.id === selectedCategory.id;
                return (
                  <Chip
                    key={category.id}
                    clickable
                    label={`${category.name} · ${category.bookCount} 本`}
                    aria-label={`${category.name}，${category.bookCount} 本`}
                    aria-pressed={selected}
                    variant="outlined"
                    onClick={() => selectCategory(category.id)}
                    sx={filterChipSx(selected)}
                  />
                );
              })}
            </FilterRow>
            <Divider sx={{ my: `${tokens.spacing[3]}px` }} />
            <FilterRow label="格式" ariaLabel="格式筛选">
              {(["ALL", "EPUB", "PDF"] as const).map((value) => {
                const selected = format === value;
                return (
                  <Chip
                    key={value}
                    clickable
                    label={value === "ALL" ? "全部" : value}
                    aria-pressed={selected}
                    variant="outlined"
                    onClick={() => updateParam("format", value, "ALL")}
                    sx={filterChipSx(selected)}
                  />
                );
              })}
            </FilterRow>
            <Divider sx={{ my: `${tokens.spacing[3]}px` }} />
            <FilterRow label="排序" ariaLabel="排序方式">
              <FormControl size="small" sx={{ minWidth: tokens.spacing[24] + tokens.spacing[12] }}>
                <Select sx={{ height: { xs: tokens.layout.touchTarget, sm: tokens.layout.controlHeight } }} label="排序" value={sort} onChange={(event: any) => updateParam("sort", event.target.value, "recent")}>
                  <MenuItem value="recent">最近入库</MenuItem>
                  <MenuItem value="title">按书名</MenuItem>
                  <MenuItem value="author">按作者</MenuItem>
                </Select>
              </FormControl>
            </FilterRow>
          </Paper>

          {booksQuery.isPending ? (
            <BookGridSkeleton label="正在取下书架上的书" />
          ) : booksQuery.isError && !booksQuery.data ? (
            <Alert severity="error" action={<Button color="inherit" onClick={() => void booksQuery.refetch()}>重试</Button>}>分类书目暂时无法读取。</Alert>
          ) : books.length ? (
            <Box sx={bookGridSx}>
              {books.map((book) => <BrowseBookCard key={book.id} book={book} />)}
            </Box>
          ) : (
            <BookCatalogEmptyState title={query || format !== "ALL" ? "未找到匹配的书籍" : "该分类暂无书籍"}
              action={query || format !== "ALL" ? <Button variant="outlined" onClick={clearBookFilters}>清除筛选</Button> : undefined}
            />
          )}

          {booksQuery.hasNextPage && !booksQuery.isFetchNextPageError ? (
            <Stack ref={triggerRef} role="status" sx={{ alignItems: "center", py: `${tokens.spacing[8]}px` }}>
              {booksQuery.isFetchingNextPage ? <CircularProgress size={24} /> : supported ? <Typography variant="caption" color="text.disabled">继续向下浏览将加载更多</Typography> : <Button onClick={loadNextPage}>继续加载</Button>}
            </Stack>
          ) : null}
          {booksQuery.isFetchNextPageError ? <Alert severity="warning" sx={{ mt: `${tokens.spacing[6]}px` }} action={<Button color="inherit" onClick={() => void booksQuery.fetchNextPage()}>重新加载</Button>}>更多分类书目加载失败，已显示的书籍不受影响。</Alert> : null}
        </>
      ) : (
        <BookCatalogEmptyState title={EMPTY_CATEGORIES_TITLE} />
      )}
      {canManage && categoriesQuery.isSuccess ? (
        <CategoryManagementDialog
          open={manageOpen}
          mode={categories.length === 0 ? "create" : "manage"}
          categories={categories}
          onClose={() => setManageOpen(false)}
        />
      ) : null}
    </PageContainer>
  );
}

function FilterRow({ label, ariaLabel, children }: { label: string; ariaLabel: string; children: ReactNode }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "flex-start", sm: "center" }, gap: `${tokens.spacing[3]}px` }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: { sm: tokens.spacing[20] }, flexShrink: 0 }}>{label}</Typography>
      <Box role="group" aria-label={ariaLabel} sx={{ display: "flex", flexWrap: "wrap", gap: `${tokens.spacing[2]}px` }}>{children}</Box>
    </Stack>
  );
}

function filterChipSx(selected: boolean) {
  return {
    minHeight: { xs: tokens.layout.touchTarget, sm: tokens.layout.controlHeight },
    borderRadius: `${tokens.radius.sm}px`,
    bgcolor: selected ? "primary.light" : "background.default",
    borderColor: selected ? "primary.main" : "divider",
    color: "text.primary",
    "&:hover": { bgcolor: selected ? "primary.light" : "background.paper" },
  };
}
