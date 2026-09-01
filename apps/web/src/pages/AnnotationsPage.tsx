import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import FormatQuoteRounded from "@mui/icons-material/FormatQuoteRounded";
import GridOnRounded from "@mui/icons-material/GridOnRounded";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import NotesOutlined from "@mui/icons-material/NotesOutlined";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { PageContainer, PageHeader } from "../components/PageHeader";
import { annotationColorBackground, annotationColorHex } from "../domain/annotation-colors";
import type { Annotation, AnnotationBookSummary, AnnotationStyle } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function AnnotationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBookId = searchParams.get("bookId");
  if (selectedBookId) {
    return <BookAnnotations bookId={selectedBookId} onBack={() => {
      const next = new URLSearchParams(searchParams);
      next.delete("bookId");
      setSearchParams(next);
    }} />;
  }
  return <AnnotationBooks onOpen={(bookId) => {
    const next = new URLSearchParams(searchParams);
    next.set("bookId", bookId);
    setSearchParams(next);
  }} />;
}

function AnnotationBooks({ onOpen }: { onOpen: (bookId: string) => void }) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const query = useInfiniteQuery({
    queryKey: ["annotation-books", deferredSearch],
    queryFn: ({ pageParam }) => api.listAnnotationBooks({ q: deferredSearch || undefined, cursor: pageParam, limit: 36 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const books = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <PageContainer>
      <PageHeader eyebrow="阅读笔记" title="阅读笔记" description="按书籍整理高亮、下划线、加粗与阅读笔记；所有内容仅当前账户可见。" />
      <TextField
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="搜索做过阅读笔记的书或作者"
        aria-label="搜索阅读笔记书籍"
        sx={{ width: "100%", maxWidth: 560, mb: 4 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }}
      />
      {query.isPending ? <Loading /> : query.isError ? <Alert severity="error">无法读取阅读笔记书目</Alert> : books.length === 0 ? (
        <Stack spacing={1} sx={{ py: 12, alignItems: "center", textAlign: "center" }}>
          <NotesOutlined sx={{ fontSize: 46, color: "text.disabled" }} />
          <Typography variant="h4">{deferredSearch ? "没有找到相关书籍" : "还没有留下阅读笔记"}</Typography>
          <Typography color="text.secondary">{deferredSearch ? "换一个书名或作者关键词试试。" : "在阅读器中选择文字，即可划线并写下想法。"}</Typography>
        </Stack>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2.5 }}>
            {books.map((book) => <AnnotationBookCard key={book.bookId} book={book} onOpen={() => onOpen(book.bookId)} />)}
          </Box>
          {query.hasNextPage && <Stack sx={{ alignItems: "center", mt: 4 }}><Button variant="outlined" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "正在展开…" : "加载更多书籍"}</Button></Stack>}
        </>
      )}
    </PageContainer>
  );
}

function AnnotationBookCard({ book, onOpen }: { book: AnnotationBookSummary; onOpen: () => void }) {
  return (
    <Card variant="outlined" sx={{ overflow: "hidden", transition: "transform 150ms ease, box-shadow 150ms ease", "&:hover": { transform: "translateY(-2px)", boxShadow: tokens.shadow.cover } }}>
      <CardActionArea onClick={onOpen} aria-label={`查看《${book.bookTitle}》的阅读笔记`} sx={{ height: "100%", alignItems: "stretch" }}>
        <Stack direction="row" sx={{ minHeight: 188 }}>
          <Box sx={{ width: 126, flexShrink: 0, bgcolor: "primary.light", position: "relative", overflow: "hidden" }}>
            <Box component="img" src={book.coverUrl} alt={`${book.bookTitle}封面`} sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </Box>
          <CardContent sx={{ minWidth: 0, flex: 1, p: 2.5, display: "flex", flexDirection: "column" }}>
            <Typography variant="h4" sx={{ mb: 0.5 }} noWrap>{book.bookTitle}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{book.bookAuthor}</Typography>
            <Stack direction="row" useFlexGap sx={{ mt: 2, flexWrap: "wrap", gap: 0.75 }}>
              <Chip size="small" label={`${book.annotationCount} 条批注`} />
              {book.noteCount > 0 && <Chip size="small" variant="outlined" label={`${book.noteCount} 条阅读笔记`} />}
            </Stack>
            <Typography variant="caption" color="text.disabled" sx={{ mt: "auto", pt: 2 }}>最近记录于 {formatDate(book.latestAt)}</Typography>
          </CardContent>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function BookAnnotations({ bookId, onBack }: { bookId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState<"DOCX" | "XLSX" | null>(null);
  const [notice, setNotice] = useState("");
  const bookQuery = useQuery({ queryKey: ["book", bookId], queryFn: () => api.getBook(bookId) });
  const annotationsQuery = useQuery({ queryKey: ["annotations", bookId], queryFn: () => api.listAnnotations(bookId) });
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

  if (bookQuery.isPending || annotationsQuery.isPending) return <PageContainer><Loading /></PageContainer>;
  if (bookQuery.isError || !bookQuery.data || annotationsQuery.isError) return <PageContainer><Alert severity="error">无法读取这本书的阅读笔记</Alert></PageContainer>;
  const book = bookQuery.data;

  return (
    <PageContainer>
      <Button color="inherit" startIcon={<ArrowBackRounded />} onClick={onBack} sx={{ mb: 2, px: 0 }}>全部阅读笔记书籍</Button>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "flex-end" }, gap: 3, mb: 4 }}>
        <Stack direction="row" spacing={2.5} sx={{ alignItems: "center", minWidth: 0 }}>
          <Box component="img" src={book.coverUrl} alt={`${book.title}封面`} sx={{ width: 82, height: 116, objectFit: "cover", borderRadius: 1.5, boxShadow: tokens.shadow.cover }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h2" component="h1">{book.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>{book.author} · {annotations.length} 条批注</Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
          <Button variant="text" startIcon={<MenuBookOutlined />} onClick={() => navigate(`/reader/${bookId}`)}>回到书中</Button>
          <Button variant="outlined" startIcon={<DescriptionOutlined />} disabled={Boolean(exporting)} onClick={() => void exportFile("DOCX")}>{exporting === "DOCX" ? "正在生成…" : "导出 Word"}</Button>
          <Button variant="outlined" startIcon={<GridOnRounded />} disabled={Boolean(exporting)} onClick={() => void exportFile("XLSX")}>{exporting === "XLSX" ? "正在生成…" : "导出 Excel"}</Button>
        </Stack>
      </Stack>

      {annotations.length === 0 ? <Alert severity="info">这本书还没有阅读笔记或划线。</Alert> : (
        <Stack spacing={2}>
          {annotations.map((annotation, index) => <AnnotationEntry key={annotation.id} annotation={annotation} index={annotations.length - index} />)}
        </Stack>
      )}
      <Snackbar open={Boolean(notice)} autoHideDuration={4200} onClose={() => setNotice("")} message={notice} />
    </PageContainer>
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
      {annotation.note && <Box sx={{ mt: 2.5, ml: { xs: 0, sm: 5 }, p: 2, bgcolor: "background.default", borderRadius: 2 }}><Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>我的阅读笔记</Typography><Typography>{annotation.note}</Typography></Box>}
    </Box>
  );
}

function quoteStyle(annotation: Annotation): SxProps<Theme> {
  const style = annotation.style;
  if (style === "HIGHLIGHT") return { bgcolor: annotationColorBackground(annotation.color), borderRadius: "2px", boxDecorationBreak: "clone" };
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

function Loading() {
  return <Stack sx={{ py: 10, alignItems: "center" }}><CircularProgress /></Stack>;
}
