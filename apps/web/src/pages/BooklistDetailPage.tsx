import { RequestErrorPage } from "./HttpErrorPage";
import { usePermissions } from "../auth/permissions";
// 书目详情将浏览分页与成员管理分离，修改使用当前 revision 而非无条件覆盖。
// Separates booklist browsing pagination from membership edits using the current revision instead of unconditional overwrite.
import { BookGridSkeleton } from "../components/BookGridSkeleton";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Breadcrumbs } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { CircularProgress } from "@/ui/feedback";
import { FormControl } from "@/ui/primitives";
import { Link as UiLink } from "@/ui/primitives";
import { MenuItem } from "@/ui/primitives";
import { Select } from "@/ui/forms";
import { Snackbar } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AddToBooklistDialog } from "../components/AddToBooklistDialog";
import { BooklistFormDialog } from "../components/BooklistFormDialog";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { BooklistOrganizerDrawer } from "../components/BooklistOrganizerDrawer";
import { BrowseBookCard, CoverMosaic, VisibilityChip } from "../components/CatalogDiscoveryCards";
import { bookGridSx } from "../components/bookGrid";
import { PageBackAction, PageContainer, PageTitle } from "../components/PageHeader";
import type { BooklistDetail, BrowseBook } from "../domain/types";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { tokens } from "../theme/generated-tokens";

export function BooklistDetailPage() {
  const { booklistId = "" } = useParams();
  const { user, ready } = useAuth();
  const { can } = usePermissions();
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

  if (detailQuery.isPending) return <PageContainer><PageBackAction to="/booklists">返回书目</PageBackAction><Stack sx={{ alignItems: "center", py: `${tokens.spacing[20]}px` }}><CircularProgress /></Stack></PageContainer>;
  if (detailQuery.isError || !detailQuery.data) return <RequestErrorPage error={detailQuery.error} retrying={detailQuery.isFetching} onRetry={() => void detailQuery.refetch()} back={<PageBackAction to="/booklists">返回书目</PageBackAction>} />;
  const booklist = detailQuery.data;
  const coverColumnMaxWidth = tokens.spacing[24] * 3;

  return (
    <PageContainer>
      <PageBackAction to="/booklists">返回书目</PageBackAction>
      <Breadcrumbs sx={{ mb: `${tokens.spacing[5]}px` }}>
        <UiLink component={Link} to="/booklists" underline="hover" color="inherit">书目</UiLink>
        <Typography color="text.primary">{booklist.title}</Typography>
      </Breadcrumbs>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: `minmax(${tokens.layout.bookCardMinWidth}px, ${coverColumnMaxWidth}px) minmax(0, 1fr)` }, gap: { xs: `${tokens.spacing[6]}px`, md: `${tokens.spacing[10]}px` }, alignItems: "stretch", mb: `${tokens.spacing[10]}px` }}>
        <CoverMosaic books={booklist.previewBooks} label={`${booklist.title}书目封面`} />
        <Stack sx={{ justifyContent: "center", alignItems: "flex-start", gap: `${tokens.spacing[4]}px`, py: { sm: `${tokens.spacing[6]}px` } }}>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: `${tokens.spacing[2]}px`, alignItems: "center" }}>
            <Typography variant="overline" color="primary.main">BOOKLIST</Typography>
            <VisibilityChip visibility={booklist.visibility} />
          </Stack>
          <PageTitle>{booklist.title}</PageTitle>
          <Typography color="text.secondary" sx={{ maxWidth: 720 }}>{booklist.description || "创建者还没有写下这份书目的说明。"}</Typography>
          <Typography variant="body2" color="text.secondary">{booklist.ownerDisplayName ? `由 ${booklist.ownerDisplayName} 创建` : "共享书目"} · {booklist.bookCount} 本</Typography>
          {(booklist.editable && can("booklists.edit")) ? (
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ width: { xs: "100%", sm: "auto" }, gap: `${tokens.spacing[3]}px`, mt: `${tokens.spacing[2]}px` }}>
              <Button variant="contained" onClick={() => setOrganizerOpen(true)}>整理书目</Button>
              <Button variant="outlined" onClick={() => setEditOpen(true)}>编辑书目</Button>
            </Stack>
          ) : null}
        </Stack>
      </Box>
      {booklist.hiddenPublicBookCount > 0 ? <Alert severity="warning" sx={{ mb: `${tokens.spacing[6]}px` }}>有 {booklist.hiddenPublicBookCount} 本书已不在公共书目池，匿名访客不会看到它们。请整理书目或调整可见范围。</Alert> : null}
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: `${tokens.spacing[3]}px`, mb: `${tokens.spacing[4]}px` }}>
        <Typography variant="h4" component="h2">书目内容</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: `${tokens.spacing[3]}px` }}>
          <FormControl sx={{ minWidth: tokens.spacing[24] + tokens.spacing[8] }}>
            <Select label="格式" value={format} onChange={(event: any) => updateParam("format", event.target.value, "ALL")}>
              <MenuItem value="ALL">全部格式</MenuItem><MenuItem value="EPUB">EPUB</MenuItem><MenuItem value="PDF">PDF</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>
      {booksQuery.isPending ? (
        <BookGridSkeleton label="正在加载书目内容" />
      ) : booksQuery.isError && !booksQuery.data ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void booksQuery.refetch()}>重试</Button>}>书目内容暂时无法读取。</Alert>
      ) : books.length ? (
        <Box sx={bookGridSx}>
          {books.map((book) => <BrowseBookCard key={book.id} book={book} onAdd={user ? setAddBook : undefined} />)}
        </Box>
      ) : (
        <BookCatalogEmptyState title={query || format !== "ALL" ? "未找到匹配的书籍" : "书目中暂无书籍"}
          action={(booklist.editable && can("booklists.edit")) && !query && format === "ALL" ? <Button variant="contained" onClick={() => setOrganizerOpen(true)}>整理书目</Button> : undefined}
        />
      )}
      {booksQuery.hasNextPage && !booksQuery.isFetchNextPageError ? <Stack ref={triggerRef} sx={{ alignItems: "center", py: `${tokens.spacing[8]}px` }}>{booksQuery.isFetchingNextPage ? <CircularProgress size={24} /> : supported ? <Typography variant="caption" color="text.disabled">继续向下浏览将加载更多</Typography> : <Button onClick={loadNextPage}>继续加载</Button>}</Stack> : null}
      {booksQuery.isFetchNextPageError ? <Alert severity="warning" sx={{ mt: `${tokens.spacing[6]}px` }} action={<Button color="inherit" onClick={() => void booksQuery.fetchNextPage()}>重新加载</Button>}>更多书目内容加载失败，已显示的书籍不受影响。</Alert> : null}
      {(booklist.editable && can("booklists.edit")) ? <BooklistOrganizerDrawer open={organizerOpen} booklist={booklist} onClose={() => setOrganizerOpen(false)} onChanged={updateDetail} /> : null}
      {(booklist.editable && can("booklists.edit")) ? (
        <BooklistFormDialog
          open={editOpen}
          initial={booklist}
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
