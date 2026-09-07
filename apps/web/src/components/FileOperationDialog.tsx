import { CheckCircleOutlined } from "@/ui/icons";
import { DeleteOutlineRounded } from "@/ui/icons";
import { ErrorOutlined } from "@/ui/icons";
import { FolderOutlined } from "@/ui/icons";
import { GppGoodOutlined } from "@/ui/icons";
import { RefreshRounded } from "@/ui/icons";
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
import { MenuItem } from "@/ui/primitives";
import { Select } from "@/ui/forms";
import { TextField } from "@/ui/forms";
import { Typography } from "@/ui/primitives";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Book, FileOperation, FileOperationPreview, FileOperationType, LibraryRoot } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

const labels: Record<FileOperationType, string> = {
  RENAME: "重命名书籍",
  MOVE: "移动到其他书库",
  TRASH: "移入回收站",
  RESTORE: "恢复文件",
  WRITE_METADATA: "写回元数据",
  PURGE: "永久清理",
};

interface FileOperationDialogProps {
  book: Book | null;
  type: FileOperationType | null;
  onClose: () => void;
  onCompleted: (operation: FileOperation) => void;
}

export function FileOperationDialog({ book, type, onClose, onCompleted }: FileOperationDialogProps) {
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [targetRootId, setTargetRootId] = useState("");
  const [rootsLoading, setRootsLoading] = useState(false);
  const [targetPath, setTargetPath] = useState("");
  const [preview, setPreview] = useState<FileOperationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setPreview(null);
    setError("");
    setLoading(false);
    setTargetRootId("");
    setRoots([]);
    setRootsLoading(false);
    if (book && type) {
      setTargetPath(type === "RENAME" ? book.title : type === "MOVE" ? book.relativePath : "");
      if (type === "MOVE") {
        setRootsLoading(true);
        void api.listLibraryRoots().then((result) => {
          if (active) setRoots(result);
        }).catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : "无法加载书库，请关闭后重试");
        }).finally(() => { if (active) setRootsLoading(false); });
      }
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
    return () => { active = false; };
  }, [book, type]);

  const createPreview = async () => {
    if (!book || !type) return;
    setLoading(true);
    setError("");
    try {
      setPreview(await (type === "MOVE"
        ? api.previewFileOperation(book, type, targetPath, targetRootId)
        : api.previewFileOperation(book, type, targetPath || undefined)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法生成预览");
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    if (!preview) return;
    setExecuting(true);
    setError("");
    try {
      const operation = await api.executeFileOperation(preview);
      onCompleted(operation);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "执行失败，源文件保持不变");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={Boolean(book && type)} onClose={executing ? undefined : onClose} fullWidth maxWidth={type === "TRASH" || type === "MOVE" ? "sm" : "md"}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h4" component="div">{type ? labels[type] : "文件操作"}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {type === "TRASH"
            ? "请确认是否将这本书移入回收站。"
            : type === "MOVE" ? "选择目标书库，校验通过后确认移动。"
            : "先由服务端计算真实路径、指纹、空间和冲突；确认后才会排入 Worker。"}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Box sx={{ p: 2.5, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, bgcolor: "background.default" }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Box component="img" src={book?.coverUrl} alt="" sx={{ width: 56, aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 1 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6">{book?.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={type === "TRASH" || type === "MOVE" ? undefined : { fontFamily: tokens.typography.fontFamily.mono, overflowWrap: "anywhere" }}>
                  {book ? type === "TRASH" || type === "MOVE" ? book.author : `${book.libraryRoot}/${book.relativePath}` : ""}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {type === "MOVE" && (
            <Stack spacing={2}>
              <Typography>当前书库：{book?.libraryRoot}</Typography>
              <Select label="目标书库" placeholder="选择目标书库" value={targetRootId || undefined}
                loading={rootsLoading} disabled={loading || executing || rootsLoading}
                onChange={(event) => { setTargetRootId(event.target.value); setPreview(null); setError(""); }}>
                {roots.filter((root) => root.name !== book?.libraryRoot).map((root) => (
                  <MenuItem key={root.id} value={root.id} disabled={!root.canWrite || root.status !== "ONLINE"}>
                    {root.name}{root.status === "OFFLINE" ? "（离线）" : !root.canWrite ? "（只读）" : ""}
                  </MenuItem>
                ))}
              </Select>
              {!rootsLoading && !error && !roots.some((root) => root.name !== book?.libraryRoot && root.canWrite && root.status === "ONLINE") &&
                <Alert severity="info">暂无可用的目标书库，请先在设置中添加可写书库。</Alert>}
              {preview && <Alert severity={preview.conflicts.length ? "error" : "success"}>
                {preview.conflicts.length ? preview.conflicts.map((conflict) => conflict.message).join("；") : "校验通过，可以移动。"}
              </Alert>}
            </Stack>
          )}

          {type === "RENAME" && (
            <TextField
              label="新书名"
              value={targetPath}
              onChange={(event: any) => { setTargetPath(event.target.value); setPreview(null); }}
              helperText="只填写书名；原目录和文件格式会自动保留，无需填写路径或扩展名。"
              fullWidth
            />
          )}

          {type === "MOVE" ? null : type === "TRASH" ? (
            <Stack spacing={2}>
              {(loading || (!preview && !error)) && (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", color: "text.secondary" }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2">正在检查文件状态…</Typography>
                </Stack>
              )}
              {preview && preview.conflicts.length === 0 && (
                <Alert severity="info">文件保留 30 天，可从回收站恢复；阅读记录和笔记不会删除。</Alert>
              )}
              {preview?.conflicts.map((conflict) => <Alert key={`${conflict.code}-${conflict.path}`} severity="error" icon={<ErrorOutlined />}>{conflict.message}</Alert>)}
              {!loading && error && <Button variant="text" startIcon={<RefreshRounded />} onClick={createPreview}>重试</Button>}
            </Stack>
          ) : !preview ? (
            <Button variant="outlined" startIcon={loading ? <CircularProgress size={18} /> : <GppGoodOutlined />} onClick={createPreview} disabled={loading || (type === "RENAME" && !targetPath.trim())}>
              {loading ? "正在安全检查…" : "生成安全预览"}
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
              <Button variant="text" startIcon={<RefreshRounded />} onClick={createPreview}>重新预览</Button>
            </Stack>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={executing}>取消</Button>
        {type === "MOVE" && (!preview || preview.conflicts.length > 0 || error) && <Button variant="contained" onClick={createPreview}
          disabled={!targetRootId || loading || rootsLoading} startIcon={loading ? <CircularProgress size={18} /> : undefined}>
          {loading ? "正在校验…" : "校验目标书库"}
        </Button>}
        {(type !== "MOVE" || preview) && <Button
          variant="contained"
          color={type === "TRASH" ? "error" : "primary"}
          startIcon={executing ? <CircularProgress color="inherit" size={18} /> : type === "TRASH" ? <DeleteOutlineRounded /> : <FolderOutlined />}
          disabled={!preview || preview.conflicts.length > 0 || executing || loading}
          onClick={execute}
        >
          {executing ? (type === "TRASH" ? "正在移入回收站…" : "正在提交…") : type === "TRASH" ? "确认移入回收站" : type === "MOVE" ? "确认移动" : "确认并执行"}
        </Button>}
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
