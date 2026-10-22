import { RequestErrorPage } from "./HttpErrorPage";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { BookCardPresentation } from "../components/BookCardPresentation";
import { CatalogSection } from "../components/CatalogSection";
import { PageBackAction, PageContainer, PageTitle } from "../components/PageHeader";
import { articleGridSx } from "../components/bookGrid";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../auth/permissions";
import { Alert, Chip, CircularProgress } from "@/ui/feedback";
import { Box, Breadcrumbs, Link as UiLink, Snackbar, Stack, Typography } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { LockOutlined, PeopleAltOutlined } from "@/ui/icons";
import { TextField } from "@/ui/forms";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArticleCollectionFormDialog } from "../features/article-collections/ArticleCollectionFormDialog";
import { ArticleCollectionOrganizerDrawer } from "../features/article-collections/ArticleCollectionOrganizerDrawer";
import { ArticleCollectionPreview } from "../features/article-collections/ArticleCollectionPreview";
import { articleCollections, type ArticleCollectionDetail } from "../features/article-collections/api";
import { tokens } from "../theme/generated-tokens";

export function ArticleCollectionDetailPage() {
  const { collectionId = "" } = useParams();
  const { user, ready } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const query = params.get("q") ?? "";
  const deferredQuery = useDeferredValue(query);
  const audienceId = user?.id;
  const returnTo = safeReturnTo((location.state as { returnTo?: string } | null)?.returnTo ?? params.get("from"));
  const detailKey = ["article-collection", collectionId, audienceId];
  const detailQuery = useQuery({
    queryKey: detailKey,
    queryFn: () => articleCollections.get(collectionId),
    enabled: ready && Boolean(user) && can("articles.view") && Boolean(collectionId),
  });

  const updateDetail = async (collection: ArticleCollectionDetail, message: string) => {
    queryClient.setQueryData(detailKey, collection);
    setNotice(message);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["article-collections"] }),
      queryClient.invalidateQueries({ queryKey: ["article-collection", collectionId] }),
      queryClient.invalidateQueries({ queryKey: ["articles"] }),
    ]);
  };

  const updateQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  };

  if (!user || !can("articles.view")) return null;
  if (detailQuery.isPending) return <PageContainer><PageBackAction to={returnTo}>返回合集列表</PageBackAction><Stack role="status" aria-label="正在加载合集" sx={{ alignItems: "center", py: `${tokens.spacing[20]}px` }}><CircularProgress /></Stack></PageContainer>;
  if (detailQuery.isError || !detailQuery.data) return <RequestErrorPage error={detailQuery.error} retrying={detailQuery.isFetching} onRetry={() => void detailQuery.refetch()} back={<PageBackAction to={returnTo}>返回合集列表</PageBackAction>} />;

  const collection = detailQuery.data;
  const mayEdit = collection.editable && can("articles.collections.edit");
  const hiddenPrivateCount = collection.visibility === "MEMBERS" && !collection.ownedByViewer
    ? collection.articles.filter((article) => article.visibility === "PRIVATE").length
    : 0;
  const visibleArticles = collection.visibility === "MEMBERS" && !collection.ownedByViewer
    ? collection.articles.filter((article) => article.visibility !== "PRIVATE")
    : collection.articles;
  const matching = visibleArticles.filter((article) => `${article.title} ${article.author} ${article.source_url} ${article.tags} ${article.excerpt ?? ""}`.toLocaleLowerCase().includes(deferredQuery.trim().toLocaleLowerCase()));
  const hasPrivateArticles = collection.articles.some((article) => article.visibility === "PRIVATE");

  return <PageContainer>
    <PageBackAction to={returnTo}>返回合集列表</PageBackAction>
    <Breadcrumbs sx={{ mb: `${tokens.spacing[5]}px` }}>
      <UiLink component={Link} to={returnTo} underline="hover" color="inherit">合集</UiLink>
      <Typography color="text.primary" sx={{ overflowWrap: "anywhere" }}>{collection.title}</Typography>
    </Breadcrumbs>
    <Box component="header" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, .7fr) minmax(0, 1.3fr)" }, alignItems: "center", gap: { xs: `${tokens.spacing[5]}px`, md: `${tokens.spacing[10]}px` }, mb: `${tokens.spacing[10]}px` }}>
      <ArticleCollectionPreview articles={collection.articles.filter((article) => collection.ownedByViewer || collection.visibility !== "MEMBERS" || article.visibility !== "PRIVATE")} title={collection.title} emptyLabel="加入几篇文章，让合集慢慢成形。" />
      <Stack sx={{ minWidth: 0, gap: `${tokens.spacing[4]}px` }}>
        <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: `${tokens.spacing[2]}px` }}>
          <Typography variant="overline" color="primary.main">ARTICLE COLLECTION</Typography>
          <Chip size="small" variant="outlined" icon={collection.visibility === "PRIVATE" ? <LockOutlined /> : <PeopleAltOutlined />} label={collection.visibility === "PRIVATE" ? "仅自己" : "书库共享"} />
        </Stack>
        <PageTitle>{collection.title}</PageTitle>
        <Typography color="text.secondary" sx={{ maxWidth: tokens.layout.readingMax, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{collection.description || "创建者还没有写下这份合集的说明。"}</Typography>
        <Typography variant="body2" color="text.secondary">{collection.ownerDisplayName ? `由 ${collection.ownerDisplayName} 创建` : "合集"} · {collection.articleCount} 篇文章</Typography>
        {mayEdit && <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: `${tokens.spacing[3]}px`, mt: `${tokens.spacing[2]}px`, alignItems: { xs: "stretch", sm: "center" } }}>
          <Button variant="contained" onClick={() => setOrganizerOpen(true)}>整理文章</Button>
          <Button variant="outlined" onClick={() => setEditOpen(true)}>编辑合集</Button>
        </Stack>}
      </Stack>
    </Box>
    {hiddenPrivateCount > 0 && <Alert severity="warning" sx={{ mb: `${tokens.spacing[6]}px` }}>共享合集含有 {hiddenPrivateCount} 篇仅自己可见的文章，这些文章不会展示给其他成员。请整理合集或改为仅自己可见。</Alert>}
    {mayEdit && collection.visibility === "MEMBERS" && hasPrivateArticles && <Alert severity="warning" sx={{ mb: `${tokens.spacing[6]}px` }}>这个共享合集包含仅自己可见的文章；移除这些文章后才能继续共享。</Alert>}
    <CatalogSection title="合集文章" tools={<TextField aria-label="搜索合集中的文章" placeholder="搜索标题、作者或来源" value={query} onChange={(event: any) => updateQuery(event.target.value)} fullWidth />}>
      {matching.length ? <Box component="section" aria-label="合集文章列表" sx={articleGridSx}>
        {matching.map((article) => <BookCardPresentation
          key={article.id}
          variant="article"
          href={`/articles/${encodeURIComponent(article.id)}`}
          book={{ id: article.id, title: article.title, author: article.author || "未知作者", coverUrl: article.cover_url || undefined }}
          description={article.excerpt}
          status={article.visibility === "PUBLIC" ? "公开文章" : "仅自己"}
        />)}
      </Box> : <BookCatalogEmptyState title={query ? "没有找到匹配的文章" : "这个合集还没有文章"} action={mayEdit && !query ? <Button variant="contained" onClick={() => setOrganizerOpen(true)}>添加文章</Button> : undefined} />}
    </CatalogSection>
    {mayEdit && <ArticleCollectionOrganizerDrawer open={organizerOpen} collection={collection} onClose={() => setOrganizerOpen(false)} onChanged={(next, message) => { void updateDetail(next, message); }} />}
    {mayEdit && <ArticleCollectionFormDialog open={editOpen} initial={collection} hasPrivateArticles={hasPrivateArticles} onClose={() => setEditOpen(false)} onConflictLatest={(latest) => { queryClient.setQueryData(detailKey, latest); }} onSaved={(next, message) => { setEditOpen(false); void updateDetail(next, message); }} onDeleted={(message) => {
      setEditOpen(false);
      setNotice(message);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["article-collections"] }),
        queryClient.invalidateQueries({ queryKey: ["article-collection", collectionId] }),
      ]);
      navigate(returnTo);
    }} />}
    <Snackbar open={Boolean(notice)} autoHideDuration={4200} onClose={() => setNotice("")} message={notice} />
  </PageContainer>;
}

function safeReturnTo(value: string | null | undefined) {
  if (value === "/article-collections" || value?.startsWith("/article-collections?")) return value;
  return "/article-collections";
}
