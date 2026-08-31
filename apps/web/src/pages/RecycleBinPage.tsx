import { DeleteForeverOutlined, RestoreFromTrashOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageContainer, PageHeader } from "../components/PageHeader";
import type { FileOperationPreview, RecycleBinEntry } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

const DAY_IN_MILLISECONDS = 86_400_000;

export function RecycleBinPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [searchParams] = useSearchParams();
  const query = useQuery({ queryKey: ["recycle-bin"], queryFn: api.listRecycleBin });
  const [operationTarget, setOperationTarget] = useState<{ entry: RecycleBinEntry; type: "RESTORE" | "PURGE" } | null>(null);
  const [preview, setPreview] = useState<FileOperationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [referenceTime] = useState(() => Date.now());
  const search = useDeferredValue(searchParams.get("q")?.trim().toLocaleLowerCase("zh-CN") ?? "");
  const entries = useMemo(() => (query.data ?? []).filter((entry) => {
    if (!search) return true;
    return [entry.bookTitle, entry.bookAuthor, entry.originalPath, entry.format]
      .some((value) => value.toLocaleLowerCase("zh-CN").includes(search));
  }), [query.data, search]);

  const removeLocal = (id: string) => client.setQueryData<RecycleBinEntry[]>(["recycle-bin"], (current = []) => current.filter((entry) => entry.id !== id));
  const openPreview = async (entry: RecycleBinEntry, type: "RESTORE" | "PURGE") => {
    setOperationTarget({ entry, type });
    setPreview(null);
    setBusy(true);
    try { setPreview(await api.previewRecycleOperation(entry, type)); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "预览失败"); setOperationTarget(null); }
    finally { setBusy(false); }
  };
  const execute = async () => {
    if (!operationTarget || !preview) return;
    setBusy(true);
    try {
      await api.executeRecycleOperation(operationTarget.entry, preview);
      removeLocal(operationTarget.entry.id);
      void client.invalidateQueries({ queryKey: ["books"] });
      setNotice(operationTarget.type === "RESTORE"
        ? `《${operationTarget.entry.bookTitle}》恢复任务已提交`
        : `《${operationTarget.entry.bookTitle}》永久清理任务已提交`);
      setOperationTarget(null);
      setPreview(null);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "操作失败"); }
    finally { setBusy(false); }
  };

  return (
    <PageContainer sx={{ pt: { xs: 3, md: 5 } }}>
      <PageHeader
        eyebrow="RECYCLE BIN"
        title="回收站"
        description="从藏书中移除的书会进入这里，保留 30 天。"
        action={<Chip label={`${entries.length} 本待处理`} variant="outlined" />}
      />
      <Alert severity="warning" sx={{ mb: 4 }}>恢复时不会覆盖同路径的新文件；到期后自动清理，只有主人可以提前永久清理。</Alert>

      {query.isPending ? (
        <Stack spacing={2} sx={{ py: 12, alignItems: "center" }}><CircularProgress /><Typography color="text.secondary">正在打开回收站…</Typography></Stack>
      ) : query.isError ? (
        <Alert severity="error">回收站暂时无法读取，请检查 API 与 NAS 状态。</Alert>
      ) : entries.length === 0 ? (
        <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center", py: 12 }}>
          <RestoreFromTrashOutlined sx={{ fontSize: 44, color: "text.disabled" }} />
          <Typography variant="h4">{search ? "没有找到匹配的书" : "回收站是空的"}</Typography>
          <Typography color="text.secondary">{search ? "可以按书名、作者、格式或原路径搜索。" : "从藏书中删除的书会以书籍卡片出现在这里。"}</Typography>
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" }, gap: { xs: 2, sm: 3, md: 4 } }}>
          {entries.map((entry) => (
            <RecycleBookCard
              key={entry.id}
              entry={entry}
              daysRemaining={Math.max(0, Math.ceil((new Date(entry.expiresAt).getTime() - referenceTime) / DAY_IN_MILLISECONDS))}
              canPurge={user?.role === "OWNER"}
              onRestore={() => void openPreview(entry, "RESTORE")}
              onPurge={() => void openPreview(entry, "PURGE")}
            />
          ))}
        </Box>
      )}

      <Dialog open={Boolean(operationTarget)} onClose={() => !busy && setOperationTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{operationTarget?.type === "RESTORE" ? "确认恢复这本书" : "确认永久清理"}</DialogTitle>
        <DialogContent>
          {busy && !preview ? <Stack sx={{ py: 6, alignItems: "center" }}><CircularProgress size={28} /></Stack> : preview && (
            <Stack spacing={2}>
              <Typography color="text.secondary">执行前已重新核对真实路径、文件指纹和冲突，已有文件不会被覆盖。</Typography>
              <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: `${tokens.radius.md}px` }}><Typography variant="overline" color="text.secondary">源文件</Typography><Typography sx={{ overflowWrap: "anywhere" }}>{preview.sourcePath}</Typography></Box>
              {preview.targetPath && <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: `${tokens.radius.md}px` }}><Typography variant="overline" color="text.secondary">目标路径</Typography><Typography sx={{ overflowWrap: "anywhere" }}>{preview.targetPath}</Typography></Box>}
              {preview.warnings.map((warning) => <Alert key={warning} severity={operationTarget?.type === "PURGE" ? "error" : "warning"}>{warning}</Alert>)}
              {preview.conflicts.map((conflict) => <Alert key={`${conflict.code}-${conflict.path}`} severity="error">{conflict.message}</Alert>)}
              <Typography variant="caption" color="text.secondary">预览将在 {new Date(preview.expiresAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 失效</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}><Button onClick={() => setOperationTarget(null)} color="inherit" disabled={busy}>取消</Button><Button variant="contained" color={operationTarget?.type === "PURGE" ? "error" : "primary"} onClick={execute} disabled={!preview || preview.conflicts.length > 0 || busy}>{busy ? "提交中…" : operationTarget?.type === "PURGE" ? "确认永久清理" : "确认恢复"}</Button></DialogActions>
      </Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice("")} message={notice} />
    </PageContainer>
  );
}

function RecycleBookCard({ entry, daysRemaining, canPurge, onRestore, onPurge }: {
  entry: RecycleBinEntry;
  daysRemaining: number;
  canPurge: boolean;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  return (
    <Card sx={{ bgcolor: "transparent", overflow: "visible", contentVisibility: "auto", containIntrinsicSize: "420px" }}>
      <Box sx={{ position: "relative", aspectRatio: "2 / 3", borderRadius: `${tokens.radius.lg}px`, overflow: "hidden", bgcolor: "background.paper", boxShadow: tokens.shadow.cover }}>
        {coverFailed ? (
          <Stack sx={{ height: "100%", p: 3, alignItems: "center", justifyContent: "center", textAlign: "center", bgcolor: "background.paper" }}>
            <Typography variant="overline" color="primary.main">BookKin藏书</Typography>
            <Typography variant="h5" sx={{ mt: 1 }}>{entry.bookTitle}</Typography>
          </Stack>
        ) : (
          <Box component="img" src={entry.coverUrl} alt={`${entry.bookTitle}封面`} loading="lazy" decoding="async" fetchPriority="low" onError={() => setCoverFailed(true)} sx={{ width: "100%", height: "100%", display: "block", objectFit: "cover", filter: "grayscale(28%)", opacity: 0.78 }} />
        )}
        <Chip label={`剩余 ${daysRemaining} 天`} size="small" color={daysRemaining < 5 ? "warning" : "default"} sx={{ position: "absolute", top: 12, right: 12, bgcolor: "background.paper" }} />
      </Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", justifyContent: "space-between", mt: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" noWrap title={entry.bookTitle}>{entry.bookTitle}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{entry.bookAuthor}</Typography>
        </Box>
        <Chip label={entry.format} size="small" variant="outlined" color="warning" />
      </Stack>
      <Typography variant="caption" color="text.disabled" noWrap sx={{ display: "block", mt: 1 }}>移入 {new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(entry.deletedAt))}</Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button fullWidth variant="outlined" size="small" startIcon={<RestoreFromTrashOutlined />} onClick={onRestore}>恢复</Button>
        {canPurge && <Button color="error" variant="outlined" size="small" aria-label={`永久清理${entry.bookTitle}`} onClick={onPurge}><DeleteForeverOutlined fontSize="small" /></Button>}
      </Stack>
    </Card>
  );
}
