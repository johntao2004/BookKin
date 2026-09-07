import { CheckCircleOutlined } from "@/ui/icons";
import { DriveFileRenameOutlineRounded } from "@/ui/icons";
import { GppGoodOutlined } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Checkbox } from "@/ui/forms";
import { CircularProgress } from "@/ui/feedback";
import { Dialog } from "@/ui/overlays";
import { DialogActions } from "@/ui/overlays";
import { DialogContent } from "@/ui/overlays";
import { DialogTitle } from "@/ui/overlays";
import { Divider } from "@/ui/feedback";
import { FormControlLabel } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { TextField } from "@/ui/forms";
import { Typography } from "@/ui/primitives";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Book, FileOperationPreview } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

interface PlannedRename {
  book: Book;
  targetPath: string;
  preview?: FileOperationPreview;
  error?: string;
}

export function BatchRenameDialog({ open, books, onClose, onCompleted }: {
  open: boolean;
  books: Book[];
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [template, setTemplate] = useState("{author}/{series}/{title}.{ext}");
  const [plans, setPlans] = useState<PlannedRename[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedBooks = useMemo(() => books.filter((book) => selectedIds.includes(book.id)).slice(0, 50), [books, selectedIds]);

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setPlans([]);
      setError("");
    }
  }, [open]);

  const toggle = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    setPlans([]);
  };

  const preview = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await Promise.all(selectedBooks.map(async (book): Promise<PlannedRename> => {
        const targetPath = renderTemplate(template, book);
        try { return { book, targetPath, preview: await api.previewFileOperation(book, "RENAME", targetPath) }; }
        catch (reason) { return { book, targetPath, error: reason instanceof Error ? reason.message : "预览失败" }; }
      }));
      setPlans(next);
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    const executable = plans.filter((plan): plan is PlannedRename & { preview: FileOperationPreview } => Boolean(plan.preview && plan.preview.conflicts.length === 0));
    setBusy(true);
    setError("");
    try {
      const results = await Promise.allSettled(executable.map((plan) => api.executeFileOperation(plan.preview)));
      const succeeded = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.length - succeeded;
      onCompleted(`已提交 ${succeeded} 个重命名任务${failed ? `，${failed} 个提交失败` : ""}`);
      if (failed === 0) onClose();
      else setError("部分任务未提交；已提交的任务不会重复创建，请到文件任务页核对。");
    } finally {
      setBusy(false);
    }
  };

  const executableCount = plans.filter((plan) => plan.preview && plan.preview.conflicts.length === 0).length;
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle><Typography variant="h4" component="span">批量重命名</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>只处理你明确勾选的书。先生成完整变更清单，再逐项提交幂等任务。</Typography></DialogTitle>
      <DialogContent>
        {plans.length === 0 ? <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField label="命名模板" value={template} onChange={(event: any) => setTemplate(event.target.value)} helperText="可用变量：{author}、{series}、{title}、{ext}。缺少系列时使用“未分类”。" />
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 1 }}><Typography sx={{ fontWeight: 700 }}>选择当前已加载的藏书（最多 50 本）</Typography><FormControlLabel control={<Checkbox checked={selectedBooks.length > 0 && selectedBooks.length === Math.min(books.length, 50)} onChange={(event: any) => setSelectedIds(event.target.checked ? books.slice(0, 50).map((book) => book.id) : [])} />} label="全选当前页" /></Stack>
          <Stack divider={<Divider flexItem />} sx={{ border: 1, borderColor: "divider", borderRadius: 2, maxHeight: 380, overflow: "auto" }}>
            {books.map((book) => <Stack key={book.id} direction="row" spacing={1.5} sx={{ alignItems: "center", px: 2, py: 1.25 }}><Checkbox checked={selectedIds.includes(book.id)} onChange={() => toggle(book.id)} slotProps={{ input: { "aria-label": `选择${book.title}` } }} /><Box component="img" src={book.coverUrl} alt="" sx={{ width: 34, aspectRatio: "2/3", objectFit: "cover", borderRadius: 0.5 }} /><Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 700 }}>{book.title}</Typography><Typography variant="body2" color="text.secondary" noWrap>{book.author} · {book.relativePath}</Typography></Box></Stack>)}
          </Stack>
        </Stack> : <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity={executableCount === plans.length ? "success" : "warning"} icon={<CheckCircleOutlined />}>已生成 {plans.length} 项变更，其中 {executableCount} 项可以提交。存在冲突的项目不会执行。</Alert>
          <Stack divider={<Divider flexItem />} sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
            {plans.map((plan) => <Box key={plan.book.id} sx={{ p: 2.25 }}><Typography sx={{ fontWeight: 700 }}>{plan.book.title}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>原：{plan.book.libraryRoot}/{plan.book.relativePath}</Typography><Typography variant="caption" sx={{ display: "block", fontFamily: tokens.typography.fontFamily.mono, overflowWrap: "anywhere" }}>新：{plan.book.libraryRoot}/{plan.targetPath}</Typography>{plan.error && <Alert severity="error" sx={{ mt: 1 }}>{plan.error}</Alert>}{plan.preview?.conflicts.map((conflict) => <Alert key={conflict.code} severity="error" sx={{ mt: 1 }}>{conflict.message}</Alert>)}</Box>)}
          </Stack>
        </Stack>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}><Button color="inherit" onClick={onClose} disabled={busy}>取消</Button>{plans.length > 0 && <Button color="inherit" onClick={() => setPlans([])} disabled={busy}>返回修改</Button>}<Box sx={{ flex: 1 }} />{plans.length === 0 ? <Button variant="contained" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <GppGoodOutlined />} disabled={busy || selectedBooks.length === 0 || !template.trim()} onClick={preview}>{busy ? "正在检查…" : `预览 ${selectedBooks.length} 项变更`}</Button> : <Button variant="contained" startIcon={<DriveFileRenameOutlineRounded />} disabled={busy || executableCount === 0} onClick={execute}>{busy ? "正在提交…" : `提交 ${executableCount} 个任务`}</Button>}</DialogActions>
    </Dialog>
  );
}

function renderTemplate(template: string, book: Book) {
  const segment = (value: string) => value.normalize("NFC").replaceAll("/", "／").replaceAll("\\", "＼").trim();
  return template
    .replaceAll("{author}", segment(book.author))
    .replaceAll("{series}", segment(book.series || "未分类"))
    .replaceAll("{title}", segment(book.title))
    .replaceAll("{ext}", book.format.toLowerCase());
}
