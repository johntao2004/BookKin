import { EmptyState } from "../../ui/empty-state";
import { Alert, CircularProgress } from "@/ui/feedback";
import { Box, List, ListItem, ListItemText, Stack, Typography } from "@/ui/primitives";
import { Button, IconButton } from "@/ui/buttons";
import { Drawer } from "@/ui/overlays";
import { TextField } from "@/ui/forms";
import { ArrowDownwardRounded, ArrowUpwardRounded, DeleteOutlineRounded } from "@/ui/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { articles, type ArticleSummary } from "../content/api";
import { tokens } from "../../theme/generated-tokens";
import {
  articleCollectionError,
  articleCollections,
  isArticleCollectionRevisionConflict,
  type ArticleCollectionDetail,
} from "./api";

export function ArticleCollectionOrganizerDrawer({ open, collection, onClose, onChanged }: {
  open: boolean;
  collection: ArticleCollectionDetail;
  onClose: () => void;
  onChanged: (collection: ArticleCollectionDetail, message: string) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [base, setBase] = useState(collection);
  const [ordered, setOrdered] = useState<ArticleSummary[]>(collection.articles);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const sourceQuery = useQuery({
    queryKey: ["articles", user?.id],
    queryFn: () => articles.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setBase(collection);
    setOrdered(collection.articles);
    setError("");
    setConflict(false);
  }, [open, collection.id]);

  const currentIds = useMemo(() => new Set(ordered.map((article) => article.id)), [ordered]);
  const queryText = deferredQuery.trim().toLocaleLowerCase();
  const matches = (sourceQuery.data ?? []).filter((article) => !currentIds.has(article.id)
    && `${article.title} ${article.author} ${article.excerpt ?? ""} ${article.tags}`.toLocaleLowerCase().includes(queryText));
  const blockedPrivate = base.visibility === "MEMBERS" ? matches.filter((article) => article.visibility === "PRIVATE") : [];
  const candidates = base.visibility === "MEMBERS" ? matches.filter((article) => article.visibility !== "PRIVATE") : matches;
  const orderDirty = ordered.some((article, index) => article.id !== base.articles[index]?.id) || ordered.length !== base.articles.length;

  const refreshCaches = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["article-collections"] }),
    queryClient.invalidateQueries({ queryKey: ["article-collection", base.id] }),
    queryClient.invalidateQueries({ queryKey: ["articles"] }),
  ]);

  const refreshConflict = async () => {
    const latest = await articleCollections.get(base.id);
    setBase(latest);
    setConflict(true);
    await refreshCaches();
    return latest;
  };

  const saveOrder = async () => {
    if (!orderDirty || busy) return;
    setBusy(true);
    setError("");
    setConflict(false);
    try {
      const result = await articleCollections.reorder(base.id, ordered.map((article) => article.id), base.revision);
      setBase(result);
      setOrdered(result.articles);
      setConflict(false);
      onChanged(result, "选集顺序已保存");
      await refreshCaches();
    } catch (reason) {
      if (isArticleCollectionRevisionConflict(reason)) {
        try {
          await refreshConflict();
          setError("选集已在其他位置更新。最新版本已重新获取，当前顺序草稿保留；核对后可再次保存。");
        } catch (refreshError) {
          setError(`${articleCollectionError(reason)} 最新版本读取失败：${articleCollectionError(refreshError)}`);
        }
      } else {
        setError(articleCollectionError(reason, "保存顺序失败，请重试。"));
      }
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (busy || target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    setOrdered(next);
    setConflict(false);
  };

  const addArticle = async (article: ArticleSummary) => {
    if (busy || orderDirty) return;
    setBusy(true);
    setError("");
    try {
      const result = await articleCollections.addArticles(base.id, [article.id], base.revision);
      setBase(result);
      setOrdered(result.articles);
      onChanged(result, `已将《${article.title}》加入选集`);
      await refreshCaches();
    } catch (reason) {
      if (isArticleCollectionRevisionConflict(reason)) {
        try {
          await refreshConflict();
          setError("选集已在其他位置更新。最新版本已重新读取；这次加入没有提交，请重新选择文章。");
        } catch (refreshError) {
          setError(`${articleCollectionError(reason)} 最新版本读取失败：${articleCollectionError(refreshError)}`);
        }
      } else {
        setError(articleCollectionError(reason, "加入文章失败，请重试。"));
      }
    } finally {
      setBusy(false);
    }
  };

  const removeArticle = async (article: ArticleSummary) => {
    if (busy || orderDirty) return;
    setBusy(true);
    setError("");
    try {
      const result = await articleCollections.removeArticle(base.id, article.id, base.revision);
      setBase(result);
      setOrdered(result.articles);
      onChanged(result, `已将《${article.title}》移出选集；文章本身仍保留`);
      await refreshCaches();
    } catch (reason) {
      if (isArticleCollectionRevisionConflict(reason)) {
        try {
          await refreshConflict();
          setError("选集已在其他位置更新。最新版本已重新读取；这次移除没有提交，请重新检查当前内容。");
        } catch (refreshError) {
          setError(`${articleCollectionError(reason)} 最新版本读取失败：${articleCollectionError(refreshError)}`);
        }
      } else {
        setError(articleCollectionError(reason, "移出文章失败，请重试。"));
      }
    } finally {
      setBusy(false);
    }
  };

  return <Drawer anchor="right" title={`整理选集 · ${base.title}`} closeLabel="关闭整理选集" open={open} onClose={busy ? undefined : onClose} slotProps={{ paper: { sx: { width: { xs: "100%", md: tokens.layout.readingMax + tokens.spacing[20] * 2 }, maxWidth: "100vw" } } }}>
    <Stack sx={{ minHeight: "100%", p: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[6]}px` }, gap: `${tokens.spacing[5]}px` }}>
      {error && <Alert severity={conflict ? "warning" : "error"}>{error}</Alert>}
      {base.visibility === "MEMBERS" && <Alert severity="info">仅可加入书库成员可阅读的文章；仅自己的文章不会出现在可加入列表中。</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, .9fr) minmax(0, 1.1fr)" }, gap: `${tokens.spacing[8]}px`, alignItems: "start" }}>
        <Box component="section" aria-labelledby="article-collection-current-heading" sx={{ minWidth: 0 }}>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", minHeight: tokens.layout.touchTarget, gap: `${tokens.spacing[3]}px`, mb: `${tokens.spacing[3]}px` }}>
            <Typography id="article-collection-current-heading" variant="h5">选集顺序</Typography>
            {orderDirty && <Button variant="contained" disabled={busy} onClick={() => void saveOrder()}>{busy ? "保存中…" : "保存顺序"}</Button>}
          </Stack>
          {ordered.length ? <List role="list" aria-label="选集中的文章" sx={{ p: 0, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, overflow: "hidden" }}>
            {ordered.map((article, index) => <ListItem key={article.id} role="listitem" divider={index < ordered.length - 1} sx={{ gap: `${tokens.spacing[2]}px`, px: `${tokens.spacing[3]}px`, alignItems: "flex-start", "& > .bk-list-item-content": { minWidth: 0 } }}>
              <Box sx={{ width: `${tokens.spacing[20]}px`, flex: "0 0 auto", aspectRatio: "2.35 / 1", borderRadius: `${tokens.radius.md}px`, overflow: "hidden", bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
                {article.cover_url ? <Box component="img" src={article.cover_url} alt="" loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center", px: `${tokens.spacing[2]}px` }}><Typography variant="caption" color="text.secondary" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{article.title}</Typography></Stack>}
              </Box>
              <ListItemText primary={article.title} secondary={article.author} sx={{ minWidth: 0, overflowWrap: "anywhere" }} />
              <Stack sx={{ flexShrink: 0, gap: `${tokens.spacing[1]}px` }}>
                <IconButton aria-label={`上移 ${article.title}`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUpwardRounded /></IconButton>
                <IconButton aria-label={`下移 ${article.title}`} disabled={busy || index === ordered.length - 1} onClick={() => move(index, 1)}><ArrowDownwardRounded /></IconButton>
                <IconButton aria-label={`移出 ${article.title}`} disabled={busy || orderDirty} onClick={() => void removeArticle(article)}><DeleteOutlineRounded /></IconButton>
              </Stack>
            </ListItem>)}
          </List> : <EmptyState compact title="这个选集还没有文章" />}
          {orderDirty && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: `${tokens.spacing[2]}px` }}>调整完成后保存顺序；保存前可继续用上移、下移按钮修改。</Typography>}
        </Box>
        <Stack component="aside" sx={{ minWidth: 0, gap: `${tokens.spacing[3]}px`, position: { md: "sticky" }, top: `${tokens.spacing[6]}px` }}>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "stretch", sm: "center" }, minHeight: tokens.layout.touchTarget, gap: `${tokens.spacing[2]}px` }}>
            <Typography variant="h5" sx={{ flexShrink: 0 }}>添加文章</Typography>
            <TextField aria-label="搜索文章" placeholder="搜索标题、作者或摘要" value={query} onChange={(event: any) => setQuery(event.target.value)} sx={{ flex: 1, minWidth: 0 }} />
          </Stack>
          {sourceQuery.isPending ? <Stack sx={{ alignItems: "center", py: `${tokens.spacing[8]}px` }}><CircularProgress size={24} /></Stack> : sourceQuery.isError ? (
            <Stack sx={{ alignItems: "flex-start", gap: `${tokens.spacing[3]}px` }}><Alert severity="error">文章暂时无法读取。</Alert><Button onClick={() => void sourceQuery.refetch()}>重试</Button></Stack>
          ) : blockedPrivate.length > 0 ? <Typography variant="caption" color="text.secondary">搜索结果中有 {blockedPrivate.length} 篇仅自己可见的文章，不能加入这个共享选集。</Typography> : null}
          {!sourceQuery.isPending && !sourceQuery.isError && (candidates.length ? <List aria-label="可添加的文章" sx={{ p: 0, maxHeight: { md: "62vh" }, overflowY: "auto", border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px` }}>
            {candidates.map((article, index) => <ListItem key={article.id} divider={index < candidates.length - 1} secondaryAction={<Button size="small" disabled={busy || orderDirty} onClick={() => void addArticle(article)}>加入</Button>}>
              <ListItemText primary={article.title} secondary={article.author} />
            </ListItem>)}
          </List> : <EmptyState compact title={query ? "没有匹配的可加入文章" : "暂无可加入的文章"} />)}
          {orderDirty && <Typography variant="caption" color="text.secondary">先保存顺序，再加入或移出文章。</Typography>}
        </Stack>
      </Box>
    </Stack>
  </Drawer>;
}
