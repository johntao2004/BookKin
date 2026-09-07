import { useNavigate } from "react-router-dom";
import { randomId } from "../utils/random-id";
import { AutoAwesomeOutlined } from "@/ui/icons";
import { CheckCircleOutlineRounded } from "@/ui/icons";
import { CloudUploadOutlined } from "@/ui/icons";
import { DeleteOutlineRounded } from "@/ui/icons";
import { ImageOutlined } from "@/ui/icons";
import { InsertDriveFileOutlined } from "@/ui/icons";
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
import { FormControl } from "@/ui/primitives";
import { IconButton } from "@/ui/buttons";
import { InputLabel } from "@/ui/primitives";
import { LinearProgress } from "@/ui/feedback";
import { MenuItem } from "@/ui/primitives";
import { Select } from "@/ui/forms";
import { Stack } from "@/ui/primitives";
import { TextField } from "@/ui/forms";
import { Typography } from "@/ui/primitives";
import { useQuery } from "@tanstack/react-query";
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

const sourceText: Record<MetadataSource, string> = {
  FILE: "文件内置",
  FILENAME: "文件名推断",
  OPEN_LIBRARY: "Open Library",
  GOOGLE_BOOKS: "Google Books",
  AI: "AI 候选",
  MANUAL: "手工编辑",
};

export function BookUploadDialog({ open, initialRootId, publishToDisplay = false, onClose }: {
  open: boolean; initialRootId?: string; publishToDisplay?: boolean;
  onClose: () => void; onCompleted: (message: string) => void;
}) {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [rootId, setRootId] = useState(initialRootId ?? "");
  const [local, setLocal] = useState<LocalUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rootsQuery = useQuery({ queryKey: ["library-roots"], queryFn: api.listLibraryRoots, enabled: open });
  const pendingQuery = useQuery({ queryKey: ["book-uploads"], queryFn: api.listBookUploads, enabled: open });
  const writableRoots = useMemo(() => (rootsQuery.data ?? []).filter(isWritable), [rootsQuery.data]);
  const completedIds = local.filter(item => item.state === "UPLOADED" && item.uploadId).map(item => item.uploadId!);
  const pendingIds = (pendingQuery.data ?? []).filter(item => ["READY_FOR_REVIEW", "INSPECTING", "ENRICHING"].includes(item.status)).map(item => item.id);
  const editIds = [...new Set([...completedIds, ...pendingIds])];
  useEffect(() => {
    if (!open) return;
    if (!rootId && writableRoots[0]) setRootId(writableRoots[0].id);
  }, [open, rootId, writableRoots]);

  const start = async (queue: LocalUpload[]) => {
    if (!rootId || uploading.current || !queue.length) return;
    uploading.current = true;
    setBusy(true);
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        setLocal(current => patchLocal(current, item.id, { state: "UPLOADING", error: undefined }));
        try {
          const session = await api.createBookUpload({ libraryRootId: rootId, filename: item.file.name, sizeBytes: item.file.size });
          await api.uploadBookContent(session.id, item.file, progress => setLocal(current => patchLocal(current, item.id, { progress })));
          setLocal(current => patchLocal(current, item.id, { uploadId: session.id, state: "UPLOADED", progress: 100 }));
        } catch (reason) {
          setLocal(current => patchLocal(current, item.id, { state: "FAILED", error: errorMessage(reason) }));
        }
      }
    };
    try { await Promise.all([worker(), worker()]); }
    finally { uploading.current = false; setBusy(false); }
  };
  const addFiles = (files: FileList | File[]) => {
    if (uploading.current || !rootId) return;
    const accepted = Array.from(files).filter(file => /\.(epub|pdf)$/i.test(file.name));
    setMessage(accepted.length !== files.length ? "只支持 EPUB 和 PDF。" : accepted.length > 20 ? "单次最多上传20本，其余文件请下一次上传。" : "");
    const queue: LocalUpload[] = accepted.slice(0, 20).map(file => ({ id: randomId(), file, progress: 0, state: "QUEUED" }));
    setLocal(current => [...current, ...queue]);
    void start(queue);
  };
  const edit = () => {
    onClose();
    setLocal([]);
    navigate(`/library/uploads/${editIds[0]}?${new URLSearchParams({ next: editIds.slice(1).join(","), publish: String(publishToDisplay) })}`);
  };
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle><Typography component="span" variant="h4">上传书籍</Typography><Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block" }}>选择或拖入文件即可自动上传。</Typography></DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <FormControl fullWidth><InputLabel id="upload-root-label">目标书库</InputLabel><Select labelId="upload-root-label" label="目标书库" value={rootId} disabled={busy} onChange={(event: any) => setRootId(event.target.value)}>{writableRoots.map(root => <MenuItem key={root.id} value={root.id}>{root.name} · 可用 {formatBytes(root.freeBytes)}</MenuItem>)}</Select></FormControl>
        {rootsQuery.isError && <Alert severity="error">无法加载书库，请关闭后重试。</Alert>}
        {!rootsQuery.isPending && writableRoots.length === 0 && <Alert severity="warning">没有可上传的书库。</Alert>}
        <Box onDragOver={(event: any) => event.preventDefault()} onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} sx={{ border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 3, bgcolor: "background.default", p: 2, textAlign: "center" }}>
          <CloudUploadOutlined color="primary" sx={{ fontSize: 42 }} /><Typography variant="h5">拖入 EPUB 或 PDF</Typography><Typography color="text.secondary">单次最多20本</Typography>
          <input ref={fileInput} hidden multiple type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" onChange={(event: any) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
        </Box>
        {local.length > 0 && <LocalQueue items={local} onRemove={id => setLocal(current => current.filter(item => item.id !== id))} />}
        {!busy && editIds.length > 0 && <Alert severity="success">已上传。你可以更改书籍信息，点击“确定”进入编辑页面。</Alert>}
        {message && <Alert severity="warning">{message}</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      {!busy && editIds.length > 0 ? <Button variant="contained" onClick={edit}>确定</Button> : <Button variant="contained" disabled={busy || !rootId} startIcon={busy ? <CircularProgress size={18} /> : <CloudUploadOutlined />} onClick={() => { const failed = local.filter(item => item.state === "FAILED"); if (failed.length) void start(failed); else fileInput.current?.click(); }}>{busy ? "正在上传…" : "开始上传"}</Button>}
    </DialogActions>
  </Dialog>;
}

function LocalQueue({ items, onRemove }: { items: LocalUpload[]; onRemove: (id: string) => void }) {
  return <Stack spacing={1.25}>{items.map((item) => (
    <Stack key={item.id} direction="row" sx={{ gap: 1.5, alignItems: "center", border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}>
      <InsertDriveFileOutlined color={item.state === "FAILED" ? "error" : "action"} />
      <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" noWrap>{item.file.name}</Typography><Typography variant="caption" color={item.state === "FAILED" ? "error" : "text.secondary"}>{item.error ?? `${formatBytes(item.file.size)} · ${item.state === "QUEUED" ? "等待上传" : item.state === "UPLOADED" ? "已上传" : "正在上传"}`}</Typography>{item.state === "UPLOADING" && <LinearProgress variant="determinate" value={item.progress} sx={{ mt: 0.75 }} />}</Box>
      {item.state !== "UPLOADING" && <IconButton aria-label={`移除 ${item.file.name}`} onClick={() => onRemove(item.id)}><DeleteOutlineRounded /></IconButton>}
    </Stack>
  ))}</Stack>;
}

export function UploadReview({ upload, publishToDisplay, onChanged, onCommitted }: { upload: BookUpload; publishToDisplay: boolean; onChanged: () => Promise<void>; onCommitted: () => Promise<void> }) {
  const coverInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<BookMetadataDraft | null>(upload.draftMetadata ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setDraft(upload.draftMetadata ?? null), [upload]);
  if (!draft) return <Alert severity="info">正在准备书籍信息…</Alert>;

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

  return <Stack spacing={2}>
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
    {upload.metadataCandidates.length > 0 && <Stack spacing={1.5}><Typography variant="h6">候选书目信息</Typography>{upload.metadataCandidates.map((candidate) => <CandidateCard key={`${candidate.provider}-${candidate.id}`} candidate={candidate} onUse={() => useCandidate(candidate)} onCover={candidate.coverUrl ? () => run(async () => { await api.selectBookUploadCover(upload.id, candidate.id); await onChanged(); }) : undefined} />)}</Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "flex-end", gap: 1.5 }}>
      <Button startIcon={<AutoAwesomeOutlined />} onClick={() => run(async () => { await api.enrichBookUpload(upload.id); await onChanged(); })} disabled={busy}>重新在线补全</Button>
      <Button startIcon={<AutoAwesomeOutlined />} color="secondary" onClick={() => run(async () => { await api.aiMatchBookUpload(upload.id); await onChanged(); })} disabled={busy}>AI 查找未匹配</Button>
      <Button variant="outlined" onClick={save} disabled={busy}>保存草稿</Button>
      <Button variant="contained" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineRounded />} onClick={commit} disabled={busy || !draft.title.trim() || draft.authors.length === 0}>{busy ? "正在处理…" : "保存并完成"}</Button>
    </Stack>
  </Stack>;
}

function SourcedField({ label, value, source, onChange, required, helperText, placeholder, multiline, minRows }: { label: string; value: string; source?: MetadataSource; onChange: (value: string) => void; required?: boolean; helperText?: string; placeholder?: string; multiline?: boolean; minRows?: number }) {
  return <TextField label={label} value={value} required={required} placeholder={placeholder} multiline={multiline} minRows={minRows} onChange={(event: any) => onChange(event.target.value)} helperText={<Stack component="span" direction="row" spacing={0.75} sx={{ alignItems: "center" }}>{source && <Chip component="span" label={sourceText[source]} size="small" variant="outlined" />}{helperText && <Box component="span">{helperText}</Box>}</Stack>} />;
}

function CandidateCard({ candidate, onUse, onCover }: { candidate: MetadataCandidate; onUse: () => void; onCover?: () => void }) {
  return <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2, alignItems: { sm: "center" }, border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
    {candidate.coverUrl && <Box component="img" src={candidate.coverUrl} alt="在线候选封面" sx={{ width: 52, aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 1 }} />}
    <Box sx={{ flex: 1, minWidth: 0 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="subtitle2">{candidate.title ?? "未命名候选"}</Typography><Chip label={candidate.providerLabel ?? sourceText[candidate.provider]} size="small" />{candidate.requiresReview && <Chip label={`需核对${candidate.confidence != null ? ` · ${Math.round(candidate.confidence * 100)}%` : ""}`} size="small" color="warning" variant="outlined" />}</Stack><Typography variant="caption" color="text.secondary">{candidate.authors?.join(" / ")}{candidate.publisher ? ` · ${candidate.publisher}` : ""}{candidate.publishedDate ? ` · ${candidate.publishedDate}` : ""}</Typography>{candidate.matchReason && <Typography variant="caption" color="text.secondary">{candidate.matchReason}</Typography>}</Box>
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
