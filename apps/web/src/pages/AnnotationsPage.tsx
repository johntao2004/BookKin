import { BookCover } from "../components/BookCover";
// 按书籍组织当前用户笔记并提供导出，列表与搜索通过私人批注接口。
// Organizes the current user’s notes by book and supports exports through private annotation APIs.
import { FormatQuoteRounded } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Card } from "@/ui/cards";
import { CardActionArea } from "@/ui/primitives";
import { CardContent } from "@/ui/primitives";
import { Chip } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { Snackbar } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import type { SxProps, Theme } from "@/ui/primitives";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { annotationColorBackground, annotationColorHex } from "../domain/annotation-colors";
import type { Annotation, AnnotationBookSummary, AnnotationStyle } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { EMPTY_READING_NOTES_TITLE } from "../ui/empty-state-copy";
import { useAuth } from "../auth/AuthContext";

/** Preserve existing reader/export links while moving source categories to independent routes. */
export function AnnotationsPage() {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  const section = params.get("type") === "articles" || params.has("articleId") ? "articles" : "books";
  const legacySelection = params.has("type") || params.has("bookId") || params.has("articleId") || params.has("q");
  next.delete("type");
  if (legacySelection) next.set("view", "annotations");
  return <Navigate replace to={`/annotations${legacySelection ? `/${section}` : ""}${next.size ? `?${next}` : ""}`} />;
}

export function BookNotesContent() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const selected = params.get("bookId");
  const select = (id?: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (id) next.set("bookId", id); else next.delete("bookId");
    return next;
  });
  return selected
    ? <BookAnnotations bookId={selected} userId={user?.id ?? "anonymous"} />
    : <AnnotationBooks userId={user?.id ?? "anonymous"} onOpen={select} />;
}

function AnnotationBooks({ userId, onOpen }: { userId: string; onOpen: (bookId: string) => void }) {
  const [params] = useSearchParams();
  const search = params.get("q") ?? "";
  const deferredSearch = useDeferredValue(search.trim());
  const query = useInfiniteQuery({
    queryKey: ["annotation-books", userId, deferredSearch],
    queryFn: ({ pageParam }) => api.listAnnotationBooks({ q: deferredSearch || undefined, cursor: pageParam, limit: 36 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: userId !== "anonymous",
  });
  const books = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      {query.isPending ? <Loading label="正在加载读书札记" /> : query.isError ? <Alert severity="error">无法读取读书札记</Alert> : books.length === 0 ? (
        <BookCatalogEmptyState title={EMPTY_READING_NOTES_TITLE} />
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))", xl: `repeat(auto-fill, minmax(min(100%, ${tokens.layout.annotationCardMinWidth}px), 1fr))` }, gap: 2.5 }}>
            {books.map((book) => <AnnotationBookCard key={book.bookId} book={book} onOpen={() => onOpen(book.bookId)} />)}
          </Box>
          {query.hasNextPage && <Stack sx={{ alignItems: "center", mt: 4 }}><Button variant="outlined" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "正在展开…" : "加载更多"}</Button></Stack>}
        </>
      )}
    </>
  );
}

function AnnotationBookCard({ book, onOpen }: { book: AnnotationBookSummary; onOpen: () => void }) {
  return (
    <Card variant="outlined" sx={{ overflow: "hidden", transition: "transform 150ms ease, box-shadow 150ms ease", "&:hover": { transform: "translateY(-2px)", boxShadow: tokens.shadow.cover } }}>
      <CardActionArea onClick={onOpen} aria-label={`查看《${book.bookTitle}》的阅读札记`} sx={{ height: "100%", alignItems: "stretch" }}>
        <Stack direction="row" sx={{ minHeight: 188 }}>
          <Box sx={{ width: { xs: tokens.spacing[24], sm: 126 }, flexShrink: 0, display: "flex", alignItems: "center", p: `${tokens.spacing[2]}px` }}>
            <BookCover src={book.coverUrl} alt={`${book.bookTitle}封面`} />
          </Box>
          <CardContent sx={{ minWidth: 0, flex: 1, p: { xs: 2, sm: 2.5 }, display: "flex", flexDirection: "column" }}>
            <Typography variant="h4" title={book.bookTitle} sx={{ mb: 0.5, fontSize: { xs: tokens.typography.fontSize.title, sm: tokens.typography.fontSize.headingSm } }} noWrap>{book.bookTitle}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{book.bookAuthor}</Typography>
            <Stack direction="row" useFlexGap sx={{ mt: 2, flexWrap: "wrap", gap: 0.75 }}>
              <Chip size="small" label={`${book.annotationCount} 条批注`} />
              {book.noteCount > 0 && <Chip size="small" variant="outlined" label={`${book.noteCount} 条阅读札记`} />}
            </Stack>
            <Typography variant="caption" color="text.disabled" sx={{ mt: "auto", pt: 2 }}>最近记录于 {formatDate(book.latestAt)}</Typography>
          </CardContent>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function BookAnnotations({ bookId, userId }: { bookId: string; userId: string }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState<"DOCX" | "XLSX" | null>(null);
  const [notice, setNotice] = useState("");
  const bookQuery = useQuery({ queryKey: ["book", bookId, userId], queryFn: () => api.getBook(bookId), enabled: userId !== "anonymous" });
  const annotationsQuery = useQuery({ queryKey: ["annotations", bookId, userId], queryFn: () => api.listAnnotations(bookId), enabled: userId !== "anonymous" });
  const annotations = useMemo(() => (annotationsQuery.data ?? [])
    .filter((annotation) => annotation.type !== "BOOKMARK")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [annotationsQuery.data]);

  const exportFile = async (format: "DOCX" | "XLSX") => {
    try {
      setExporting(format);
      const filename = await api.downloadAnnotationExport(bookId, format);
      setNotice(`已导出 ${filename}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(null);
    }
  };

  if (bookQuery.isPending || annotationsQuery.isPending) return <Loading label="正在加载读书札记" />;
  if (bookQuery.isError || !bookQuery.data || annotationsQuery.isError) return <Alert severity="error">无法读取这本书的阅读札记</Alert>;
  const book = bookQuery.data;

  return (
    <>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "flex-end" }, gap: 3, mb: 4 }}>
        <Stack direction="row" spacing={2.5} sx={{ alignItems: "center", minWidth: 0 }}>
          <BookCover src={book.coverUrl} alt={`${book.title}封面`} sx={{ width: `${tokens.spacing[20]}px` }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="h4" sx={{ fontSize: { xs: tokens.typography.fontSize.title, sm: tokens.typography.fontSize.headingSm } }}>{book.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>{book.author} · {annotations.length} 条批注</Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
          <Button variant="outlined" onClick={() => navigate(`/reader/${bookId}`)}>返回原文</Button>
          <Button variant="outlined" disabled={Boolean(exporting)} onClick={() => void exportFile("DOCX")}>{exporting === "DOCX" ? "正在生成…" : "导出 Word"}</Button>
          <Button variant="outlined" disabled={Boolean(exporting)} onClick={() => void exportFile("XLSX")}>{exporting === "XLSX" ? "正在生成…" : "导出 Excel"}</Button>
        </Stack>
      </Stack>

      {annotations.length === 0 ? (
        <BookCatalogEmptyState title={EMPTY_READING_NOTES_TITLE} />
      ) : (
        <Stack spacing={2}>
          {annotations.map((annotation, index) => <AnnotationEntry key={annotation.id} annotation={annotation} index={annotations.length - index} />)}
        </Stack>
      )}
      <Snackbar open={Boolean(notice)} autoHideDuration={4200} onClose={() => setNotice("")} message={notice} />
    </>
  );
}

function AnnotationEntry({ annotation, index }: { annotation: Annotation; index: number }) {
  return (
    <Box component="article" sx={{ p: { xs: 2.5, md: 4 }, bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 3 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="caption" color="text.disabled">{String(index).padStart(2, "0")}</Typography>
          <Chip label={annotationLabel(annotation)} size="small" variant={annotation.type === "NOTE" ? "filled" : "outlined"} />
        </Stack>
        <Typography variant="caption" color="text.disabled">{formatDate(annotation.createdAt)}</Typography>
      </Stack>
      {annotation.quote && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 2.5, alignItems: "flex-start" }}>
          <FormatQuoteRounded sx={{ color: annotationColorHex(annotation.color), flexShrink: 0 }} />
          <Typography sx={{ fontFamily: tokens.typography.fontFamily.display, fontSize: { xs: 17, md: 19 }, lineHeight: 1.85 }}>
            <Box component="span" sx={quoteStyle(annotation)}>{annotation.quote}</Box>
          </Typography>
        </Stack>
      )}
      {annotation.note && <Box sx={{ mt: 2.5, ml: { xs: 0, sm: 5 }, p: 2, bgcolor: "background.default", borderRadius: 2 }}><Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>我的阅读札记</Typography><Typography>{annotation.note}</Typography></Box>}
      <Button component={Link} to={`/reader/${encodeURIComponent(annotation.bookId)}${annotation.locator ? `?locator=${encodeURIComponent(annotation.locator)}` : ""}`} sx={{ mt: `${tokens.spacing[4]}px` }}>返回原文</Button>
    </Box>
  );
}

function quoteStyle(annotation: Annotation): SxProps<Theme> {
  const style = annotation.style;
  if (style === "HIGHLIGHT") return { bgcolor: annotationColorBackground(annotation.color), borderRadius: "var(--radius-md)", boxDecorationBreak: "clone" };
  if (style === "UNDERLINE") return { textDecoration: "underline", textDecorationColor: annotationColorHex(annotation.color), textDecorationThickness: "3px", textUnderlineOffset: "4px", textDecorationSkipInk: "none", boxDecorationBreak: "clone" };
  return { fontWeight: 700, boxDecorationBreak: "clone" };
}

function annotationLabel(annotation: Annotation) {
  if (annotation.type === "NOTE") return "高亮笔记";
  return ({ HIGHLIGHT: "高亮", UNDERLINE: "下划线", BOLD: "加粗" } satisfies Record<AnnotationStyle, string>)[annotation.style];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

function Loading({ label }: { label: string }) {
  return <Stack role="status" aria-label={label} sx={{ py: 10, alignItems: "center", gap: `${tokens.spacing[2]}px` }}><CircularProgress /><Typography color="text.secondary">{label}</Typography></Stack>;
}
