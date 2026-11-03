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
import { CatalogSection } from "../components/CatalogSection";
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
  const mine = user ? all.filter((booklist) => booklist.ownedByViewer && booklist.visibility === "PRIVATE") : [];
  const publicBooklists = all.filter((booklist) => booklist.visibility === "PUBLIC");
  const family = user ? all.filter((booklist) => booklist.visibility === "MEMBERS") : [];

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
      ) : (
        <Stack sx={{ gap: `${tokens.spacing[16]}px` }}>
          {user ? <BooklistSection title="我的书目" items={mine} emptyTitle={query ? "未找到匹配的书目" : EMPTY_BOOKLISTS_TITLE} /> : null}
          {user ? <BooklistSection title="家庭共享" items={family} emptyTitle={query ? "未找到匹配的书目" : "暂无家庭共享书目"} /> : null}
          <BooklistSection title="公开书目" items={publicBooklists} emptyTitle={query ? "未找到匹配的书目" : "暂无公开书目"}
            action={query ? <Button onClick={() => updateQuery("")}>清除搜索</Button> : undefined} />
        </Stack>
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

function BooklistSection({ title, description, items, action, emptyTitle }: {
  title: string;
  description?: string;
  items: BooklistSummary[];
  action?: ReactNode;
  emptyTitle: string;
}) {
  return (
    <Box component="section" aria-label={title} sx={{ minWidth: 0 }}>
      <CatalogSection title={title} summary={description ? <Typography color="text.secondary">{description}</Typography> : undefined} tools={action}>
      {items.length ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(auto-fill, minmax(240px, 1fr))" }, gap: { xs: `${tokens.spacing[8]}px`, md: `${tokens.spacing[10]}px` } }}>
          {items.map((booklist) => <BooklistCard key={booklist.id} booklist={booklist} />)}
        </Box>
      ) : (
        <BookCatalogEmptyState title={emptyTitle} />
      )}
      </CatalogSection>
    </Box>
  );
}
