// 按文章分组展示当前用户的独立阅读札记，只提供回到原文的定位链接。
// Groups the current user's independent article notes and links back to their exact source locations.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, Chip, CircularProgress } from "@/ui/feedback";
import { Box, CardActionArea, CardContent, Stack, Typography } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Card } from "@/ui/cards";
import { BookCatalogEmptyState } from "../../components/BookCatalogEmptyState";
import { annotationColorBackground, annotationColorHex } from "../../domain/annotation-colors";
import type { Entry } from "../content/api";
import { articleNotesApi, type ArticleNoteGroup } from "./api";
import { tokens } from "../../theme/generated-tokens";
import { Dropdown } from "../../ui/antd";
import { collectNotes, downloadNotes } from "./note-records";

export function ArticleNotes({
  userId,
  articleId,
  onOpen,
}: {
  userId: string;
  articleId?: string;
  onOpen: (articleId: string) => void;
}) {
  const query = useQuery({
    queryKey: ["article-notes", userId],
    queryFn: articleNotesApi.list,
    enabled: userId !== "anonymous",
  });
  const articles = useMemo(() => (query.data ?? [])
    .map((article) => ({ ...article, annotations: sortEntries(article.annotations) }))
    .filter((article) => article.annotations.length > 0)
    .sort((left, right) => right.annotations[0].createdAt.localeCompare(left.annotations[0].createdAt)), [query.data]);

  if (query.isPending) return <Loading />;
  if (query.isError) return <Alert severity="error">无法读取阅文札记</Alert>;
  if (articleId) {
    const article = articles.find((item) => item.articleId === articleId);
    return article ? <ArticleNoteDetail article={article} /> : <Alert severity="error">无法找到这篇文章的笔记</Alert>;
  }
  if (articles.length === 0) return <BookCatalogEmptyState title="暂无阅文札记" />;

  return (
    <Box component="section" aria-label="阅文札记列表" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: `${tokens.spacing[5]}px` }}>
      {articles.map((article) => <ArticleNoteCard key={article.articleId} article={article} onOpen={() => onOpen(article.articleId)} />)}
    </Box>
  );
}

function ArticleNoteCard({ article, onOpen }: { article: ArticleNoteGroup; onOpen: () => void }) {
  const [failedCover, setFailedCover] = useState(false);
  const cover = article.coverUrl && !failedCover ? (
    <Box component="img" src={article.coverUrl} alt={`${article.title}封面`} loading="lazy" decoding="async" onError={() => setFailedCover(true)} sx={{ display: "block", width: "100%", aspectRatio: "2.35 / 1", objectFit: "cover", bgcolor: "background.default" }} />
  ) : (
    <Stack role="img" aria-label={`${article.title}暂无封面`} sx={{ width: "100%", aspectRatio: "2.35 / 1", bgcolor: "background.default", alignItems: "center", justifyContent: "center" }}>
      <Typography variant="body2" color="text.secondary">阅文札记</Typography>
    </Stack>
  );

  return (
    <Card variant="outlined" sx={{ overflow: "hidden", height: "100%" }}>
      <CardActionArea onClick={onOpen} aria-label={`查看《${article.title}》的阅文札记`} sx={{ height: "100%", alignItems: "stretch" }}>
        {cover}
        <CardContent sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: `${tokens.spacing[2]}px` }}>
          <Typography component="h2" variant="h5" title={article.title} noWrap>{article.title}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{article.author || "未知作者"}</Typography>
          <Stack direction="row" sx={{ mt: `${tokens.spacing[2]}px` }}>
            <Chip size="small" label={`${article.annotations.length} 条笔记`} />
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function ArticleNoteDetail({ article }: { article: ArticleNoteGroup }) {
  const [failedCover, setFailedCover] = useState(false);
  const cover = article.coverUrl && !failedCover ? (
    <Box component="img" src={article.coverUrl} alt={`${article.title}封面`} onError={() => setFailedCover(true)} sx={{ display: "block", width: "100%", maxWidth: `${tokens.layout.annotationCardMinWidth}px`, aspectRatio: "2.35 / 1", objectFit: "cover", borderRadius: `${tokens.radius.lg}px` }} />
  ) : null;

  return (
    <>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ alignItems: { xs: "stretch", md: "flex-end" }, gap: `${tokens.spacing[5]}px`, mb: `${tokens.spacing[6]}px` }}>
        {cover}
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" variant="h4" sx={{ fontSize: { xs: tokens.typography.fontSize.title, sm: tokens.typography.fontSize.headingSm }, overflowWrap: "anywhere" }}>{article.title}</Typography>
          <Typography color="text.secondary" sx={{ mt: `${tokens.spacing[2]}px` }}>{article.author || "未知作者"} · {article.annotations.length} 条笔记</Typography>
        </Box>
        <Dropdown trigger={["click"]} menu={{ items: [{ key: "md", label: "Markdown" }, { key: "csv", label: "CSV 表格" }], onClick: ({ key }) => downloadNotes(collectNotes([], [article]), key as "md" | "csv") }}><Button variant="outlined">导出笔记</Button></Dropdown>
      </Stack>
      <Stack component="section" aria-label={`${article.title}的阅文札记`} sx={{ gap: `${tokens.spacing[4]}px` }}>
        {article.annotations.map((entry, index) => <ArticleAnnotationEntry key={entry.id} entry={entry} index={article.annotations.length - index} articleId={article.articleId} />)}
      </Stack>
    </>
  );
}

function ArticleAnnotationEntry({ entry, index, articleId }: { entry: Entry; index: number; articleId: string }) {
  const sourceHref = `/articles/${encodeURIComponent(articleId)}?locator=${encodeURIComponent(entry.locator)}`;
  return (
    <Box component="article" sx={{ p: { xs: `${tokens.spacing[4]}px`, md: `${tokens.spacing[6]}px` }, bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px` }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: `${tokens.spacing[3]}px` }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: `${tokens.spacing[2]}px` }}>
          <Typography variant="caption" color="text.disabled">{String(index).padStart(2, "0")}</Typography>
          <Chip label={entryLabel(entry)} size="small" variant={entry.type === "NOTE" ? "filled" : "outlined"} />
        </Stack>
        <Typography variant="caption" color="text.disabled">{formatDate(entry.createdAt)}</Typography>
      </Stack>
      {entry.quote && <Typography component="p" sx={{ mt: `${tokens.spacing[4]}px`, fontFamily: tokens.typography.fontFamily.display, fontSize: { xs: tokens.typography.fontSize.titleSm, md: tokens.typography.fontSize.title }, lineHeight: 1.85 }}><Box component="span" sx={quoteStyle(entry)}>{entry.quote}</Box></Typography>}
      {entry.note && <Box sx={{ mt: `${tokens.spacing[4]}px`, p: `${tokens.spacing[3]}px`, bgcolor: "background.default", borderRadius: `${tokens.radius.md}px` }}><Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: `${tokens.spacing[1]}px` }}>我的阅文札记</Typography><Typography>{entry.note}</Typography></Box>}
      <Button component={Link} to={sourceHref} variant="outlined" sx={{ mt: `${tokens.spacing[4]}px`, minHeight: `${tokens.spacing[10]}px` }}>返回原文</Button>
    </Box>
  );
}

function sortEntries(entries: Entry[]) {
  return entries.filter((entry) => entry.type !== "BOOKMARK").sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function quoteStyle(entry: Entry) {
  if (entry.style === "HIGHLIGHT") return { bgcolor: annotationColorBackground(entry.color), borderRadius: "var(--radius-md)", boxDecorationBreak: "clone" as const };
  if (entry.style === "UNDERLINE") return { textDecoration: "underline", textDecorationColor: annotationColorHex(entry.color), textDecorationThickness: "3px", textUnderlineOffset: "4px", textDecorationSkipInk: "none", boxDecorationBreak: "clone" as const };
  if (entry.style === "BOLD") return { fontWeight: 700, boxDecorationBreak: "clone" as const };
  return {};
}

function entryLabel(entry: Entry) {
  if (entry.type === "NOTE") return "阅读札记";
  if (entry.style === "UNDERLINE") return "下划线";
  if (entry.style === "BOLD") return "加粗";
  return "高亮";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

function Loading() {
  return <Stack role="status" aria-label="正在加载阅文札记" sx={{ py: 10, alignItems: "center", gap: `${tokens.spacing[2]}px` }}><CircularProgress /><Typography color="text.secondary">正在加载阅文札记</Typography></Stack>;
}
