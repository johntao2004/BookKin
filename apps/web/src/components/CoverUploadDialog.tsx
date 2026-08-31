import { ImageOutlined, RestartAltOutlined, UploadFileOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Book } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { cropCover } from "./BookUploadDialog";

const maximumCoverBytes = 20 * 1024 * 1024;
const acceptedCoverTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function CoverUploadDialog({ book, onClose, onCompleted }: {
  book: Book | null;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!book) {
      setCover(null);
      setPreviewUrl("");
      setError("");
    }
  }, [book]);

  useEffect(() => {
    if (!cover) return undefined;
    const url = URL.createObjectURL(cover);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const choose = async (file: File) => {
    setError("");
    if (!acceptedCoverTypes.has(file.type)) {
      setError("请选择 JPEG、PNG 或 WebP 图片。");
      return;
    }
    if (file.size > maximumCoverBytes) {
      setError("封面图片不能超过 20 MB。");
      return;
    }
    setPreparing(true);
    try {
      setCover(await cropCover(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法处理这张封面。");
    } finally {
      setPreparing(false);
    }
  };

  const upload = async () => {
    if (!book || !cover) return;
    setBusy(true);
    setError("");
    try {
      await api.updateBookCover(book.id, cover);
      onCompleted("书籍封面已更新");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "封面上传失败。");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!book) return;
    setBusy(true);
    setError("");
    try {
      await api.resetBookCover(book.id);
      onCompleted("已恢复文件内置封面");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "恢复默认封面失败。");
    } finally {
      setBusy(false);
    }
  };

  const displayedCover = previewUrl || book?.coverUrl;

  return (
    <Dialog open={Boolean(book)} onClose={busy || preparing ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle><Typography variant="h4" component="span">更换封面</Typography></DialogTitle>
      <DialogContent>
        {book && (
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: { xs: "center", sm: "flex-start" } }}>
              <Box
                component="img"
                src={displayedCover}
                alt={previewUrl ? "新封面预览" : `${book.title}当前封面`}
                sx={{
                  width: 160,
                  aspectRatio: "2 / 3",
                  objectFit: "cover",
                  borderRadius: `${tokens.radius.lg}px`,
                  bgcolor: "background.default",
                  boxShadow: tokens.shadow.cover,
                }}
              />
              <Stack spacing={2} sx={{ flex: 1, alignItems: { xs: "center", sm: "flex-start" }, textAlign: { xs: "center", sm: "left" } }}>
                <Box>
                  <Typography variant="h6">{book.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{book.author}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">选择一张竖版图片，系统会自动居中裁切为 2:3。支持 JPEG、PNG、WebP，最大 20 MB。</Typography>
                <Button
                  variant="outlined"
                  startIcon={preparing ? <CircularProgress size={18} /> : <ImageOutlined />}
                  disabled={busy || preparing}
                  onClick={() => input.current?.click()}
                >
                  {previewUrl ? "重新选择" : "选择图片"}
                </Button>
                <input
                  ref={input}
                  hidden
                  type="file"
                  aria-label="选择封面图片"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void choose(file);
                    event.target.value = "";
                  }}
                />
              </Stack>
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, flexWrap: "wrap", rowGap: 1 }}>
        <Button color="inherit" startIcon={<RestartAltOutlined />} disabled={busy || preparing} onClick={restore}>恢复默认封面</Button>
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" disabled={busy || preparing} onClick={onClose}>取消</Button>
        <Button variant="contained" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <UploadFileOutlined />} disabled={busy || preparing || !cover} onClick={upload}>
          {busy ? "正在上传…" : "确认更换"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
