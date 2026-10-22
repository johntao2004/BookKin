import { Alert, CircularProgress } from "@/ui/feedback";
import { Button } from "@/ui/buttons";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "@/ui/overlays";
import { List, ListItem, ListItemText, Stack, Typography } from "@/ui/primitives";
import { TextField } from "@/ui/forms";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/permissions";
import { tokens } from "../../theme/generated-tokens";
import { ArticleCollectionFormDialog } from "./ArticleCollectionFormDialog";
import {
  articleCollectionError,
  articleCollections,
  type ArticleCollectionDetail,
} from "./api";

export function AddToArticleCollectionDialog({ articleId, articleTitle, articleVisibility, open, onClose, onSaved }: {
  articleId: string;
  articleTitle: string;
  articleVisibility?: "PUBLIC" | "PRIVATE";
  open: boolean;
  onClose: () => void;
  onSaved?: (collection: ArticleCollectionDetail, message: string) => void;
}) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const enabled = open && Boolean(user) && can("articles.view") && can("articles.collections.edit");
  const collectionsQuery = useQuery({
    queryKey: ["article-collections", user?.id, "picker"],
    queryFn: () => articleCollections.list(),
    enabled,
  });
  const collections = (collectionsQuery.data?.items ?? []).filter((item) => item.ownedByViewer && item.editable)
    .filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase().includes(deferredQuery.trim().toLocaleLowerCase()));

  const refresh = async (collection: ArticleCollectionDetail) => {
    if (user) queryClient.setQueryData(["article-collection", collection.id, user.id], collection);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["article-collections"] }),
      queryClient.invalidateQueries({ queryKey: ["article-collection", collection.id] }),
      queryClient.invalidateQueries({ queryKey: ["articles"] }),
    ]);
  };

  const add = async (collectionId: string, title: string) => {
    setBusyId(collectionId);
    setError("");
    setNotice("");
    try {
      const latest = await articleCollections.get(collectionId);
      if (latest.articles.some((item) => item.id === articleId)) {
        setNotice(`《${articleTitle}》已经在“${title}”中，没有重复添加。`);
        return;
      }
      if (latest.visibility === "MEMBERS" && articleVisibility === "PRIVATE") {
        setNotice("这篇文章仅自己可见，不能加入书库共享合集。");
        return;
      }
      const result = await articleCollections.addArticles(collectionId, [articleId], latest.revision);
      await refresh(result);
      onSaved?.(result, `已将《${articleTitle}》加入“${result.title}”`);
      onClose();
    } catch (reason) {
      setError(articleCollectionError(reason, "加入合集失败，请重试。"));
    } finally {
      setBusyId(null);
    }
  };

  const addCreated = async (collection: ArticleCollectionDetail) => {
    setCreateOpen(false);
    setBusyId(collection.id);
    setError("");
    try {
      const result = await articleCollections.addArticles(collection.id, [articleId], collection.revision);
      await refresh(result);
      onSaved?.(result, `已将《${articleTitle}》加入“${result.title}”`);
      onClose();
    } catch (reason) {
      await queryClient.invalidateQueries({ queryKey: ["article-collections"] });
      setError(`私人合集已创建，但《${articleTitle}》没有加入。${articleCollectionError(reason, "请重新选择合集后重试。")}`);
    } finally {
      setBusyId(null);
    }
  };

  const close = () => {
    if (busyId) return;
    setError("");
    setNotice("");
    onClose();
  };

  return <>
    <Dialog open={open && !createOpen} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>将《{articleTitle}》加入合集</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: `${tokens.spacing[4]}px` }}>
          {error && <Alert severity="error">{error}</Alert>}
          {notice && <Alert severity="info">{notice}</Alert>}
          <TextField label="搜索合集" value={query} onChange={(event: any) => setQuery(event.target.value)} placeholder="按名称或说明搜索" />
          {collectionsQuery.isPending ? (
            <Stack sx={{ alignItems: "center", py: `${tokens.spacing[8]}px` }}><CircularProgress /></Stack>
          ) : collectionsQuery.isError ? (
            <Stack sx={{ gap: `${tokens.spacing[3]}px`, alignItems: "flex-start" }}>
              <Alert severity="error">可加入的合集暂时无法读取。</Alert>
              <Button onClick={() => void collectionsQuery.refetch()}>重试</Button>
            </Stack>
          ) : collections.length ? (
            <List aria-label="可加入的合集" sx={{ p: 0, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, overflow: "hidden" }}>
              {collections.map((collection, index) => {
                const blocked = articleVisibility === "PRIVATE" && collection.visibility === "MEMBERS";
                return <ListItem key={collection.id} divider={index < collections.length - 1} secondaryAction={
                  <Button size="small" disabled={Boolean(busyId) || blocked} onClick={() => void add(collection.id, collection.title)}>
                    {blocked ? "不可加入" : busyId === collection.id ? "加入中…" : "加入"}
                  </Button>
                }>
                  <ListItemText primary={collection.title} secondary={<Stack component="span" direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: `${tokens.spacing[2]}px`, mt: `${tokens.spacing[1]}px` }}>
                    <Typography component="span" variant="caption" color="text.secondary">{collection.visibility === "PRIVATE" ? "仅自己" : "书库共享"} · {collection.articleCount} 篇文章</Typography>
                    {blocked && <Typography component="span" variant="caption" color="warning.main">仅自己的文章不能加入共享合集</Typography>}
                  </Stack>} />
                </ListItem>;
              })}
            </List>
          ) : (
            <Typography color="text.secondary" sx={{ py: `${tokens.spacing[5]}px`, textAlign: "center" }}>{query ? "没有找到匹配的合集" : "暂无可加入的私人合集"}</Typography>
          )}
          <Button variant={collections.length ? "outlined" : "contained"} onClick={() => { setError(""); setCreateOpen(true); }}>新建私人合集</Button>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={close} disabled={Boolean(busyId)}>关闭</Button></DialogActions>
    </Dialog>
    <ArticleCollectionFormDialog
      open={open && createOpen}
      onClose={() => setCreateOpen(false)}
      onSaved={(collection) => void addCreated(collection)}
    />
  </>;
}
