import { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField } from "@/ui";
import { randomId } from "../utils/random-id";
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
import { ActionToolbar, PageContainer } from "../components/PageHeader";
import type { LibraryRoot } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function LibraryRootsPage() {
  const query = useQuery({ queryKey: ["library-roots"], queryFn: api.listLibraryRoots, refetchInterval: 60_000 });
  const roots = query.data ?? [];
  const degraded = roots.filter((root) => !root.canRead || !root.canWrite);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.previewLibraryRoot>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [key, setKey] = useState(randomId);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败，请重试"); }
    finally { setBusy(false); }
  }
  return (
    <PageContainer>
      <Stack sx={{ mb: 3 }}><ActionToolbar>
        <Button variant="contained" onClick={() => { setOpen(true); setPreview(null); setError(""); setKey(randomId()); }}>新增书库</Button>
        <Button startIcon={<RefreshRounded />} variant="outlined" disabled={busy} onClick={() => perform(async () => { await api.checkLibraryRoots(); await query.refetch(); })}>重新检查</Button>
      </ActionToolbar></Stack>
      {error && !open && <Alert severity="error">{error}</Alert>}
      <Dialog open={open} onClose={() => { if (!busy) setOpen(false); }} maxWidth="sm" fullWidth>
        <DialogTitle>新增书库</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <TextField label="书库名称" value={name} onChange={event => setName(event.target.value)} fullWidth />
            <TextField label="容器内目录" value={path} onChange={event => { setPath(event.target.value); setPreview(null); }} helperText="先在 Docker 的应用和任务容器中挂载同一目录，例如 /library/books。" fullWidth />
            {error && <Alert severity="error">{error}</Alert>}
            {preview && <Alert severity={preview.writable ? "success" : "warning"}>目录可访问 · {preview.writable ? "可读写，新增时将验证写入能力" : "只读"} · 可用 {formatBytes(preview.freeBytes)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" disabled={busy || !name.trim() || !path.trim()} onClick={() => perform(async () => {
            if (!preview) { setPreview(await api.previewLibraryRoot(path.trim())); return; }
            await api.createLibraryRoot({ name: name.trim(), path: preview.path, expectedFingerprint: preview.fingerprint, idempotencyKey: key });
            await query.refetch(); setOpen(false); setName(""); setPath(""); setPreview(null);
          })}>{busy ? "检查中…" : preview ? "确认新增" : "检查位置"}</Button>
        </DialogActions>
      </Dialog>

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
          <Typography color="text.secondary">点击新增书库，检查并添加已挂载的目录。</Typography>
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
      <Stack direction="row" sx={{ px: `${tokens.spacing[6]}px`, py: `${tokens.spacing[4]}px`, alignItems: "flex-start", gap: 2 }}>
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
      <Divider sx={{ m: 0 }} />
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ px: `${tokens.spacing[6]}px`, py: `${tokens.spacing[3]}px`, justifyContent: "space-between", gap: 1.5, color: "text.secondary" }}>
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
