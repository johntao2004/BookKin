import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import AutoStoriesOutlined from "@mui/icons-material/AutoStoriesOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
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
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AddToBooklistDialog } from "../components/AddToBooklistDialog";
import { BooklistFormDialog } from "../components/BooklistFormDialog";
import { BooklistOrganizerDrawer } from "../components/BooklistOrganizerDrawer";
import { BrowseBookCard, CoverMosaic, VisibilityChip } from "../components/CatalogDiscoveryCards";
import { PageContainer } from "../components/PageHeader";
import type { BooklistDetail, BrowseBook } from "../domain/types";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { tokens } from "../theme/generated-tokens";

export function BooklistDetailPage() {
  const { booklistId = "" } = useParams();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [addBook, setAddBook] = useState<BrowseBook | null>(null);
  const [notice, setNotice] = useState("");
  const query = params.get("q") ?? "";
  const deferredQuery = useDeferredValue(query);
  const format = params.get("format") ?? "ALL";
  const audienceKey = user?.id ?? "anonymous";
  const detailQuery = useQuery({ queryKey: ["booklist", booklistId, audienceKey], queryFn: () => api.getBooklist(booklistId), enabled: ready && Boolean(booklistId) });
  const booksQuery = useInfiniteQuery({
    queryKey: ["booklist-books", booklistId, audienceKey, deferredQuery, format],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.listBooklistBooks({
      id: booklistId,
      q: deferredQuery.trim() || undefined,
      format: format === "ALL" ? undefined : format as "EPUB" | "PDF",
      cursor: pageParam,
      limit: 36,
      signal,
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: ready && Boolean(booklistId),
  });
  const books = useMemo(() => booksQuery.data?.pages.flatMap((page) => page.items) ?? [], [booksQuery.data]);
  const loadNextPage = useCallback(() => {
    if (booksQuery.hasNextPage && !booksQuery.isFetchingNextPage) void booksQuery.fetchNextPage();
  }, [booksQuery.fetchNextPage, booksQuery.hasNextPage, booksQuery.isFetchingNextPage]);
  const { triggerRef, supported } = useInfiniteScrollTrigger({ enabled: Boolean(booksQuery.hasNextPage && !booksQuery.isFetchingNextPage), onLoadMore: loadNextPage });

  const updateDetail = (detail: BooklistDetail, message: string) => {
    queryClient.setQueryData(["booklist", booklistId, audienceKey], detail);
    setNotice(message);
    void queryClient.invalidateQueries({ queryKey: ["booklists"] });
    void queryClient.invalidateQueries({ queryKey: ["booklist-books", booklistId] });
  };

  const updateParam = (key: string, value: string, defaultValue?: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  if (detailQuery.isPending) return <PageContainer><Stack sx={{ alignItems: "center", py: `${tokens.spacing[20]}px` }}><CircularProgress /></Stack></PageContainer>;
  if (detailQuery.isError || !detailQuery.data) return <PageContainer><Alert severity="error" action={<Button component={Link} to="/booklists">返回书单</Button>}>这个书单不存在，或你没有查看权限。</Alert></PageContainer>;
  const booklist = detailQuery.data;
  const canCreateOfficial = user?.role === "OWNER" || user?.role === "ADMIN";

  return (
    <PageContainer>
      <Breadcrumbs sx={{ mb: `${tokens.spacing[5]}px` }}>
        <MuiLink component={Link} to="/booklists" underline="hover" color="inherit">书单</MuiLink>
        <Typography color="text.primary">{booklist.title}</Typography>
      </Breadcrumbs>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(220px, .62fr) minmax(0, 1.38fr)" }, gap: { xs: `${tokens.spacing[6]}px`, md: `${tokens.spacing[10]}px` }, alignItems: "stretch", mb: `${tokens.spacing[10]}px` }}>
        <CoverMosaic books={booklist.previewBooks} label={`${booklist.title}书单封面`} />
        <Stack sx={{ justifyContent: "center", alignItems: "flex-start", gap: `${tokens.spacing[4]}px`, py: { sm: `${tokens.spacing[6]}px` } }}>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: `${tokens.spacing[2]}px`, alignItems: "center" }}>
            <Typography variant="overline" color="primary.main">{booklist.kind === "OFFICIAL" ? "OFFICIAL BOOKLIST" : "BOOKLIST"}</Typography>
            <VisibilityChip visibility={booklist.visibility} />
          </Stack>
          <Typography variant="h2" component="h1">{booklist.title}</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 720 }}>{booklist.description || "创建者还没有写下这份书单的说明。"}</Typography>
          <Typography variant="body2" color="text.secondary">{booklist.kind === "OFFICIAL" ? "BookKin官方整理" : `由 ${booklist.ownerDisplayName} 创建`} · {booklist.bookCount} 本</Typography>
          {booklist.editable ? (
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ width: { xs: "100%", sm: "auto" }, gap: `${tokens.spacing[3]}px`, mt: `${tokens.spacing[2]}px` }}>
              <Button variant="contained" startIcon={<TuneRounded />} onClick={() => setOrganizerOpen(true)}>整理书单</Button>
              <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEditOpen(true)}>编辑资料与可见范围</Button>
            </Stack>
          ) : null}
        </Stack>
      </Box>
      {booklist.hiddenPublicBookCount > 0 ? <Alert severity="warning" sx={{ mb: `${tokens.spacing[6]}px` }}>有 {booklist.hiddenPublicBookCount} 本书已不在公共书目池，匿名访客不会看到它们。请整理书单或调整可见范围。</Alert> : null}
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: `${tokens.spacing[3]}px`, mb: `${tokens.spacing[8]}px` }}>
        <Typography variant="h3">书单内容</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: `${tokens.spacing[3]}px` }}>
          <TextField size="small" label="搜索书名或作者" value={query} onChange={(event) => updateParam("q", event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <FormControl size="small" sx={{ minWidth: 126 }}>
            <InputLabel id="booklist-format-label">格式</InputLabel>
            <Select labelId="booklist-format-label" label="格式" value={format} onChange={(event) => updateParam("format", event.target.value, "ALL")}>
              <MenuItem value="ALL">全部格式</MenuItem><MenuItem value="EPUB">EPUB</MenuItem><MenuItem value="PDF">PDF</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>
      {booksQuery.isPending ? (
        <Stack sx={{ alignItems: "center", py: `${tokens.spacing[16]}px` }}><CircularProgress /></Stack>
      ) : booksQuery.isError && !booksQuery.data ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void booksQuery.refetch()}>重试</Button>}>书单内容暂时无法读取。</Alert>
      ) : books.length ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" }, gap: { xs: 2, sm: 3, md: 4 } }}>
          {books.map((book) => <BrowseBookCard key={book.id} book={book} onAdd={user ? setAddBook : undefined} />)}
        </Box>
      ) : (
        <Stack sx={{ alignItems: "center", textAlign: "center", py: `${tokens.spacing[16]}px`, gap: `${tokens.spacing[3]}px` }}>
          <AutoStoriesOutlined color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h4">{query || format !== "ALL" ? "没有匹配的书" : "书单还是空的"}</Typography>
          <Typography color="text.secondary">{booklist.editable ? "打开“整理书单”，从藏书库加入第一本书。" : "创建者还没有加入书籍。"}</Typography>
          {booklist.editable && !query && format === "ALL" ? <Button variant="contained" onClick={() => setOrganizerOpen(true)}>整理书单</Button> : null}
        </Stack>
      )}
      {booksQuery.hasNextPage && !booksQuery.isFetchNextPageError ? <Stack ref={triggerRef} sx={{ alignItems: "center", py: `${tokens.spacing[8]}px` }}>{booksQuery.isFetchingNextPage ? <CircularProgress size={24} /> : supported ? <Typography variant="caption" color="text.disabled">继续向下浏览将加载更多</Typography> : <Button onClick={loadNextPage}>继续加载</Button>}</Stack> : null}
      {booksQuery.isFetchNextPageError ? <Alert severity="warning" sx={{ mt: `${tokens.spacing[6]}px` }} action={<Button color="inherit" onClick={() => void booksQuery.fetchNextPage()}>重新加载</Button>}>更多书单内容加载失败，已显示的书籍不受影响。</Alert> : null}
      <Button component={Link} to="/booklists" startIcon={<ArrowBackRounded />} sx={{ mt: `${tokens.spacing[10]}px` }}>返回全部书单</Button>
      {booklist.editable ? <BooklistOrganizerDrawer open={organizerOpen} booklist={booklist} onClose={() => setOrganizerOpen(false)} onChanged={updateDetail} /> : null}
      {booklist.editable ? (
        <BooklistFormDialog
          open={editOpen}
          initial={booklist}
          canCreateOfficial={Boolean(canCreateOfficial)}
          onClose={() => setEditOpen(false)}
          onSaved={(detail, message) => { setEditOpen(false); updateDetail(detail, message); }}
          onDeleted={(message) => { setEditOpen(false); navigate("/booklists"); setNotice(message); }}
        />
      ) : null}
      {addBook ? <AddToBooklistDialog open bookId={addBook.id} bookTitle={addBook.title} onClose={() => setAddBook(null)} onCompleted={setNotice} /> : null}
      <Snackbar open={Boolean(notice)} autoHideDuration={4200} onClose={() => setNotice("")} message={notice} />
    </PageContainer>
  );
}
