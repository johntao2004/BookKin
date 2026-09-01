import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import AutoStoriesOutlined from "@mui/icons-material/AutoStoriesOutlined";
import FilterListRounded from "@mui/icons-material/FilterListRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MuiLink from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AddToBooklistDialog } from "../components/AddToBooklistDialog";
import { BrowseBookCard } from "../components/CatalogDiscoveryCards";
import { CategoryBooksDrawer } from "../components/CategoryBooksDrawer";
import { PageContainer, PageHeader } from "../components/PageHeader";
import type { BrowseBook } from "../domain/types";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { tokens } from "../theme/generated-tokens";

type SortKey = "recent" | "title" | "author";

export function CategoryDetailPage() {
  const { categoryId = "" } = useParams();
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [addBook, setAddBook] = useState<BrowseBook | null>(null);
  const [notice, setNotice] = useState("");
  const query = params.get("q") ?? "";
  const deferredQuery = useDeferredValue(query);
  const format = params.get("format") ?? "ALL";
  const sort = (params.get("sort") ?? "recent") as SortKey;
  const audienceKey = user?.id ?? "anonymous";
  const detailQuery = useQuery({ queryKey: ["category", categoryId, audienceKey], queryFn: () => api.getCategory(categoryId), enabled: ready && Boolean(categoryId) });
  const booksQuery = useInfiniteQuery({
    queryKey: ["category-books", categoryId, audienceKey, deferredQuery, format, sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.listCategoryBooks({
      id: categoryId,
      q: deferredQuery.trim() || undefined,
      format: format === "ALL" ? undefined : format as "EPUB" | "PDF",
      sort,
      cursor: pageParam,
      limit: 36,
      signal,
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: ready && Boolean(categoryId),
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

  if (detailQuery.isPending) return <PageContainer><Stack sx={{ alignItems: "center", py: `${tokens.spacing[20]}px` }}><CircularProgress /></Stack></PageContainer>;
  if (detailQuery.isError || !detailQuery.data) return <PageContainer><Alert severity="error" action={<Button component={Link} to="/categories">返回分类</Button>}>这个分类不存在，或当前没有可见书目。</Alert></PageContainer>;
  const category = detailQuery.data;

  return (
    <PageContainer>
      <Breadcrumbs sx={{ mb: `${tokens.spacing[5]}px` }}>
        <MuiLink component={Link} to="/categories" underline="hover" color="inherit">分类</MuiLink>
        <Typography color="text.primary">{category.name}</Typography>
      </Breadcrumbs>
      <PageHeader
        eyebrow="CATEGORY"
        title={category.name}
        description={category.description || "这个分类还没有简介。"}
        action={category.editable ? <Button variant="outlined" startIcon={<TuneRounded />} onClick={() => setOrganizerOpen(true)}>整理本分类</Button> : undefined}
      />
      <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" }, gap: `${tokens.spacing[4]}px`, mb: `${tokens.spacing[8]}px` }}>
        <Typography color="text.secondary">{category.bookCount} 本可见藏书</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: `${tokens.spacing[3]}px`, alignItems: { xs: "stretch", sm: "center" } }}>
          <TextField size="small" label="搜索书名或作者" value={query} onChange={(event) => updateParam("q", event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <FormControl size="small" sx={{ minWidth: 126 }}>
            <InputLabel id="category-format-label">格式</InputLabel>
            <Select labelId="category-format-label" label="格式" value={format} onChange={(event) => updateParam("format", event.target.value, "ALL")} startAdornment={<FilterListRounded sx={{ mr: 1, color: "text.secondary" }} />}>
              <MenuItem value="ALL">全部格式</MenuItem><MenuItem value="EPUB">EPUB</MenuItem><MenuItem value="PDF">PDF</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 126 }}>
            <InputLabel id="category-sort-label">排序</InputLabel>
            <Select labelId="category-sort-label" label="排序" value={sort} onChange={(event) => updateParam("sort", event.target.value, "recent")}>
              <MenuItem value="recent">最近入库</MenuItem><MenuItem value="title">按书名</MenuItem><MenuItem value="author">按作者</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>
      {booksQuery.isPending ? (
        <Stack sx={{ alignItems: "center", py: `${tokens.spacing[16]}px` }}><CircularProgress /></Stack>
      ) : booksQuery.isError && !booksQuery.data ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void booksQuery.refetch()}>重试</Button>}>分类书目暂时无法读取。</Alert>
      ) : books.length ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" }, gap: { xs: 2, sm: 3, md: 4 } }}>
          {books.map((book) => <BrowseBookCard key={book.id} book={book} onAdd={user ? setAddBook : undefined} />)}
        </Box>
      ) : (
        <Stack sx={{ alignItems: "center", textAlign: "center", py: `${tokens.spacing[16]}px`, gap: `${tokens.spacing[3]}px` }}>
          <AutoStoriesOutlined color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h4">{query || format !== "ALL" ? "没有匹配的书" : "这个分类还是空的"}</Typography>
          <Typography color="text.secondary">{category.editable ? "可以整理本分类，把藏书加入这里。" : "稍后再回来看看。"}</Typography>
        </Stack>
      )}
      {booksQuery.hasNextPage && !booksQuery.isFetchNextPageError ? <Stack ref={triggerRef} sx={{ alignItems: "center", py: `${tokens.spacing[8]}px` }}>{booksQuery.isFetchingNextPage ? <CircularProgress size={24} /> : supported ? <Typography variant="caption" color="text.disabled">继续向下浏览将加载更多</Typography> : <Button onClick={loadNextPage}>继续加载</Button>}</Stack> : null}
      {booksQuery.isFetchNextPageError ? <Alert severity="warning" sx={{ mt: `${tokens.spacing[6]}px` }} action={<Button color="inherit" onClick={() => void booksQuery.fetchNextPage()}>重新加载</Button>}>更多分类书目加载失败，已显示的书籍不受影响。</Alert> : null}
      <Button component={Link} to="/categories" startIcon={<ArrowBackRounded />} sx={{ mt: `${tokens.spacing[10]}px` }}>返回全部分类</Button>
      {category.editable ? <CategoryBooksDrawer open={organizerOpen} categoryId={category.id} categoryName={category.name} onClose={() => setOrganizerOpen(false)} /> : null}
      {addBook ? <AddToBooklistDialog open bookId={addBook.id} bookTitle={addBook.title} onClose={() => setAddBook(null)} onCompleted={setNotice} /> : null}
      <Snackbar open={Boolean(notice)} autoHideDuration={4200} onClose={() => setNotice("")} message={notice} />
    </PageContainer>
  );
}
