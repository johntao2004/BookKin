import { RequestErrorPage } from "./HttpErrorPage";
import { usePermissions } from "../auth/permissions";
// 书目发现页按查询展示可见结果，创建与编辑通过共享表单完成。
// Lists visible booklists for the query and uses shared forms for creation/editing.
import { EMPTY_BOOKLISTS_TITLE } from "../ui/empty-state-copy";
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
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { BooklistFormDialog } from "../components/BooklistFormDialog";
import { PageContainer, PageHeader } from "../components/PageHeader";
import type { BooklistSummary } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function BooklistsPage() {
  const { user, ready } = useAuth();
  const { can } = usePermissions();
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
  const mine = user ? all.filter((booklist) => booklist.ownedByViewer) : [];
  const discovery = all.filter((booklist) => !user || !booklist.ownedByViewer);

  const updateQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  };

  if (booklistsQuery.isError && !booklistsQuery.data) return <RequestErrorPage error={booklistsQuery.error} retrying={booklistsQuery.isFetching} onRetry={() => void booklistsQuery.refetch()} />;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="BOOKLISTS"
        title="书目"
        action={can("booklists.edit") ? <Button variant="contained" onClick={() => setCreateOpen(true)}>新建书目</Button> : undefined}
      />
      {booklistsQuery.isPending ? (
        <Stack sx={{ alignItems: "center", py: `${tokens.spacing[20]}px` }}><CircularProgress /><Typography color="text.secondary" sx={{ mt: 2 }}>正在展开书目…</Typography></Stack>
      ) : booklistsQuery.isError ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void booklistsQuery.refetch()}>重试</Button>}>书目暂时无法读取。</Alert>
      ) : all.length ? (
        <Stack sx={{ gap: `${tokens.spacing[16]}px` }}>
          {user ? <BooklistSection title="我的书目" items={mine} /> : null}
          <BooklistSection title={user ? "家庭共享" : "公开书目"} items={discovery} />
        </Stack>
      ) : (
        <BookCatalogEmptyState title={query ? "未找到匹配的书目" : EMPTY_BOOKLISTS_TITLE}
          action={query ? <Button onClick={() => updateQuery("")}>清除搜索</Button> : undefined}
        />
      )}
      {user ? (
        <BooklistFormDialog
          open={createOpen}
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

function BooklistSection({ title, description, items, action }: {
  title: string;
  description?: string;
  items: BooklistSummary[];
  action?: ReactNode;
}) {
  return (
    <Box component="section" aria-labelledby={`section-${title}`}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "flex-end" }, gap: `${tokens.spacing[3]}px`, mb: `${tokens.spacing[6]}px` }}>
        <Box>
          <Typography id={`section-${title}`} variant="h3">{title}</Typography>
          {description && <Typography color="text.secondary" sx={{ mt: `${tokens.spacing[1]}px` }}>{description}</Typography>}
        </Box>
        {action}
      </Stack>
      {items.length ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(auto-fill, minmax(240px, 1fr))" }, gap: { xs: `${tokens.spacing[8]}px`, md: `${tokens.spacing[10]}px` } }}>
          {items.map((booklist) => <BooklistCard key={booklist.id} booklist={booklist} />)}
        </Box>
      ) : (
        <BookCatalogEmptyState title={title === "家庭共享" ? "暂无家庭共享书目" : title === "公开书目" ? "暂无公开书目" : EMPTY_BOOKLISTS_TITLE} />
      )}
    </Box>
  );
}
