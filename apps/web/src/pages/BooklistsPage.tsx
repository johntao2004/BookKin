import { AddRounded } from "@/ui/icons";
import { AutoStoriesOutlined } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { CircularProgress } from "@/ui/feedback";
import { Snackbar } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { BooklistCard } from "../components/CatalogDiscoveryCards";
import { BooklistFormDialog } from "../components/BooklistFormDialog";
import { PageContainer, PageHeader } from "../components/PageHeader";
import type { BooklistSummary } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function BooklistsPage() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const query = params.get("q") ?? "";
  const deferredQuery = useDeferredValue(query);
  const audienceKey = user?.id ?? "anonymous";
  const booklistsQuery = useQuery({
    queryKey: ["booklists", audienceKey, deferredQuery],
    queryFn: ({ signal }) => api.listBooklists({ q: deferredQuery.trim() || undefined, signal }),
    enabled: ready,
  });
  const all = booklistsQuery.data?.items ?? [];
  const official = all.filter((booklist) => booklist.kind === "OFFICIAL");
  const mine = user ? all.filter((booklist) => booklist.kind === "PERSONAL" && booklist.ownedByViewer) : [];
  const discovery = all.filter((booklist) => booklist.kind === "PERSONAL" && (!user || !booklist.ownedByViewer));
  const canCreateOfficial = user?.role === "OWNER" || user?.role === "ADMIN";

  const updateQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="BOOKLISTS"
        title="书单"
        description={user ? "把想读的书收在一起，也看看家人和馆内正在整理什么。" : "浏览官方与读者公开分享的阅读路径。"}
        action={user ? <Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}>新建书单</Button> : undefined}
      />
      {booklistsQuery.isPending ? (
        <Stack sx={{ alignItems: "center", py: `${tokens.spacing[20]}px` }}><CircularProgress /><Typography color="text.secondary" sx={{ mt: 2 }}>正在展开书单…</Typography></Stack>
      ) : booklistsQuery.isError ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void booklistsQuery.refetch()}>重试</Button>}>书单暂时无法读取。</Alert>
      ) : all.length ? (
        <Stack sx={{ gap: `${tokens.spacing[16]}px` }}>
          <BooklistSection title="官方书单" description="由主人和管理员整理的馆内阅读路径。" items={official} empty="目前没有可见的官方书单。" />
          {user ? <BooklistSection title="我的书单" description="只有你可以编辑；每份书单可单独选择可见范围。" items={mine} empty="还没有个人书单，从一本想读的书开始吧。" action={<Button startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}>新建书单</Button>} /> : null}
          <BooklistSection title={user ? "家庭共享与公开" : "公开书单"} description={user ? "家庭成员共享或公开发布的书单。" : "由读者公开分享，书目都来自公共书目池。"} items={discovery} empty="暂时没有其他公开书单。" />
        </Stack>
      ) : (
        <Stack sx={{ alignItems: "center", textAlign: "center", py: `${tokens.spacing[20]}px`, gap: `${tokens.spacing[3]}px` }}>
          <AutoStoriesOutlined color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h4">{query ? "没有匹配的书单" : "还没有可见书单"}</Typography>
          <Typography color="text.secondary">{query ? "试试书单名称或说明中的其他关键词。" : user ? "创建一份个人书单，开始整理自己的阅读路径。" : "登录后可以创建并分享自己的书单。"}</Typography>
          {query ? <Button onClick={() => updateQuery("")}>清除搜索</Button> : user ? <Button variant="contained" onClick={() => setCreateOpen(true)}>新建书单</Button> : null}
        </Stack>
      )}
      {user ? (
        <BooklistFormDialog
          open={createOpen}
          canCreateOfficial={canCreateOfficial}
          onClose={() => setCreateOpen(false)}
          onSaved={(booklist, message) => {
            setCreateOpen(false);
            setNotice(message);
            booklistsQuery.refetch().catch(() => undefined);
          }}
        />
      ) : null}
      <Snackbar open={Boolean(notice)} autoHideDuration={4200} onClose={() => setNotice("")} message={notice} />
    </PageContainer>
  );
}

function BooklistSection({ title, description, items, empty, action }: {
  title: string;
  description: string;
  items: BooklistSummary[];
  empty: string;
  action?: ReactNode;
}) {
  return (
    <Box component="section" aria-labelledby={`section-${title}`}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "flex-end" }, gap: `${tokens.spacing[3]}px`, mb: `${tokens.spacing[6]}px` }}>
        <Box>
          <Typography id={`section-${title}`} variant="h3">{title}</Typography>
          <Typography color="text.secondary" sx={{ mt: `${tokens.spacing[1]}px` }}>{description}</Typography>
        </Box>
        {action}
      </Stack>
      {items.length ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(auto-fill, minmax(240px, 1fr))" }, gap: { xs: `${tokens.spacing[8]}px`, md: `${tokens.spacing[10]}px` } }}>
          {items.map((booklist) => <BooklistCard key={booklist.id} booklist={booklist} />)}
        </Box>
      ) : <Alert severity="info">{empty}</Alert>}
    </Box>
  );
}
