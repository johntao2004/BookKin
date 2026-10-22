import { usePermissions } from "../auth/permissions";
// 恢复和清理均经过安全预览，永久清理仍须主人权限与明确确认。
// Restore and purge use safety previews; permanent purge still requires owner authorization and confirmation.
import { EMPTY_RECYCLE_BIN_TITLE } from "../ui/empty-state-copy";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Chip } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { Dialog } from "@/ui/overlays";
import { DialogActions } from "@/ui/overlays";
import { DialogContent } from "@/ui/overlays";
import { DialogTitle } from "@/ui/overlays";
import { Snackbar } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { PageContainer, PageHeader } from "../components/PageHeader";
import type { FileOperationPreview, RecycleBinEntry } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { DataTable } from "../ui/antd";

const DAY_IN_MILLISECONDS = 86_400_000;

export function RecycleBinPage() {
  const client = useQueryClient();
  const [searchParams] = useSearchParams();
  const query = useQuery({ queryKey: ["recycle-bin"], queryFn: api.listRecycleBin });
  const { can } = usePermissions();
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
    <PageContainer>
      <PageHeader
        eyebrow="RECYCLE BIN"
        title="回收站"
        action={<Chip label={`${entries.length} 本待处理`} variant="outlined" />}
      />
      <Alert severity="warning" sx={{ mb: 4 }}>条目会在这里保留 30 天。恢复时不会覆盖同路径的新文件；到期后自动清理，只有主人可以提前永久清理。</Alert>

      {query.isError ? <Alert severity="error">回收站暂时无法读取，请检查网络与书库连接。</Alert> : (
        <DataTable<RecycleBinEntry>
          key={search}
          aria-label="回收站列表"
          rowKey="id"
          dataSource={entries}
          loading={query.isPending}
          scroll={{ x: tokens.spacing[24] * 8 + tokens.spacing[16] }}
          style={{ marginTop: tokens.spacing[4] }}
          locale={{ emptyText: query.isPending ? null : <BookCatalogEmptyState title={EMPTY_RECYCLE_BIN_TITLE} /> }}
          columns={[
            { title: "书名", dataIndex: "bookTitle", key: "title", render: (title: string) => <Typography variant="body2" sx={{ minWidth: `${tokens.spacing[24] * 2}px`, overflowWrap: "anywhere" }}>{title}</Typography> },
            { title: "作者", dataIndex: "bookAuthor", key: "author", width: tokens.spacing[24] + tokens.spacing[6], ellipsis: true, render: (author: string) => <Typography variant="body2" noWrap title={author}>{author || "—"}</Typography> },
            { title: "格式", dataIndex: "format", key: "format", width: tokens.spacing[20], render: (format: string) => <Chip label={format} size="small" variant="outlined" /> },
            { title: "移入时间", dataIndex: "deletedAt", key: "deleted", width: tokens.spacing[24] + tokens.spacing[6], render: (value: string) => <Typography component="time" dateTime={value} variant="body2" sx={{ whiteSpace: "nowrap" }}>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value))}</Typography> },
            { title: "剩余", key: "remaining", width: tokens.spacing[20], render: (_, entry) => {
              const days = Math.max(0, Math.ceil((new Date(entry.expiresAt).getTime() - referenceTime) / DAY_IN_MILLISECONDS));
              return <Typography variant="body2" color={days < 5 ? "warning.main" : "text.secondary"} sx={{ whiteSpace: "nowrap" }}>{days} 天</Typography>;
            } },
            { title: "操作", key: "actions", width: tokens.spacing[24] * 2 + tokens.spacing[4], render: (_, entry) => <Stack direction="row" sx={{ gap: `${tokens.spacing[2]}px`, whiteSpace: "nowrap" }}>
              <Button variant="outlined" disabled={busy || !can("settings.recycle.restore")} onClick={() => void openPreview(entry, "RESTORE")}>恢复</Button>
              {can("settings.recycle.purge") && <Button color="error" variant="outlined" disabled={busy} aria-label={`永久清理${entry.bookTitle}`} onClick={() => void openPreview(entry, "PURGE")}>永久清理</Button>}
            </Stack> },
          ]}
        />
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
        <DialogActions sx={{ p: 3 }}><Button onClick={() => setOperationTarget(null)} color="inherit" disabled={busy}>取消</Button><Button variant="contained" color={operationTarget?.type === "PURGE" ? "error" : "primary"} onClick={execute} disabled={!preview || preview.conflicts.length > 0 || busy}>{busy ? "提交中…" : operationTarget?.type === "PURGE" ? "永久清理" : "恢复"}</Button></DialogActions>
      </Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice("")} message={notice} />
    </PageContainer>
  );
}
