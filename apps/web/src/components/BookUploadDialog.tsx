import { AutoAwesomeOutlined } from "@/ui/icons";
import { CheckCircleOutlineRounded } from "@/ui/icons";
import { CloudUploadOutlined } from "@/ui/icons";
import { DeleteOutlineRounded } from "@/ui/icons";
import { EditNoteRounded } from "@/ui/icons";
import { ErrorOutlineRounded } from "@/ui/icons";
import { ImageOutlined } from "@/ui/icons";
import { InsertDriveFileOutlined } from "@/ui/icons";
import { WarningAmberRounded } from "@/ui/icons";
import { Alert } from "@/ui";
import { Box } from "@/ui";
import { Button } from "@/ui";
import { Chip } from "@/ui";
import { CircularProgress } from "@/ui";
import { Dialog } from "@/ui";
import { DialogActions } from "@/ui";
import { DialogContent } from "@/ui";
import { DialogTitle } from "@/ui";
import { Divider } from "@/ui";
import { FormControl } from "@/ui";
import { IconButton } from "@/ui";
import { InputLabel } from "@/ui";
import { LinearProgress } from "@/ui";
import { MenuItem } from "@/ui";
import { Select } from "@/ui";
import { Stack } from "@/ui";
import { TextField } from "@/ui";
import { Typography } from "@/ui";
import { useMediaQuery } from "@/ui";
import { useTheme } from "@/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { api } from "../api/client";
import type { BookMetadataDraft, BookUpload, LibraryRoot, MetadataCandidate, MetadataSource } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

interface LocalUpload {
  id: string;
  file: File;
  progress: number;
  state: "QUEUED" | "UPLOADING" | "UPLOADED" | "FAILED";
  uploadId?: string;
  error?: string;
}

const statusText: Record<BookUpload["status"], string> = {
  RECEIVING: "等待文件",
  INSPECTING: "正在识别",
  ENRICHING: "正在补全",
  READY_FOR_REVIEW: "等待校对",
  COMMITTING: "正在入库",
  SUCCEEDED: "已入库",
  DUPLICATE: "完全重复",
  FAILED: "处理失败",
  CANCELLED: "已取消",
  EXPIRED: "已过期",
};

const sourceText: Record<MetadataSource, string> = {
  FILE: "文件内置",
  FILENAME: "文件名推断",
  OPEN_LIBRARY: "Open Library",
  GOOGLE_BOOKS: "Google Books",
  MANUAL: "手工编辑",
};

export function BookUploadDialog({ open, initialRootId, publishToDisplay = false, onClose, onCompleted }: {
  open: boolean;
  initialRootId?: string;
  publishToDisplay?: boolean;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [rootId, setRootId] = useState(initialRootId ?? "");
  const [local, setLocal] = useState<LocalUpload[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rootsQuery = useQuery({ queryKey: ["library-roots"], queryFn: api.listLibraryRoots, enabled: open });
  const uploadsQuery = useQuery({
    queryKey: ["book-uploads"],
    queryFn: api.listBookUploads,
    enabled: open,
    refetchInterval: (query) => query.state.data?.some((item) => ["INSPECTING", "ENRICHING", "COMMITTING"].includes(item.status)) ? 1200 : 5000,
  });
  const writableRoots = useMemo(() => (rootsQuery.data ?? []).filter(isWritable), [rootsQuery.data]);
  const uploads = uploadsQuery.data ?? [];
  const review = uploads.find((item) => item.id === reviewId) ?? null;

  useEffect(() => {
    if (!open) return;
    if (initialRootId && writableRoots.some((root) => root.id === initialRootId)) setRootId(initialRootId);
    else if (!rootId && writableRoots[0]) setRootId(writableRoots[0].id);
  }, [initialRootId, open, rootId, writableRoots]);

  const addFiles = (files: FileList | File[]) => {
    setMessage("");
    const accepted = Array.from(files).filter((file) => /\.(epub|pdf)$/i.test(file.name));
    if (accepted.length !== files.length) setMessage("只支持 EPUB 和 PDF；压缩包不会加入队列。");
    setLocal((current) => {
      const remaining = Math.max(0, 20 - current.length);
      return [...current, ...accepted.slice(0, remaining).map((file) => ({ id: crypto.randomUUID(), file, progress: 0, state: "QUEUED" as const }))];
    });
  };

  const start = async () => {
    if (!rootId) return;
    const queue = local.filter((item) => item.state === "QUEUED" || item.state === "FAILED");
    if (queue.length === 0) return;
    setBusy(true);
    setMessage("");
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        setLocal((current) => patchLocal(current, item.id, { state: "UPLOADING", progress: 0, error: undefined }));
        try {
          const session = await api.createBookUpload({ libraryRootId: rootId, filename: item.file.name, sizeBytes: item.file.size });
          setLocal((current) => patchLocal(current, item.id, { uploadId: session.id }));
          await api.uploadBookContent(session.id, item.file, (progress) => setLocal((current) => patchLocal(current, item.id, { progress })));
          setLocal((current) => patchLocal(current, item.id, { state: "UPLOADED", progress: 100 }));
        } catch (reason) {
          setLocal((current) => patchLocal(current, item.id, { state: "FAILED", error: errorMessage(reason) }));
        }
      }
    };
    await Promise.all([worker(), worker()]);
    await uploadsQuery.refetch();
    setBusy(false);
  };

  const cancel = async (upload: BookUpload) => {
    try {
      await api.cancelBookUpload(upload.id);
      await uploadsQuery.refetch();
    } catch (reason) { setMessage(errorMessage(reason)); }
  };

  const commitAll = async () => {
    const ready = uploads.filter((item) => item.status === "READY_FOR_REVIEW");
    if (ready.length === 0) return;
    setBusy(true);
    try {
      for (const upload of ready) await api.commitBookUpload(upload.id, publishToDisplay);
      await Promise.all([uploadsQuery.refetch(), queryClient.invalidateQueries({ queryKey: ["books"] }), queryClient.invalidateQueries({ queryKey: ["display-books"] })]);
      onCompleted(publishToDisplay ? `已将 ${ready.length} 本书写入书库并加入公共书单` : `已将 ${ready.length} 本书安全写入书库`);
    } catch (reason) { setMessage(errorMessage(reason)); }
    finally { setBusy(false); }
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="lg" fullScreen={fullScreen}>
      <DialogTitle>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}>
          <Box><Typography variant="h4">{review ? "校对书籍信息" : "上传书籍"}</Typography><Typography variant="body2" color="text.secondary">{review ? review.originalFilename : "文件先进入暂存区，确认后才会写入 NAS 书库。"}</Typography></Box>
          {review && <Button color="inherit" onClick={() => setReviewId(null)}>返回队列</Button>}
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
        {review ? (
          <UploadReview upload={review} publishToDisplay={publishToDisplay} onChanged={async () => { await uploadsQuery.refetch(); }} onCommitted={async () => {
            await Promise.all([uploadsQuery.refetch(), queryClient.invalidateQueries({ queryKey: ["books"] }), queryClient.invalidateQueries({ queryKey: ["display-books"] })]);
            setReviewId(null);
            onCompleted("书籍已安全入库并建立索引");
          }} />
        ) : (
          <Stack spacing={3}>
            <FormControl fullWidth>
              <InputLabel id="upload-root-label">目标书库</InputLabel>
              <Select labelId="upload-root-label" label="目标书库" value={rootId} onChange={(event: any) => setRootId(event.target.value)}>
                {writableRoots.map((root) => <MenuItem key={root.id} value={root.id}>{root.name} · 可用 {formatBytes(root.freeBytes)}</MenuItem>)}
              </Select>
            </FormControl>
            {writableRoots.length === 0 && <Alert severity="warning">没有在线且具备写入、暂存能力的书库根目录。</Alert>}
            <Box
              onDragOver={(event: any) => event.preventDefault()}
              onDrop={drop}
              onClick={() => fileInput.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event: any) => { if (event.key === "Enter" || event.key === " ") fileInput.current?.click(); }}
              sx={{ border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 3, bgcolor: "background.default", px: 3, py: 5, textAlign: "center", cursor: "pointer", "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 } }}
            >
              <CloudUploadOutlined color="primary" sx={{ fontSize: 42 }} />
              <Typography variant="h5" sx={{ mt: 1 }}>拖入 EPUB 或 PDF</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>也可以点击选择，单次最多20本，不接受ZIP等压缩包</Typography>
              <input ref={fileInput} hidden multiple type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" onChange={(event: any) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
            </Box>
            {local.length > 0 && <LocalQueue items={local} onRemove={(id) => setLocal((current) => current.filter((item) => item.id !== id))} />}
            <PersistentQueue uploads={uploads} onReview={setReviewId} onCancel={cancel} />
            {message && <Alert severity="warning">{message}</Alert>}
          </Stack>
        )}
      </DialogContent>
      {!review && <DialogActions sx={{ p: 3, flexWrap: "wrap" }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>关闭</Button>
        <Box sx={{ flex: 1 }} />
        {uploads.some((item) => item.status === "READY_FOR_REVIEW") && <Button variant="outlined" onClick={commitAll} disabled={busy}>确认所有就绪项</Button>}
        <Button variant="contained" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <CloudUploadOutlined />} disabled={busy || !rootId || !local.some((item) => item.state === "QUEUED" || item.state === "FAILED")} onClick={start}>{busy ? "正在上传…" : "开始上传"}</Button>
      </DialogActions>}
    </Dialog>
  );
}

function LocalQueue({ items, onRemove }: { items: LocalUpload[]; onRemove: (id: string) => void }) {
  return <Stack spacing={1.25}>{items.map((item) => (
    <Stack key={item.id} direction="row" sx={{ gap: 1.5, alignItems: "center", border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}>
      <InsertDriveFileOutlined color={item.state === "FAILED" ? "error" : "action"} />
      <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" noWrap>{item.file.name}</Typography><Typography variant="caption" color={item.state === "FAILED" ? "error" : "text.secondary"}>{item.error ?? `${formatBytes(item.file.size)} · ${item.state === "QUEUED" ? "等待上传" : item.state === "UPLOADED" ? "上传完成，正在识别" : "正在上传"}`}</Typography>{item.state === "UPLOADING" && <LinearProgress variant="determinate" value={item.progress} sx={{ mt: 0.75 }} />}</Box>
      {item.state !== "UPLOADING" && <IconButton aria-label={`移除 ${item.file.name}`} onClick={() => onRemove(item.id)}><DeleteOutlineRounded /></IconButton>}
    </Stack>
  ))}</Stack>;
}

function PersistentQueue({ uploads, onReview, onCancel }: { uploads: BookUpload[]; onReview: (id: string) => void; onCancel: (upload: BookUpload) => void }) {
  const visible = uploads.filter((item) => !["CANCELLED", "EXPIRED"].includes(item.status));
  if (visible.length === 0) return null;
  return <Stack spacing={1.25}><Typography variant="h6">识别与入库队列</Typography>{visible.map((upload) => {
    const active = ["INSPECTING", "ENRICHING", "COMMITTING"].includes(upload.status);
    const error = ["FAILED", "DUPLICATE"].includes(upload.status);
    return <Stack key={upload.id} direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5, alignItems: { sm: "center" }, border: 1, borderColor: error ? "error.light" : "divider", borderRadius: 2, p: 2 }}>
      {active ? <CircularProgress size={22} /> : error ? <ErrorOutlineRounded color="error" /> : <CheckCircleOutlineRounded color={upload.status === "SUCCEEDED" ? "success" : "primary"} />}
      <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" noWrap>{upload.originalFilename}</Typography><Typography variant="caption" color={error ? "error" : "text.secondary"}>{statusText[upload.status]}{upload.errorDetail ? ` · ${upload.errorDetail}` : ""}</Typography></Box>
      {upload.status === "READY_FOR_REVIEW" && <Button startIcon={<EditNoteRounded />} onClick={() => onReview(upload.id)}>校对</Button>}
      {upload.status === "SUCCEEDED" && <Chip label="已完成" color="success" size="small" />}
      {!["COMMITTING", "SUCCEEDED"].includes(upload.status) && <IconButton aria-label={`取消 ${upload.originalFilename}`} onClick={() => onCancel(upload)}><DeleteOutlineRounded /></IconButton>}
    </Stack>;
  })}</Stack>;
}

function UploadReview({ upload, publishToDisplay, onChanged, onCommitted }: { upload: BookUpload; publishToDisplay: boolean; onChanged: () => Promise<void>; onCommitted: () => Promise<void> }) {
  const coverInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<BookMetadataDraft | null>(upload.draftMetadata ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setDraft(upload.draftMetadata ?? null), [upload]);
  if (!draft) return <Alert severity="info">识别尚未完成，请稍后返回。</Alert>;

  const update = <K extends keyof BookMetadataDraft>(key: K, value: BookMetadataDraft[K]) => setDraft((current) => current ? ({ ...current, [key]: value, sources: { ...current.sources, [key]: "MANUAL" } }) : current);
  const save = async () => run(async () => { await api.updateBookUploadMetadata(upload.id, draft); await onChanged(); });
  const commit = async () => run(async () => { await api.updateBookUploadMetadata(upload.id, draft); await api.commitBookUpload(upload.id, publishToDisplay); await onCommitted(); });
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(""); try { await action(); } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); } };
  const useCandidate = (candidate: MetadataCandidate) => {
    const provider = candidate.provider;
    setDraft((current) => current ? ({
      ...current,
      title: candidate.title ?? current.title,
      subtitle: candidate.subtitle ?? current.subtitle,
      authors: candidate.authors?.length ? candidate.authors : current.authors,
      publisher: candidate.publisher ?? current.publisher,
      publishedDate: candidate.publishedDate ?? current.publishedDate,
      isbn: candidate.isbn ?? current.isbn,
      description: candidate.description ?? current.description,
      tags: candidate.tags?.length ? candidate.tags : current.tags,
      sources: { ...current.sources, title: provider, subtitle: provider, authors: provider, publisher: provider, publishedDate: provider, isbn: provider, description: provider, tags: provider },
    }) : current);
  };
  const coverChanged = async (file: File) => run(async () => { const blob = await cropCover(file); await api.uploadBookCover(upload.id, blob); await onChanged(); });

  return <Stack spacing={3}>
    {upload.similarBookIds.length > 0 && <Alert severity="warning" icon={<WarningAmberRounded />}>发现标题和作者相似的藏书。它不是完全重复文件，确认后仍可作为独立版本入库。</Alert>}
    {(upload.encrypted || upload.drmProtected || upload.digitallySigned) && <Alert severity="warning">该文件包含{upload.encrypted ? "加密" : ""}{upload.drmProtected ? " DRM" : ""}{upload.digitallySigned ? "数字签名" : ""}标记；可以入库，但默认禁止元数据写回原文件。</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "240px minmax(0, 1fr)" }, gap: 4 }}>
      <Stack spacing={1.5} sx={{ alignItems: "stretch" }}>
        <Box component="img" src={upload.coverUrl} alt={`${draft.title}封面`} sx={{ width: "100%", maxWidth: 240, aspectRatio: "2 / 3", objectFit: "cover", bgcolor: "background.default", borderRadius: 2, boxShadow: tokens.shadow.cover }} />
        <Button startIcon={<ImageOutlined />} variant="outlined" onClick={() => coverInput.current?.click()}>更换封面</Button>
        <input ref={coverInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: any) => { const file = event.target.files?.[0]; if (file) void coverChanged(file); event.target.value = ""; }} />
        <Typography variant="caption" color="text.secondary">JPG、PNG或WebP会居中裁切为2:3，并以安全JPEG保存。</Typography>
      </Stack>
      <Stack spacing={2.25}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <SourcedField label="书名" required value={draft.title} source={draft.sources.title} onChange={(value) => update("title", value)} />
          <SourcedField label="副标题" value={draft.subtitle ?? ""} source={draft.sources.subtitle} onChange={(value) => update("subtitle", value)} />
          <SourcedField label="作者" required value={draft.authors.join("，")} source={draft.sources.authors} onChange={(value) => update("authors", split(value))} helperText="多位作者用逗号分隔" />
          <SourcedField label="译者" value={draft.translators.join("，")} source={draft.sources.translators} onChange={(value) => update("translators", split(value))} helperText="多位译者用逗号分隔" />
          <SourcedField label="语言" value={draft.language ?? ""} source={draft.sources.language} onChange={(value) => update("language", value)} placeholder="zh-CN" />
          <SourcedField label="出版社" value={draft.publisher ?? ""} source={draft.sources.publisher} onChange={(value) => update("publisher", value)} />
          <SourcedField label="出版日期" value={draft.publishedDate ?? ""} source={draft.sources.publishedDate} onChange={(value) => update("publishedDate", value)} />
          <SourcedField label="ISBN" value={draft.isbn ?? ""} source={draft.sources.isbn} onChange={(value) => update("isbn", value)} />
          <SourcedField label="系列" value={draft.series ?? ""} source={draft.sources.series} onChange={(value) => update("series", value)} />
          <SourcedField label="系列序号" value={draft.seriesIndex?.toString() ?? ""} source={draft.sources.seriesIndex} onChange={(value) => update("seriesIndex", value ? Number(value) : undefined)} />
          <SourcedField label="标签" value={draft.tags.join("，")} source={draft.sources.tags} onChange={(value) => update("tags", split(value))} helperText="最多50个" />
          <SourcedField label="目标路径" value={draft.targetPath} onChange={(value) => update("targetPath", value)} helperText="相对书库根目录，不会覆盖已有文件" />
        </Box>
        <SourcedField label="简介" value={draft.description ?? ""} source={draft.sources.description} onChange={(value) => update("description", value)} multiline minRows={5} />
      </Stack>
    </Box>
    <Divider />
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Chip label={upload.format} variant="outlined" /><Chip label={formatBytes(upload.declaredSizeBytes)} variant="outlined" /><Chip label={draft.pageCount ? `${draft.pageCount} 页` : draft.wordCount ? `${draft.wordCount.toLocaleString("zh-CN")} 字` : "页数/字数未知"} variant="outlined" /><Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center", overflowWrap: "anywhere" }}>{upload.fingerprint}</Typography></Stack>
    {upload.metadataCandidates.length > 0 && <Stack spacing={1.5}><Typography variant="h6">在线候选信息</Typography>{upload.metadataCandidates.map((candidate) => <CandidateCard key={`${candidate.provider}-${candidate.id}`} candidate={candidate} onUse={() => useCandidate(candidate)} onCover={candidate.coverUrl ? () => run(async () => { await api.selectBookUploadCover(upload.id, candidate.id); await onChanged(); }) : undefined} />)}</Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "flex-end", gap: 1.5 }}>
      <Button startIcon={<AutoAwesomeOutlined />} onClick={() => run(async () => { await api.enrichBookUpload(upload.id); await onChanged(); })} disabled={busy}>重新在线补全</Button>
      <Button variant="outlined" onClick={save} disabled={busy}>保存校对</Button>
      <Button variant="contained" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineRounded />} onClick={commit} disabled={busy || !draft.title.trim() || draft.authors.length === 0}>{busy ? "正在处理…" : "确认并安全入库"}</Button>
    </Stack>
  </Stack>;
}

function SourcedField({ label, value, source, onChange, required, helperText, placeholder, multiline, minRows }: { label: string; value: string; source?: MetadataSource; onChange: (value: string) => void; required?: boolean; helperText?: string; placeholder?: string; multiline?: boolean; minRows?: number }) {
  return <TextField label={label} value={value} required={required} placeholder={placeholder} multiline={multiline} minRows={minRows} onChange={(event: any) => onChange(event.target.value)} helperText={<Stack component="span" direction="row" spacing={0.75} sx={{ alignItems: "center" }}>{source && <Chip component="span" label={sourceText[source]} size="small" variant="outlined" />}{helperText && <Box component="span">{helperText}</Box>}</Stack>} />;
}

function CandidateCard({ candidate, onUse, onCover }: { candidate: MetadataCandidate; onUse: () => void; onCover?: () => void }) {
  return <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2, alignItems: { sm: "center" }, border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
    {candidate.coverUrl && <Box component="img" src={candidate.coverUrl} alt="在线候选封面" sx={{ width: 52, aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 1 }} />}
    <Box sx={{ flex: 1, minWidth: 0 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Typography variant="subtitle2">{candidate.title ?? "未命名候选"}</Typography><Chip label={sourceText[candidate.provider]} size="small" /></Stack><Typography variant="caption" color="text.secondary">{candidate.authors?.join(" / ")}{candidate.publisher ? ` · ${candidate.publisher}` : ""}{candidate.publishedDate ? ` · ${candidate.publishedDate}` : ""}</Typography></Box>
    <Stack direction="row" spacing={1}>{onCover && <Button size="small" onClick={onCover}>采用封面</Button>}<Button size="small" variant="outlined" onClick={onUse}>采用信息</Button></Stack>
  </Stack>;
}

function patchLocal(items: LocalUpload[], id: string, patch: Partial<LocalUpload>) { return items.map((item) => item.id === id ? { ...item, ...patch } : item); }
function isWritable(root: LibraryRoot) { return root.status === "ONLINE" && root.canWrite && root.canStage; }
function split(value: string) { return value.split(/[，,;；]/).map((item) => item.trim()).filter(Boolean); }
function formatBytes(value?: number | null) { if (value == null) return "未知"; if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} GB`; if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`; return `${Math.max(1, Math.round(value / 1000))} KB`; }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "操作失败"; }

export async function cropCover(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const targetRatio = 2 / 3;
  let width = bitmap.width;
  let height = bitmap.height;
  if (width / height > targetRatio) width = Math.round(height * targetRatio);
  else height = Math.round(width / targetRatio);
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 1200;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法处理这张封面");
  context.drawImage(bitmap, (bitmap.width - width) / 2, (bitmap.height - height) / 2, width, height, 0, 0, 800, 1200);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("封面转换失败")), "image/jpeg", 0.9));
}
