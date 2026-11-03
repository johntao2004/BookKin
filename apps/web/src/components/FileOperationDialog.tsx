import { BookCover } from "./BookCover";
import { CheckCircleOutlined } from "@/ui/icons";
import { ErrorOutlined } from "@/ui/icons";
import { WarningAmberRounded } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Chip } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { Dialog } from "@/ui/overlays";
import { DialogActions } from "@/ui/overlays";
import { DialogContent } from "@/ui/overlays";
import { DialogTitle } from "@/ui/overlays";
import { Divider } from "@/ui/feedback";
import { Stack } from "@/ui/primitives";
import { TextField } from "@/ui/forms";
import { Typography } from "@/ui/primitives";
import { useEffect, useRef, useState } from "react";
import { api, ApiRequestError } from "../api/client";
import type { Book, FileOperation, FileOperationPreview, FileOperationType } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

const labels: Record<Exclude<FileOperationType, "MOVE">, string> = {
  RENAME: "重命名书籍",
  TRASH: "移入回收站",
  RESTORE: "恢复文件",
  WRITE_METADATA: "写回元数据",
  PURGE: "永久清理",
};

const actionLabels: Record<Exclude<FileOperationType, "MOVE">, string> = {
  RENAME: "确认重命名",
  TRASH: "确认移入回收站",
  RESTORE: "确认恢复文件",
  WRITE_METADATA: "确认写回原文件",
  PURGE: "确认永久清理",
};

const progressLabels: Record<Exclude<FileOperationType, "MOVE">, string> = {
  RENAME: "正在重命名…",
  TRASH: "正在移入回收站…",
  RESTORE: "正在恢复文件…",
  WRITE_METADATA: "正在写回元数据…",
  PURGE: "正在永久清理…",
};

interface FileOperationDialogProps {
  book: Book | null;
  type: FileOperationType | null;
  onClose: () => void;
  onCompleted: (operation: FileOperation) => void;
}

export function FileOperationDialog({ book, type: requestedType, onClose, onCompleted }: FileOperationDialogProps) {
  const type = requestedType === "MOVE" ? null : requestedType;
  const [targetPath, setTargetPath] = useState("");
  const [preview, setPreview] = useState<FileOperationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");

  const revision = useRef(0);
  const attemptedRename = useRef<FileOperationPreview | null>(null);
  const renameName = targetPath.trim();
  const extension = book ? `.${book.format.toLowerCase()}` : "";
  const renameStem = extension && renameName.toLowerCase().endsWith(extension) ? renameName.slice(0, -extension.length) : renameName;
  const sourceStem = book?.relativePath.split("/").at(-1)?.replace(/\.(epub|pdf)$/iu, "");
  const renameInvalid = !renameStem || (/[\\/:*?"<>|]/u.test(renameName) || [...renameName].some(character => character.charCodeAt(0) < 32)) || /^\.+$/u.test(renameStem);
  const renameUnchanged = Boolean(book && renameStem === sourceStem);
  const renameReady = !renameInvalid && !renameUnchanged;
  const previewUnchanged = type === "RENAME" && Boolean(preview?.targetPath && preview.targetPath === preview.sourcePath);

  useEffect(() => {
    let active = true;
    revision.current += 1;
    attemptedRename.current = null;
    setPreview(null);
    setError("");
    setLoading(false);
    setExecuting(false);
    if (book && type) {
      setTargetPath(type === "RENAME" ? book.title : "");
      if (type === "TRASH") {
        setLoading(true);
        void api.previewFileOperation(book, type).then((result) => {
          if (active) setPreview(result);
        }).catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : "无法完成删除前的安全检查");
        }).finally(() => {
          if (active) setLoading(false);
        });
      }
    }
    return () => { active = false; revision.current += 1; attemptedRename.current = null; };
  }, [book, type]);

  // 名称变化自动检查，丢弃旧名称的异步响应。
  // Automatically check edited names and discard stale responses.
  useEffect(() => {
    if (!book || type !== "RENAME" || !renameReady) return;
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void api.previewFileOperation(book, "RENAME", renameName).then(result => {
        if (active) setPreview(result);
      }).catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "无法检查书名，请重试");
      }).finally(() => { if (active) setLoading(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [book, type, renameName, renameReady]);

  // 预览描述服务器检查结果，不能代替提交时的指纹与权限校验。
  // Preview describes server checks but cannot replace submission-time fingerprint and permission validation.
  const createPreview = async () => {
    if (!book || !type) return;
    setLoading(true);
    setError("");
    try {
      setPreview(await api.previewFileOperation(book, type, targetPath || undefined));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法生成预览");
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    if (!book || !type || (type === "RENAME" && !renameReady)) return;
    if (type !== "RENAME" && !preview) return;
    const requestRevision = revision.current;
    setExecuting(true);
    setError("");
    try {
      // 请求结果不确定时沿用原预览与幂等键，不能因到期创建第二个任务。
      // Retry uncertain submissions with their original preview and idempotency key.
      const retryingRename = type === "RENAME" && attemptedRename.current !== null;
      let checked = retryingRename ? attemptedRename.current : preview;
      if (type === "RENAME" && !retryingRename && (!checked || !Number.isFinite(Date.parse(checked.expiresAt)) || Date.parse(checked.expiresAt) <= Date.now())) {
        checked = await api.previewFileOperation(book, type, renameName);
        if (requestRevision !== revision.current) return;
        setPreview(checked);
      }
      if (!checked || checked.conflicts.length > 0) return;
      if (type === "RENAME" && !retryingRename && (!Number.isFinite(Date.parse(checked.expiresAt)) || Date.parse(checked.expiresAt) <= Date.now())) {
        setPreview(null);
        setError("书名检查已过期，请重试");
        return;
      }
      if (type === "RENAME" && checked.targetPath === checked.sourcePath) {
        return;
      }
      if (type === "RENAME") attemptedRename.current = checked;
      const operation = await api.executeFileOperation(checked);
      if (requestRevision !== revision.current) return;
      onCompleted(operation);
      onClose();
    } catch (reason) {
      if (requestRevision === revision.current) {
        if (type === "RENAME" && reason instanceof ApiRequestError && reason.code === "PREVIEW_EXPIRED") {
          attemptedRename.current = null;
          setPreview(null);
        }
        setError(reason instanceof Error ? reason.message : "执行失败，源文件保持不变");
      }
    } finally {
      if (requestRevision === revision.current) setExecuting(false);
    }
  };

  return (
    <Dialog open={Boolean(book && type)} onClose={executing ? undefined : onClose} fullWidth maxWidth={type === "TRASH" || type === "RENAME" ? "sm" : "md"}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h4" component="div">{type ? labels[type] : "文件操作"}</Typography>
        {type !== "RENAME" && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {type === "TRASH"
            ? "请确认是否将这本书移入回收站。"
            : "先检查文件位置、可用空间和名称冲突，确认预览后再执行。"}
        </Typography>}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Box sx={{ p: 2.5, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, bgcolor: "background.default" }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <BookCover src={book?.coverUrl} alt="" sx={{ width: `${tokens.spacing[12]}px` }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6">{book?.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={type === "TRASH" || type === "RENAME" ? undefined : { fontFamily: tokens.typography.fontFamily.mono, overflowWrap: "anywhere" }}>
                  {book ? type === "TRASH" || type === "RENAME" ? book.author : `${book.libraryRoot}/${book.relativePath}` : ""}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {type === "RENAME" && (
            <TextField
              label="新书名"
              value={targetPath}
              disabled={executing}
              onChange={(event: any) => { revision.current += 1; attemptedRename.current = null; setTargetPath(event.target.value); setPreview(null); setLoading(false); setError(""); }}
              error={Boolean(renameName && renameInvalid)}
              helperText={renameName && renameInvalid ? '书名不能仅由句点组成，也不能包含斜杠、反斜杠、冒号、星号、问号、引号、尖括号或竖线。' : "只填写书名；原目录和文件格式会自动保留，无需填写路径或扩展名。"}
              fullWidth
            />
          )}

          {type === "TRASH" ? (
            <Stack spacing={2}>
              {(loading || (!preview && !error)) && (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", color: "text.secondary" }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2">正在检查文件状态…</Typography>
                </Stack>
              )}
              {preview && preview.conflicts.length === 0 && (
                <Typography variant="body2" color="text.secondary">文件保留 30 天，可从回收站恢复；阅读记录和笔记不会删除。</Typography>
              )}
              {preview?.conflicts.map((conflict) => <Alert key={`${conflict.code}-${conflict.path}`} severity="error" icon={<ErrorOutlined />}>{conflict.message}</Alert>)}
              {!loading && error && <Button variant="outlined" onClick={createPreview}>重试</Button>}
            </Stack>
          ) : type === "RENAME" ? (
            <Stack spacing={2}>
              {loading && <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", color: "text.secondary" }}><CircularProgress size={18} /><Typography variant="body2">正在检查书名…</Typography></Stack>}
              {preview?.warnings.map(warning => <Alert key={warning} severity="warning">{warning}</Alert>)}
              {!previewUnchanged && preview?.conflicts.map(conflict => <Alert key={`${conflict.code}-${conflict.path}`} severity="error">{conflict.message}</Alert>)}
            </Stack>
          ) : !preview ? (
            <Button variant="outlined" startIcon={loading ? <CircularProgress size={18} /> : undefined} onClick={createPreview} disabled={loading}>
              {loading ? "检查中…" : "预览"}
            </Button>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><CheckCircleOutlined color="success" /><Typography sx={{ fontWeight: 600 }}>预览已生成</Typography></Stack>
                <Chip label={`5 分钟内有效`} size="small" />
              </Stack>
              <Divider />
              <PathRow label="源路径" value={preview.sourcePath} />
              {preview.targetPath && <PathRow label="目标路径" value={preview.targetPath} />}
              <PathRow label="预期指纹" value={preview.expectedFingerprint} />
              <PathRow label="空间需求" value={preview.requiredBytes ? `${(preview.requiredBytes / 1024 / 1024).toFixed(1)} MB` : "无需额外空间"} />
              {preview.warnings.map((warning) => <Alert key={warning} severity="warning" icon={<WarningAmberRounded />}>{warning}</Alert>)}
              {preview.conflicts.map((conflict) => <Alert key={`${conflict.code}-${conflict.path}`} severity="error" icon={<ErrorOutlined />}>{conflict.message}<br />{conflict.path}</Alert>)}
              <Button variant="outlined" onClick={createPreview}>更新预览</Button>
            </Stack>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={executing}>取消</Button>
        <Button
          variant="contained"
          color={type === "TRASH" ? "error" : "primary"}
          startIcon={executing ? <CircularProgress color="inherit" size={18} /> : undefined}
          disabled={executing || loading || (type === "RENAME" ? !renameReady || previewUnchanged || Boolean(preview?.conflicts.length) : !preview || preview.conflicts.length > 0)}
          onClick={execute}
        >
          {executing ? (type ? progressLabels[type] : "正在处理…") : type ? actionLabels[type] : "确认操作"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "120px 1fr" }, gap: 1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: tokens.typography.fontFamily.mono, overflowWrap: "anywhere" }}>{value}</Typography>
    </Box>
  );
}
