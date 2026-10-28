import { RequestErrorPage } from "./HttpErrorPage";
import { usePermissions } from "../auth/permissions";
import { AiAssistantButton } from "../features/ai/AiAssistant";
import { BookReviewsPanel } from "../features/reviews/BookReviewsPanel";
import { BookMetadataLayout, bookMetadataFieldsSx, bookMetadataTitleSx } from "../components/BookMetadataLayout";
import { BookMetadataEditor } from "../components/BookMetadataEditor";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AddToBooklistDialog } from "../components/AddToBooklistDialog";
import { FileOperationDialog } from "../components/FileOperationDialog";
import { PageBackAction, PageContainer, PageHeader } from "../components/PageHeader";
import type { BookMetadata } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { Skeleton } from "../ui/antd";
import { Button } from "../ui/buttons";
import { Alert, Chip, Divider } from "../ui/feedback";
import { Box, Snackbar, Stack, Typography, type UiTheme } from "../ui/primitives";
import { useFeedback } from "../ui/notifications";
import { themaPath } from "../domain/thema";
import { formatLanguages } from "../domain/languages";
import { formatPublicationDate } from "../domain/publication-date";

// 详情页原位编辑书目资料，文件写操作继续使用现有安全预览流程。
// Book details edit bibliography in place while retaining safe file-operation previews.
export function BookDetailPage() {
  const { bookId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [fileOperation, setFileOperation] = useState<"RENAME" | "TRASH" | null>(null);
  const feedback = useFeedback();
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["book", bookId, user?.id], queryFn: () => api.getBook(bookId) });
  const metadataQuery = useQuery({ queryKey: ["book-metadata", bookId], queryFn: () => api.getBookMetadata(bookId) });
  const previousPath = location.state?.bookReturnTo;
  const returnTo = typeof previousPath === "string" && /^\/library(?:\/all)?(?:[?#]|$)/.test(previousPath) ? previousPath : "/library/all";
  const { can } = usePermissions();
  const book = query.data;
  const metadata = metadataQuery.data;
  const title = metadata?.title || book?.title || "";
  const author = metadata?.authors.join(" / ") || book?.author;
  const sourceQuery = useQuery({ queryKey: ["book-bibliography-source", bookId], queryFn: ({ signal }) => api.getBookBibliographySource(bookId, signal),
    enabled: Boolean(metadata && book?.status === "AVAILABLE" && (
      (!metadata.tableOfContents && metadata.sources.tableOfContents !== "MANUAL")
      || (!metadata.authorBiography && metadata.sources.authorBiography !== "MANUAL")
    )), retry: false, staleTime: 300000 });
  const knowledgeQuery = useQuery({
    queryKey: ["book-knowledge-draft", bookId], queryFn: ({ signal }) => api.getBookKnowledge(bookId, signal),
    enabled: Boolean(book) && can("knowledge.view"), retry: false,
  });
  const description = metadata ? metadata.description : book?.description;
  const contents = metadata?.tableOfContents || (metadata?.sources.tableOfContents === "MANUAL" ? undefined : sourceQuery.data?.tableOfContents);
  const authorBiography = metadata?.authorBiography || (metadata?.sources.authorBiography === "MANUAL" ? undefined : sourceQuery.data?.authorBiography);

  if (query.isError && !query.data) return <RequestErrorPage error={query.error} retrying={query.isFetching} onRetry={() => void query.refetch()} back={<PageBackAction onClick={() => navigate(returnTo)}>返回书库</PageBackAction>} />;
  return <PageContainer>
    <PageBackAction onClick={() => navigate(returnTo)}>返回书库</PageBackAction>
    <PageHeader eyebrow="BOOK DETAILS" title="书籍详情" />
    {query.isPending ? <div role="status" aria-label="正在加载书籍详情"><Skeleton active paragraph={{ rows: 8 }} /></div>
      : query.isError || !book ? <Stack spacing={2}>
        <Alert severity="error">无法加载书籍信息，书籍可能已移除或暂时无法访问。</Alert>
        <Button variant="outlined" onClick={() => void query.refetch()}>重试</Button>
      </Stack> : <>
        {editingBookId === book.id && can("library.edit") ? <BookMetadataEditor
          key={book.id}
          book={book}
          layout="detail"
          bibliographyFallback={{ authorBiography: sourceQuery.data?.authorBiography, tableOfContents: sourceQuery.data?.tableOfContents }}
          onClose={() => setEditingBookId(null)}
          onCompleted={setNotice}
          onSavedImmediately={setNotice}
          onSaveFailed={message => feedback?.error({ title: message, duration: 0 })}
        /> : <BookMetadataLayout coverUrl={metadata?.coverUrl || book.coverUrl} coverAlt={`${title}封面`}>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: `${tokens.spacing[2]}px` }}>
              <Chip label={book.format} variant="outlined" size="small" />
            </Stack>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h2" component="h2" sx={bookMetadataTitleSx}>{title}</Typography>
              {metadata?.subtitle && <Typography sx={{ mt: `${tokens.spacing[2]}px`, overflowWrap: "anywhere" }}>{metadata.subtitle}</Typography>}
              <Typography color="text.secondary" sx={{ mt: `${tokens.spacing[2]}px`, overflowWrap: "anywhere" }}>{author}</Typography>
            </Box>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: `${tokens.spacing[3]}px` }}>
              <Button variant="contained" disabled={!can("reader.read") || book.status !== "AVAILABLE"} onClick={() => navigate(`/reader/${book.id}`)}>{book.progress > 0 ? "继续阅读" : "开始阅读"}</Button>
              {can("reader.read") && book.status === "AVAILABLE" && <Button component="a" variant="outlined" href={`/api/v1/books/${encodeURIComponent(book.id)}/content`} download={`${title}.${book.format.toLowerCase()}`}>下载原书</Button>}
              <Button variant="outlined" disabled={!can("booklists.edit") || book.status !== "AVAILABLE"} onClick={() => setAdding(true)}>加入书目</Button>
              {can("reader.read") && book.status === "AVAILABLE" && <AiAssistantButton source="BOOK" id={book.id} />}
                {can("library.edit") && <Button variant="outlined" disabled={metadataQuery.isPending || metadataQuery.isError} onClick={() => setEditingBookId(book.id)}>编辑元信息</Button>}
                {!can("library.edit") && can("library.files") && <Button variant="outlined" onClick={() => setFileOperation("RENAME")}>重命名原文件</Button>}
                {can("library.trash") && <Button variant="outlined" color="error" disabled={book.status === "TRASHED"} onClick={() => setFileOperation("TRASH")}>删除书籍</Button>}
            </Stack>
            {book.status !== "AVAILABLE" && <Alert severity="warning">这本书暂时无法阅读。</Alert>}
            <Divider />
            <Box component="section" aria-labelledby="book-bibliography-title">
              <Typography id="book-bibliography-title" variant="h5" component="h3" sx={{ mb: `${tokens.spacing[4]}px` }}>书目资料</Typography>
              {metadataQuery.isPending ? <div role="status" aria-label="正在加载元数据"><Skeleton active paragraph={{ rows: 5 }} /></div>
                : metadataQuery.isError || !metadata ? <Stack role="alert" spacing={2} sx={{ alignItems: "flex-start" }}><Typography color="error.main">书目资料暂时无法加载。</Typography><Button variant="outlined" disabled={metadataQuery.isFetching} onClick={() => void metadataQuery.refetch()}>重试元数据</Button></Stack>
                : <MetadataFields metadata={metadata} />}
            </Box>
            {can("knowledge.view") && <Box component="section" aria-label="知识点">
              <Typography variant="caption" color="text.muted">知识点</Typography>
              {knowledgeQuery.isPending ? <Typography role="status" variant="caption">正在读取知识点…</Typography>
                : knowledgeQuery.isError ? <Alert severity="error" action={<Button onClick={() => void knowledgeQuery.refetch()}>重试知识点</Button>}>知识点暂时无法读取。</Alert>
                : (metadata?.knowledgeTerms?.length || knowledgeQuery.data?.points.length) ? <Stack direction="row" sx={{ flexWrap: "wrap", gap: `${tokens.spacing[2]}px` }}>
                  {[...new Map([...(metadata?.knowledgeTerms ?? []), ...(knowledgeQuery.data?.points ?? []).map(point => point.name)].map(name => [name.normalize("NFKC").trim().toLocaleLowerCase(), name])).values()].map(name => <Chip key={name} label={name} />)}
                </Stack> : <Typography color="text.muted">—</Typography>}
            </Box>}
            <Box component="section" aria-labelledby="book-description-title"><Typography id="book-description-title" variant="h5" component="h3" sx={{ mb: `${tokens.spacing[3]}px` }}>内容简介</Typography><Typography color={description ? "text.primary" : "text.muted"} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{description || "—"}</Typography></Box>
            <Box component="section" aria-label="作者介绍"><Typography variant="h5" component="h3" sx={{ mb: `${tokens.spacing[3]}px` }}>作者介绍</Typography><Typography color={authorBiography ? "text.primary" : "text.muted"} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{authorBiography || "—"}</Typography></Box>
            <Box component="section" aria-label="书籍目录">{sourceQuery.isFetching && <Typography role="status" variant="caption">正在读取原书目录…</Typography>}{sourceQuery.isError && <Alert severity="warning" action={<Button onClick={() => void sourceQuery.refetch()}>重试目录</Button>}>原书目录暂时无法读取。</Alert>}<Typography variant="h5" component="h3" sx={{ mb: `${tokens.spacing[3]}px` }}>目录</Typography><Typography color={contents ? "text.primary" : "text.muted"} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{contents || "—"}</Typography></Box>
        </BookMetadataLayout>}
        <BookReviewsPanel key={`${book.id}:${user?.id}`} bookId={book.id} bookTitle={book.title} />
        <AddToBooklistDialog open={adding} bookId={book.id} bookTitle={book.title} onClose={() => setAdding(false)} onCompleted={message => { setAdding(false); setNotice(message); }} />
        {(can("library.files") || can("library.trash")) && <FileOperationDialog book={fileOperation ? book : null} type={fileOperation} onClose={() => setFileOperation(null)} onCompleted={result => {
          void queryClient.invalidateQueries({ queryKey: ["book", bookId] });
          void queryClient.invalidateQueries({ queryKey: ["books"] });
          void queryClient.invalidateQueries({ queryKey: ["recycle-bin"] });
          void queryClient.invalidateQueries({ queryKey: ["display-books"] });
          void queryClient.invalidateQueries({ queryKey: ["file-operations"] });
          if (result.type === "TRASH" && ["SUCCEEDED", "PLANNED", "RUNNING"].includes(result.status)) {
            const message = result.status === "SUCCEEDED" ? "书籍已移入回收站" : "删除任务已提交，可在文件任务页查看进度";
            feedback?.[result.status === "SUCCEEDED" ? "success" : "info"]({ title: message });
            navigate(returnTo, { replace: true });
          } else {
            setNotice(result.status === "SUCCEEDED" ? "文件任务已完成" : "文件任务已提交");
          }
        }} />}
      </>}
    <Snackbar open={Boolean(notice)} message={notice} autoHideDuration={4500} onClose={() => setNotice("")} />
  </PageContainer>;
}

function MetadataFields({ metadata }: { metadata: BookMetadata }) {
  const subjects = metadata.subjectCodes ?? [];
  return <DetailFields fields={[
    ["译者", metadata.translators.join(" / ")],
    ["出版社", metadata.publisher],
    ["出版日期", formatPublicationDate(metadata.publishedDate)], ["ISBN", metadata.isbn],
    ["语言", formatLanguages(metadata.language)], ["系列", metadata.series], ["系列序号", metadata.seriesIndex?.toString()],
    ["公开展示", metadata.publiclyVisible === undefined ? undefined : metadata.publiclyVisible ? "已公开" : "仅书库内可见"],
    ["标签", metadata.tags.join("、")], ["学科分类", subjects.length ? <Stack spacing={1} sx={(theme: UiTheme) => ({ "& a": { color: theme.palette.mode === "dark" ? theme.palette.primary.main : theme.palette.primary.dark } })}>{subjects.map(code => <Link key={code} to={`/library?advanced=1&subject=${encodeURIComponent(code)}`}>{themaPath(code)}</Link>)}</Stack> : undefined],
  ]} />;
}

function DetailFields({ fields }: { fields: [string, ReactNode][] }) {
  return <Box component="dl" sx={{ ...bookMetadataFieldsSx, m: 0 }}>
    {fields.map(([label, value]) => <Box key={label} sx={{ minWidth: 0 }}><Typography component="dt" variant="caption" color="text.muted">{label}</Typography><Typography component="dd" color={value ? "text.primary" : "text.muted"} sx={{ m: 0, overflowWrap: "anywhere" }}>{value || "—"}</Typography></Box>)}
  </Box>;
}
