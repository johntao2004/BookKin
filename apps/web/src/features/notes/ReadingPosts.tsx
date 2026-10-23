import { usePermissions } from "../../auth/permissions";
import { AiAssistantButton } from "../ai/AiAssistant";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { BookCatalogEmptyState } from "../../components/BookCatalogEmptyState";
import { BookCardPresentation } from "../../components/BookCardPresentation";
import { articleGridSx } from "../../components/bookGrid";
import { PageBackAction, PageContainer, PageHeader } from "../../components/PageHeader";
import { tokens } from "../../theme/generated-tokens";
import { Skeleton } from "../../ui/antd";
import { Button } from "../../ui/buttons";
import { Alert, Chip } from "../../ui/feedback";
import { Select, TextField } from "../../ui/forms";
import { Drawer } from "../../ui/overlays";
import { Box, MenuItem, Stack, Typography } from "../../ui/primitives";
import { articles } from "../content/api";
import { reviewMarkdownToHtml } from "../reviews/markdown";
import { postHref, postLabels, postSections, readingPosts, type PostDraft, type PostFilter, type PostKind, type ReadingPost } from "./posts-api";
import "../content/content.css";
import "./notes.css";

const proseClass = "bk-content-prose bk-markdown-prose bk-article-markdown-preview";
const date = (value: string) => new Date(value).toLocaleDateString("zh-CN");
function plainExcerpt(markdown: string) {
  return new DOMParser().parseFromString(reviewMarkdownToHtml(markdown), "text/html").body.textContent?.replace(/\s+/gu, " ").trim() ?? "";
}

export function usePostCollection(kind: PostFilter, enabled = true) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["reading-posts", user?.id, kind],
    queryFn: ({ pageParam }) => readingPosts.list(kind, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(user) && enabled,
  });
}

export function PostCard({ post }: { post: ReadingPost }) {
  const { user } = useAuth();
  const book = useQuery({ queryKey: ["book", post.sourceId, user?.id], queryFn: () => api.getBook(post.sourceId), enabled: post.kind === "BOOK" && post.sourceTitle !== "原文不可用", retry: false });
  const articleList = useQuery({ queryKey: ["post-source-articles", user?.id], queryFn: articles.list, enabled: post.kind === "ARTICLE" });
  const coverUrl = post.kind === "BOOK" ? book.data?.coverUrl : articleList.data?.find(article => article.id === post.sourceId)?.cover_url;
  return <BookCardPresentation variant="article" href={postHref(post)} book={{ id: post.id, title: post.title, author: `${postLabels[post.kind]} · ${post.sourceTitle}`, coverUrl: coverUrl || undefined }} description={plainExcerpt(post.excerpt)} />;
}

export function ReadingPosts({ kind }: { kind: PostFilter }) {
  const query = usePostCollection(kind);
  const posts = query.data?.pages.flatMap(page => page.items) ?? [];
  return <>
    {query.isPending ? <Skeleton active /> : query.isError ? <Stack spacing={2} sx={{ alignItems: "flex-start" }}><Alert severity="error">无法加载博文</Alert><Button onClick={() => void query.refetch()}>重试</Button></Stack>
      : posts.length === 0 ? <BookCatalogEmptyState title="暂无博文" />
        : <Box component="section" aria-label="博文列表" sx={articleGridSx}>{posts.map(post => <PostCard key={`${post.kind}:${post.id}`} post={post} />)}</Box>}
    {query.hasNextPage && <Button sx={{ mt: `${tokens.spacing[6]}px` }} disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>加载更多</Button>}
  </>;
}

export function ReadingPostPage() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const { kind: routeKind, postId = "" } = useParams();
  const kind: PostKind = routeKind === "article" ? "ARTICLE" : "BOOK";
  const validKind = routeKind === "article" || routeKind === "book";
  const query = useQuery({ queryKey: ["reading-post", user?.id, kind, postId], queryFn: () => readingPosts.get(kind, postId), enabled: Boolean(user) && validKind });
  const [editing, setEditing] = useState(false);
  const html = useMemo(() => reviewMarkdownToHtml(query.data?.markdown ?? ""), [query.data?.markdown]);
  const post = query.data;
  const failed = !validKind || query.isError || (!query.isPending && !post);
  const returnTo = failed ? "/annotations" : `/annotations/${postSections[kind]}?view=posts`;
  return <PageContainer>
    <PageBackAction to={returnTo}>返回笔记</PageBackAction>
    {!validKind ? <Alert severity="error">未找到博文</Alert> : query.isPending ? <Skeleton active /> : query.isError || !post ? <Stack spacing={2} sx={{ alignItems: "flex-start" }}><PageHeader eyebrow="BLOG POST" title="无法读取博文" /></Stack> : <>
      <PageHeader eyebrow="BLOG POST" title={post.title} action={post.userId === user?.id && can("notes.edit") ? <Button variant="contained" onClick={() => setEditing(true)}>编辑</Button> : undefined} />
      <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", gap: `${tokens.spacing[3]}px`, mb: `${tokens.spacing[6]}px` }}>
        <Chip label={postLabels[kind]} size="small" variant="outlined" />
        <Button component={Link} to={kind === "BOOK" ? `/library/books/${post.sourceId}` : `/articles/${post.sourceId}`}>{post.sourceTitle}</Button>
        <Typography color="text.secondary" variant="body2">{post.authorName} · {date(post.updatedAt)} · {post.visibility === "PRIVATE" ? "仅自己" : "书库共享"}</Typography>
      </Stack>
      <Box component="article" aria-label="博文正文" className={proseClass} sx={{ maxWidth: `${tokens.layout.readingMax}px`, minWidth: 0, mx: "auto" }} dangerouslySetInnerHTML={{ __html: html }} />
      {editing && <PostEditor key={`${kind}:${post.id}`} saved={post} initialKind={kind} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
    </>}
  </PageContainer>;
}

export function PostEditor({ saved, initialKind, initialSourceId, sourceTitle, allowKindChange = false, onClose, onSaved, persist }: {
  saved?: ReadingPost; initialKind: PostKind; initialSourceId?: string; sourceTitle?: string; allowKindChange?: boolean; onClose: () => void; onSaved: (post: ReadingPost) => void;
  persist?: (draft: PostDraft) => Promise<ReadingPost>;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const formId = useId();
  const { can } = usePermissions();
  const [draft, setDraft] = useState<PostDraft>(() => ({ kind: saved?.kind ?? initialKind, sourceId: saved?.sourceId ?? initialSourceId ?? "", title: saved?.title ?? "", markdown: saved?.markdown ?? "", visibility: saved?.visibility ?? "PRIVATE" }));
  const [preview, setPreview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const sourceSearch = useDeferredValue(search.trim());
  const fixedSource = Boolean(initialSourceId);
  const selectedBook = useQuery({ queryKey: ["book", initialSourceId, user?.id], queryFn: () => api.getBook(initialSourceId!), enabled: fixedSource && !sourceTitle && initialKind === "BOOK" });
  const selectedArticle = useQuery({ queryKey: ["post-source-article", initialSourceId, user?.id], queryFn: () => articles.get(initialSourceId!), enabled: fixedSource && !sourceTitle && initialKind === "ARTICLE" });
  const sourceBooks = useQuery({ queryKey: ["post-source-books", user?.id, sourceSearch], queryFn: () => api.listBooks({ q: sourceSearch || undefined, limit: 30 }), enabled: !saved && !fixedSource && draft.kind === "BOOK" });
  const sourceArticles = useQuery({ queryKey: ["post-source-articles", user?.id], queryFn: articles.list, enabled: !saved && !fixedSource && draft.kind === "ARTICLE" });
  const sources = draft.kind === "BOOK" ? (sourceBooks.data?.items ?? []) : (sourceArticles.data ?? []).filter(article => `${article.title} ${article.author}`.toLocaleLowerCase().includes(sourceSearch.toLocaleLowerCase()));
  const sourceLoading = draft.kind === "BOOK" ? sourceBooks.isPending : sourceArticles.isPending;
  const sourceFailed = draft.kind === "BOOK" ? sourceBooks.isError : sourceArticles.isError;
  const html = useMemo(() => preview ? reviewMarkdownToHtml(draft.markdown) : "", [preview, draft.markdown]);
  const change = (patch: Partial<PostDraft>) => setDraft(current => ({ ...current, ...patch }));
  const save = async () => {
    if (busy) return;
    if (!draft.sourceId || !draft.title.trim() || !draft.markdown.trim()) { setFullscreen(false); setError("请选择原文，填写标题和正文。"); return; }
    setBusy(true); setError("");
    try {
      const post = persist ? await persist(draft) : saved ? await readingPosts.update(saved, draft) : await readingPosts.create(draft);
      queryClient.setQueryData(["reading-post", user?.id, post.kind, post.id], post);
      void queryClient.invalidateQueries({ queryKey: ["reading-posts", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["book-reviews", user?.id] });
      onSaved(post);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "博文保存失败。"); }
    finally { setBusy(false); }
  };
  return <Drawer anchor="right" open title={saved ? "编辑博文" : "写博文"} closeLabel="关闭博文编辑" destroyOnHidden onClose={() => !busy && onClose()}
    className={`bk-post-editor${fullscreen ? " bk-post-editor-fullscreen" : ""}`}
    slotProps={{ paper: { sx: { width: fullscreen ? "100vw" : `min(100vw, ${tokens.layout.touchTarget * 16}px)` } } }}
    footer={<Stack direction="row" sx={{ justifyContent: "flex-end", flexWrap: "wrap", gap: `${tokens.spacing[3]}px` }}><Button aria-pressed={fullscreen} onClick={() => setFullscreen(value => !value)}>{fullscreen ? "退出全屏" : "全屏"}</Button><Button disabled={busy} onClick={() => setPreview(value => !value)}>{preview ? "编辑" : "预览"}</Button><Button variant="contained" type="submit" form={formId} loading={busy} aria-label="保存博文">保存</Button></Stack>}>
    <Box component="form" id={formId} noValidate onSubmit={(event: React.FormEvent) => { event.preventDefault(); void save(); }} sx={{ py: `${tokens.spacing[4]}px`, px: "var(--bk-drawer-gutter)", display: "flex", flexDirection: "column", gap: `${tokens.spacing[5]}px`, minWidth: 0, width: "100%", maxWidth: fullscreen ? `${tokens.layout.readingMax}px` : "none", mx: "auto", flex: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {fullscreen && <Typography color="text.secondary">{draft.title || "未命名博文"} · {postLabels[draft.kind]}</Typography>}
      <Box hidden={fullscreen} sx={{ display: fullscreen ? "none" : "grid", gap: `${tokens.spacing[5]}px` }}>
      {saved || fixedSource ? <Typography color="text.secondary">来源：{postLabels[draft.kind]} · {saved?.sourceTitle || sourceTitle || selectedBook.data?.title || selectedArticle.data?.title || "正在加载"}</Typography> : <>
        {allowKindChange && <Stack spacing={1}><Typography component="label">来源</Typography><Select label="来源" aria-label="来源" value={draft.kind} disabled={busy} onChange={event => { change({ kind: event.target.value as PostKind, sourceId: "" }); setSearch(""); }}><MenuItem value="BOOK">书籍</MenuItem><MenuItem value="ARTICLE">文章</MenuItem></Select></Stack>}
        <TextField fullWidth label="搜索原文" value={search} disabled={busy} onChange={event => { setSearch(event.target.value); change({ sourceId: "" }); }} />
        <Stack spacing={1}><Typography component="label">关联{postLabels[draft.kind]}</Typography><Select label={`关联${postLabels[draft.kind]}`} aria-label={`关联${postLabels[draft.kind]}`} value={draft.sourceId} disabled={busy || sourceLoading || sourceFailed} onChange={event => change({ sourceId: event.target.value })}>
          <MenuItem value="" disabled>请选择</MenuItem>{sources.map(source => <MenuItem key={source.id} value={source.id}>{source.title}</MenuItem>)}
        </Select>
          {sourceLoading && <Typography role="status" color="text.secondary">正在加载原文</Typography>}
          {sourceFailed && <Alert severity="error">无法加载原文<Button onClick={() => void (draft.kind === "BOOK" ? sourceBooks.refetch() : sourceArticles.refetch())}>重试</Button></Alert>}
          {!sourceLoading && !sourceFailed && sources.length === 0 && <Typography color="text.secondary">未找到原文</Typography>}
        </Stack>
      </>}
      <TextField label="标题" fullWidth required disabled={busy} value={draft.title} slotProps={{ htmlInput: { maxLength: 200 } }} onChange={event => change({ title: event.target.value })} />
      <Stack spacing={1}><Typography component="label">可见范围</Typography><Select label="可见范围" aria-label="可见范围" value={draft.visibility} disabled={busy} onChange={event => change({ visibility: event.target.value })}><MenuItem value="PRIVATE">仅自己</MenuItem><MenuItem value="LIBRARY">书库共享</MenuItem></Select></Stack>
      </Box>
      {can("notes.edit") && <Box><AiAssistantButton source="NOTE_DRAFT" label="AI 写作辅助" draft={draft.markdown} disabled={busy} onApply={text => change({ markdown: text })} /></Box>}
      {preview ? <section aria-label="博文预览" className={proseClass} dangerouslySetInnerHTML={{ __html: html }} /> : <TextField className="bk-post-writing-area" label="正文（Markdown）" aria-label="博文正文" placeholder="# 阅读感想" fullWidth multiline required minRows={fullscreen ? 18 : 14} maxRows={fullscreen ? undefined : 24} disabled={busy} value={draft.markdown} slotProps={{ htmlInput: { maxLength: 500000 } }} onChange={event => change({ markdown: event.target.value })} />}
    </Box>
  </Drawer>;
}
