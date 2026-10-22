import { usePermissions } from "../auth/permissions";
// 展示默认书库及独立内容存储的实时状态，仅提供能力复查。
// Shows live default-library and independent content storage status with capability rechecks.
import { EmptyState } from "../ui/empty-state";
import { useState } from "react";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Card } from "@/ui/cards";
import { Button, RefreshButton } from "@/ui/buttons";
import { Chip } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { Divider } from "@/ui/feedback";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { ActionToolbar, PageContainer } from "../components/PageHeader";
import type { LibraryRoot } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function LibraryRootsPage() {
  const { can } = usePermissions();
  const query = useQuery({ queryKey: ["library-roots"], queryFn: api.listLiveLibraryRoots, refetchInterval: 60_000 });
  const contentQuery = useQuery({ queryKey: ["content-storage"], queryFn: api.listContentStorage, refetchInterval: 60_000 });
  const roots = query.data ?? [];
  const degraded = roots.filter((root) => !root.canRead || !root.canWrite);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败，请重试"); }
    finally { setBusy(false); }
  }
  return (
    <PageContainer>
      <Stack sx={{ mb: 3 }}><ActionToolbar>
        <RefreshButton disabled={busy || !can("settings.roots.edit")} onClick={() => perform(async () => { await api.checkLibraryRoots(); await Promise.all([query.refetch(), contentQuery.refetch()]); })}>重新检查</RefreshButton>
      </ActionToolbar></Stack>
      {error && <Alert severity="error">{error}</Alert>}

      {degraded.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {degraded.map((root) => root.name).join("、")} 当前不可写。浏览和阅读仍可用，暂时无法重命名、删除或保存文件修改。
        </Alert>
      )}

      {query.isPending ? (
        <Stack sx={{ py: 10, alignItems: "center" }}><CircularProgress /></Stack>
      ) : query.isError ? (
        <Alert severity="error">无法读取书库根目录状态。</Alert>
      ) : roots.length === 0 ? (
        <Stack spacing={1} sx={{ py: 12, alignItems: "center", textAlign: "center" }}>
          <EmptyState title="尚未配置书籍书库" padded={false} />
          <Typography color="text.secondary">请检查默认书库的挂载配置。</Typography>
        </Stack>
      ) : (
        <Stack spacing={2}>
          {roots.map((root) => <StorageCard key={root.id} name="书籍书库" canRead={root.canRead} canWrite={root.canWrite} freeBytes={root.freeBytes} lastScanAt={root.lastScanAt} offline={root.status === "OFFLINE"} />)}
        </Stack>
      )}
      <Stack spacing={2} sx={{ mt: `${tokens.spacing[4]}px` }}>
        {contentQuery.isPending ? <CircularProgress /> : contentQuery.isError
          ? <Alert severity="error">无法读取文章及禁书区存储位置。<Button onClick={() => void contentQuery.refetch()}>重试</Button></Alert>
          : contentQuery.data?.map(area => <StorageCard key={area.kind} name={area.kind === "VAULT" ? "禁书区书库" : "文章书库"} canRead={area.canRead} canWrite={area.canWrite} freeBytes={area.freeBytes} lastScanAt={area.lastScanAt} />)}
      </Stack>
    </PageContainer>
  );
}

type StorageCardProps = Pick<LibraryRoot, "canRead" | "canWrite" | "freeBytes" | "lastScanAt"> & { name: string; offline?: boolean };

function StorageCard({ name, canRead, canWrite, freeBytes, lastScanAt, offline = false }: StorageCardProps) {
  const unavailable = offline || !canRead;
  const writable = !unavailable && canWrite;
  return <Card>
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ p: `${tokens.spacing[4]}px`, alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1 }}>
      <Typography variant="h5">{name}</Typography>
      <Chip size="small" color={unavailable ? "error" : writable ? "success" : "warning"}
        label={offline ? "离线" : unavailable ? "不可读" : writable ? "可读可写" : "只读"} />
    </Stack>
    <Divider sx={{ m: 0 }} />
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ px: `${tokens.spacing[4]}px`, py: `${tokens.spacing[3]}px`, justifyContent: "space-between", gap: 1.5, color: "text.secondary" }}>
      <Typography variant="body2">可用空间 <Box component="span" sx={{ color: "text.primary", fontWeight: 700 }}>{formatBytes(freeBytes)}</Box></Typography>
      <Typography variant="body2">上次扫描 {formatDate(lastScanAt)}</Typography>
    </Stack>
  </Card>;
}

function formatBytes(value?: number | null) {
  if (value == null) return "未知";
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)} TB`;
  return `${(value / 1_000_000_000).toFixed(1)} GB`;
}

function formatDate(value?: string | null) {
  if (!value) return "尚未扫描";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
