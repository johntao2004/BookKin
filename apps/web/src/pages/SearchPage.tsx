import { usePermissions } from "../auth/permissions";
import { EmptyState } from "../ui/empty-state";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageContainer, PageHeader } from "../components/PageHeader";
import { BookCardPresentation } from "../components/BookCardPresentation";
import { bookGridSx } from "../components/bookGrid";
import { Alert } from "@/ui/feedback";
import { Button } from "@/ui/buttons";
import { Box, Stack, Typography } from "@/ui/primitives";
import type { BookPage, DisplayBookPage } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import type { Book, DisplayBook } from "../domain/types";

export function SearchPage() {
  const { user, ready } = useAuth();
  const { can } = usePermissions();
  const showNotes = Boolean(user) && can("notes.view");
  const showBooklists = !user || can("booklists.view");
  const [params] = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const audience = user?.id ?? "anonymous";
  const enabled = ready && Boolean(query);
  const matches = (values: (string | undefined)[]) => values.join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase());
  // 各搜索源保留服务端可见性规则；匿名用户不请求私人目录或批注，且缓存键不得跨身份共用。
  // Every source keeps its server-side visibility rules. Never query the private
  // catalog or annotations for anonymous visitors, or share their cache keys.
  const books = useInfiniteQuery({
    queryKey: ["global-search-books", audience, query], enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }): Promise<BookPage | DisplayBookPage> => {
      const input = { q: query, cursor: pageParam, limit: 24, signal };
      if (user) {
        const page = await api.listBooks(input);
        return { ...page, items: page.items.map((book, index) => ({ ...book, available: true, sortOrder: index })) };
      }
      return api.listDisplayBooks(input);
    },
    getNextPageParam: page => page.nextCursor,
  });
  const notes = useQuery({ queryKey: ["global-search-notes", audience, query], queryFn: () => api.listAnnotations(undefined, query), enabled: enabled && showNotes });
  const lists = useQuery({ queryKey: ["global-search-booklists", audience, query], queryFn: ({ signal }) => api.listBooklists({ q: query, signal }), enabled: enabled && showBooklists });
  const categories = useQuery({ queryKey: ["global-search-categories", audience], queryFn: ({ signal }) => api.listCategories({ signal }), enabled });
  const bookItems = books.data?.pages.flatMap<Book | DisplayBook>(page => page.items) ?? [];
  const noteItems = showNotes ? (notes.data ?? []).filter(note => matches([note.bookTitle, note.bookAuthor, note.quote, note.note])) : [];
  const categoryItems = (categories.data?.items ?? []).filter(category => matches([category.name, category.description]));
  const categoryLibraryPath = "/library";
  const categoryLibraryHref = (categoryId: string) => {
    const params = new URLSearchParams({ category: categoryId, advanced: "1" });
    return `${categoryLibraryPath}?${params.toString()}`;
  };
  const queries = [books, categories, ...(showNotes ? [notes] : []), ...(showBooklists ? [lists] : [])];
  const listItems = showBooklists ? lists.data?.items ?? [] : [];
  const loading = enabled && queries.some(result => result.isPending);
  const failed = enabled && queries.some(result => result.isError);
  const empty = !bookItems.length && !noteItems.length && !listItems.length && !categoryItems.length;
  const sectionSx = { gap: `${tokens.spacing[4]}px`, mt: `${tokens.spacing[8]}px` };
  return <PageContainer>
    <PageHeader eyebrow="SEARCH" title="搜索" />
    {!query ? <Typography color="text.secondary">在顶部输入关键词，按回车搜索。</Typography> : <>
      <Typography color="text.secondary">“{query}”的搜索结果</Typography>
      {loading && <Typography role="status" sx={{ mt: `${tokens.spacing[4]}px` }}>正在搜索…</Typography>}
      {failed && <Alert severity="warning" action={<Button onClick={() => { queries.forEach(result => { if (result.isError) void result.refetch(); }); }}>重试</Button>}>部分内容暂时无法搜索，已显示可用结果。</Alert>}
      {!loading && !failed && empty && <EmptyState title="未找到相关内容" />}
      {Boolean(bookItems.length) && <Stack component="section" sx={sectionSx}>
        <Typography component="h2" variant="h4">书籍</Typography>
        <Box sx={bookGridSx}>{bookItems.map(book => <BookCardPresentation key={book.id} book={book} />)}</Box>
        {books.hasNextPage && <Button disabled={books.isFetchingNextPage} onClick={() => void books.fetchNextPage()}>加载更多</Button>}
      </Stack>}
      {Boolean(noteItems.length) && <Stack component="section" sx={sectionSx}>
        <Typography component="h2" variant="h4">我的笔记与划线</Typography>
        {noteItems.length >= 500 && <Typography color="text.secondary">匹配内容较多，当前显示前 500 条；请使用更具体的关键词。</Typography>}
        {noteItems.map(note => <Box key={note.id} sx={{ borderBottom: "1px solid", borderColor: "divider", pb: `${tokens.spacing[4]}px` }}>
          <Typography component="h3" variant="h6">{note.bookTitle ?? "阅读札记"}</Typography>
          {note.quote && <Typography>{note.quote}</Typography>}
          {note.note && <Typography color="text.secondary">{note.note}</Typography>}
          <Button component={Link} to={note.locator ? `/reader/${note.bookId}?locator=${encodeURIComponent(note.locator)}` : `/annotations?bookId=${note.bookId}`} sx={{ mt: `${tokens.spacing[3]}px` }}>查看笔记</Button>
        </Box>)}
      </Stack>}
      {Boolean(listItems.length) && <Stack component="section" sx={sectionSx}>
        <Typography component="h2" variant="h4">书目</Typography>
        {listItems.map(list => <Button key={list.id} component={Link} to={`/booklists/${list.id}`} sx={{ alignSelf: "flex-start" }}>{list.title}</Button>)}
      </Stack>}
      {Boolean(categoryItems.length) && <Stack component="section" sx={sectionSx}>
        <Typography component="h2" variant="h4">分类</Typography>
        {categoryItems.map(category => <Button key={category.id} component={Link} to={categoryLibraryHref(category.id)} sx={{ alignSelf: "flex-start" }}>{category.name}</Button>)}
      </Stack>}
    </>}
  </PageContainer>;
}
