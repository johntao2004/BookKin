import { CheckCircleOutlineRounded } from "@/ui/icons";
import { ErrorOutlineRounded } from "@/ui/icons";
import { FolderOutlined } from "@/ui/icons";
import { RefreshRounded } from "@/ui/icons";
import { StorageRounded } from "@/ui/icons";
import { SyncRounded } from "@/ui/icons";
import { WarningAmberRounded } from "@/ui/icons";
import { Alert } from "@/ui";
import { Box } from "@/ui";
import { Button } from "@/ui";
import { Chip } from "@/ui";
import { CircularProgress } from "@/ui";
import { Divider } from "@/ui";
import { Stack } from "@/ui";
import { Typography } from "@/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageContainer, PageHeader } from "../components/PageHeader";
import type { LibraryRoot } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function LibraryRootsPage() {
  const query = useQuery({ queryKey: ["library-roots"], queryFn: api.listLibraryRoots, refetchInterval: 60_000 });
  const roots = query.data ?? [];
  const degraded = roots.filter((root) => !root.canRead || !root.canWrite);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="NAS LIBRARIES"
        title="书库与 NAS"
        description="BookKin每分钟复查读取、写入、原子移动、暂存目录和剩余空间；不满足写入条件时自动降级，不冒险修改原文件。"
        action={<Button startIcon={<RefreshRounded />} variant="outlined" onClick={() => query.refetch()}>重新检查</Button>}
      />

      {degraded.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {degraded.map((root) => root.name).join("、")} 当前不可写。浏览和阅读仍可用，但重命名、移动、删除和写回会被预览接口阻止。
        </Alert>
      )}

      {query.isPending ? (
        <Stack sx={{ py: 10, alignItems: "center" }}><CircularProgress /></Stack>
      ) : query.isError ? (
        <Alert severity="error">无法读取书库根目录状态。</Alert>
      ) : roots.length === 0 ? (
        <Stack spacing={1} sx={{ py: 12, alignItems: "center", textAlign: "center" }}>
          <StorageRounded sx={{ fontSize: 46, color: "text.disabled" }} />
          <Typography variant="h4">尚未配置书库</Typography>
          <Typography color="text.secondary">先在 Docker Compose 中挂载 NAS 目录，再以 BOOKKIN_STORAGE_ROOTS_* 配置名称与容器路径。</Typography>
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: roots.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))" }, gap: 3 }}>
          {roots.map((root) => <RootCard key={root.id} root={root} />)}
        </Box>
      )}
    </PageContainer>
  );
}

function RootCard({ root }: { root: LibraryRoot }) {
  const unavailable = root.status === "OFFLINE" || !root.canRead;
  const writable = !unavailable && root.canWrite;
  const statusIcon = unavailable ? <ErrorOutlineRounded /> : writable ? <CheckCircleOutlineRounded /> : <WarningAmberRounded />;
  const statusColor = unavailable ? "error" : writable ? "success" : "warning";
  const statusLabel = unavailable ? (root.status === "OFFLINE" ? "离线" : "不可读") : writable ? "可读可写" : "只读";
  return (
    <Stack sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
      <Stack direction="row" sx={{ p: 3, alignItems: "flex-start", gap: 2 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: "background.default", display: "grid", placeItems: "center", color: "primary.main", flexShrink: 0 }}><StorageRounded /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1 }}>
            <Typography variant="h5">{root.name}</Typography>
            <Chip icon={statusIcon} color={statusColor} size="small" label={statusLabel} />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", color: "text.secondary" }}>
            <FolderOutlined fontSize="small" />
            <Typography
              variant="body2"
              title={root.configuredPath}
              noWrap
              sx={{ fontFamily: tokens.typography.fontFamily.mono, overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {root.configuredPath}
            </Typography>
          </Stack>
        </Box>
      </Stack>
      <Divider />
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ p: 3, justifyContent: "space-between", gap: 1.5, color: "text.secondary" }}>
        <Typography variant="body2">可用空间 <Box component="span" sx={{ color: "text.primary", fontWeight: 700 }}>{formatBytes(root.freeBytes)}</Box></Typography>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}><SyncRounded fontSize="small" /><Typography variant="body2">上次扫描 {formatDate(root.lastScanAt)}</Typography></Stack>
      </Stack>
    </Stack>
  );
}

function formatBytes(value?: number | null) {
  if (value == null) return "未知";
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)} TB`;
  return `${(value / 1_000_000_000).toFixed(1)} GB`;
}

function formatDate(value?: string | null) {
  if (!value) return "尚未完成";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
