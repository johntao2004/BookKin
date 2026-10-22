import { RequestErrorPage } from "./HttpErrorPage";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { CatalogSection } from "../components/CatalogSection";
import { PageContainer, PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../auth/permissions";
import { ArticleCollectionPreview } from "../features/article-collections/ArticleCollectionPreview";
import { Card } from "@/ui/cards";
import { CardActionArea } from "@/ui/primitives";
import { Alert, Chip, CircularProgress } from "@/ui/feedback";
import { Box, Stack, Typography } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { LockOutlined, PeopleAltOutlined } from "@/ui/icons";
import { TextField } from "@/ui/forms";
import { useDeferredValue, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArticleCollectionFormDialog } from "../features/article-collections/ArticleCollectionFormDialog";
import { articleCollections, type ArticleCollectionSummary } from "../features/article-collections/api";
import { tokens } from "../theme/generated-tokens";

export function ArticleCollectionsPage() {
  const { user, ready } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const query = params.get("q") ?? "";
  const deferredQuery = useDeferredValue(query);
  const queryKey = ["article-collections", user?.id, deferredQuery];
  const collectionsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => articleCollections.list({ q: deferredQuery, signal }),
    enabled: ready && Boolean(user) && can("articles.view"),
  });
  const all = collectionsQuery.data?.items ?? [];
  const mine = useMemo(() => all.filter((collection) => collection.ownedByViewer), [all]);
  const shared = useMemo(() => all.filter((collection) => !collection.ownedByViewer && collection.visibility === "MEMBERS"), [all]);
  const returnTo = `${location.pathname}${location.search}`;

  const updateQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  };

  if (!user || !can("articles.view")) return null;

  if (collectionsQuery.isError && !collectionsQuery.data) return <RequestErrorPage error={collectionsQuery.error} retrying={collectionsQuery.isFetching} onRetry={() => void collectionsQuery.refetch()} />;
  return <PageContainer>
    <PageHeader eyebrow="ARTICLE COLLECTIONS" title="合集" action={can("articles.collections.edit") ? <Button variant="contained" onClick={() => setCreateOpen(true)}>新建私人合集</Button> : undefined} />
    <CatalogSection title="查找合集" tools={<TextField aria-label="搜索合集" placeholder="搜索合集名称或说明" value={query} onChange={(event: any) => updateQuery(event.target.value)} fullWidth />}>{null}</CatalogSection>
    {collectionsQuery.isPending ? (
      <Stack role="status" aria-label="正在加载合集" sx={{ alignItems: "center", py: `${tokens.spacing[20]}px` }}><CircularProgress /></Stack>
    ) : collectionsQuery.isError ? (
      <Alert severity="error" action={<Button color="inherit" onClick={() => void collectionsQuery.refetch()}>重试</Button>}>合集暂时无法读取。</Alert>
    ) : (
      <Stack sx={{ gap: `${tokens.spacing[10]}px` }}>
        <CatalogSection title="我的合集">
          {mine.length ? <CollectionGrid items={mine} returnTo={returnTo} /> : <BookCatalogEmptyState
            title={query ? "没有找到匹配的私人合集" : "你还没有创建合集"}
          />}
        </CatalogSection>
        <CatalogSection title="书库共享">
          {shared.length ? <CollectionGrid items={shared} returnTo={returnTo} /> : <BookCatalogEmptyState title={query ? "没有找到匹配的共享合集" : "暂无书库共享合集"} />}
        </CatalogSection>
      </Stack>
    )}
    <ArticleCollectionFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={(collection) => {
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["article-collections"] });
      const from = new URLSearchParams({ from: returnTo });
      navigate({ pathname: `/article-collections/${encodeURIComponent(collection.id)}`, search: `?${from.toString()}` }, { state: { returnTo } });
    }} />
  </PageContainer>;
}

function CollectionGrid({ items, returnTo }: { items: ArticleCollectionSummary[]; returnTo: string }) {
  return <Box component="section" aria-label="合集列表" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: `repeat(auto-fill, minmax(min(100%, ${tokens.layout.bookCardMinWidth}px), 1fr))` }, gap: { xs: `${tokens.spacing[8]}px`, md: `${tokens.spacing[10]}px` }, minWidth: 0 }}>
    {items.map((collection) => <CollectionCard key={collection.id} collection={collection} returnTo={returnTo} />)}
  </Box>;
}

function CollectionCard({ collection, returnTo }: { collection: ArticleCollectionSummary; returnTo: string }) {
  const from = new URLSearchParams({ from: returnTo });
  return <Card variant="borderless" sx={{ minWidth: 0, bgcolor: "transparent", overflow: "visible", "&.ant-card": { boxShadow: "none" } }}>
    <CardActionArea component={Link} to={`/article-collections/${encodeURIComponent(collection.id)}?${from.toString()}`} state={{ returnTo }} sx={{ display: "block", textAlign: "left", borderRadius: `${tokens.radius.lg}px`, overflow: "hidden", "&:hover": { opacity: 1 } }}>
      <ArticleCollectionPreview articles={collection.previewArticles.filter((article) => collection.ownedByViewer || collection.visibility !== "MEMBERS" || article.visibility !== "PRIVATE")} title={collection.title} />
      <Stack sx={{ minWidth: 0, gap: `${tokens.spacing[2]}px`, pt: `${tokens.spacing[4]}px` }}>
        <Typography variant="h5" component="h2" sx={{ overflowWrap: "anywhere" }}>{collection.title}</Typography>
        <Typography color="text.secondary" sx={{ minHeight: "2lh", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{collection.description || "还没有合集说明。"}</Typography>
        <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: `${tokens.spacing[2]}px` }}>
          <Chip size="small" variant="outlined" icon={collection.visibility === "PRIVATE" ? <LockOutlined /> : <PeopleAltOutlined />} label={collection.visibility === "PRIVATE" ? "仅自己" : "书库共享"} />
          <Typography variant="caption" color="text.secondary">{collection.articleCount} 篇文章{collection.ownerDisplayName ? ` · ${collection.ownerDisplayName}` : ""}</Typography>
        </Stack>
      </Stack>
    </CardActionArea>
  </Card>;
}
