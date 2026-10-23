import { ThemaSubjectField } from "./ThemaSubjectField";
import { BookCover } from "./BookCover";
import { MetadataEditorForm } from "./MetadataEditorForm";
import { useCoverCrop } from "./CoverCropDialog";
import { useNavigate } from "react-router-dom";
import { randomId } from "../utils/random-id";
import { CloudUploadOutlined } from "@/ui/icons";
import { DeleteOutlineRounded } from "@/ui/icons";
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
import { IconButton } from "@/ui/buttons";
import { LinearProgress } from "@/ui/feedback";
import { Stack } from "@/ui/primitives";
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

export function BookUploadDialog({ open, initialRootId, onClose }: {
  open: boolean; initialRootId?: string; publishToDisplay?: boolean;
  onClose: () => void; onCompleted: (message: string) => void;
}) {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [local, setLocal] = useState<LocalUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rootsQuery = useQuery({ queryKey: ["library-roots"], queryFn: () => api.listLibraryRoots(), enabled: open });
  const pendingQuery = useQuery({ queryKey: ["book-uploads"], queryFn: api.listBookUploads, enabled: open });
  const writableRoots = useMemo(() => (rootsQuery.data ?? []).filter(isWritable), [rootsQuery.data]);
  const rootId = (writableRoots.find(root => root.id === initialRootId) ?? writableRoots[0])?.id ?? "";
  const completedIds = local.filter(item => item.state === "UPLOADED" && item.uploadId).map(item => item.uploadId!);
  const pendingIds = (pendingQuery.data ?? []).filter(item => ["READY_FOR_REVIEW", "INSPECTING", "ENRICHING"].includes(item.status)).map(item => item.id);
  const editIds = [...new Set([...completedIds, ...pendingIds])];


  // 两个工作循环共享队列游标，限制并发传输；UPLOADED 表示传输成功，尚需校对入库。
  // Two workers share a queue cursor to bound transfers; UPLOADED means transfer success, still requiring review and commit.
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
    navigate(`/library/uploads/${editIds[0]}?${new URLSearchParams({ next: editIds.slice(1).join(",")})}`);
  };
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>上传书籍</DialogTitle>
    <DialogContent>
      <Stack spacing={2}>
        {rootId && <Typography color="text.secondary">书籍书库 · 可用 {formatBytes(writableRoots.find(root => root.id === rootId)?.freeBytes)}</Typography>}
        {rootsQuery.isError && <Alert severity="error">无法加载书库，请关闭后重试。</Alert>}
        {!rootsQuery.isPending && writableRoots.length === 0 && <Alert severity="warning">没有可上传的书库。</Alert>}
        <Box role="button" aria-label="点击或拖入 EPUB 或 PDF" aria-disabled={busy || !rootId} tabIndex={busy || !rootId ? -1 : 0} onClick={() => { if (!busy && rootId) fileInput.current?.click(); }} onKeyDown={(event: any) => { if ((event.key === "Enter" || event.key === " ") && !busy && rootId) { event.preventDefault(); fileInput.current?.click(); } }} onDragOver={(event: any) => event.preventDefault()} onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} sx={{ bgcolor: "background.default", p: 2, textAlign: "center", cursor: busy || !rootId ? "default" : "pointer", "&:focus-visible": { outline: "none", boxShadow: tokens.shadow.focus } }}>
          <CloudUploadOutlined color="primary" sx={{ fontSize: 42 }} /><Typography variant="h5">点击或拖入 EPUB 或 PDF</Typography><Typography color="text.secondary">单次最多20本</Typography>
          <input ref={fileInput} onClick={event => event.stopPropagation()} hidden multiple type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" onChange={(event: any) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
        </Box>
        {local.length > 0 && <LocalQueue items={local} onRemove={id => setLocal(current => current.filter(item => item.id !== id))} />}
        {!busy && editIds.length > 0 && <Alert severity="success">已上传。你可以更改书籍信息，点击“编辑信息”继续。</Alert>}
        {message && <Alert severity="warning">{message}</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      {!busy && editIds.length > 0 ? <Button variant="contained" onClick={edit}>编辑信息</Button> : <Button variant="contained" disabled={busy || !rootId} startIcon={busy ? <CircularProgress size={18} /> : undefined} onClick={() => { const failed = local.filter(item => item.state === "FAILED"); if (failed.length) void start(failed); else fileInput.current?.click(); }}>{busy ? "正在上传…" : "开始上传"}</Button>}
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

export function UploadReview({ upload, onChanged, onCommitted, onCancel, cancelling = false }: { upload: BookUpload; publishToDisplay?: boolean; onChanged: () => Promise<void>; onCommitted: () => Promise<void>; onCancel?: () => Promise<void>; cancelling?: boolean }) {
  const { requestCrop, cropDialog } = useCoverCrop();
  const coverInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<BookMetadataDraft | null>(upload.draftMetadata ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setDraft(upload.draftMetadata ?? null), [upload]);
  if (!draft) return <Alert severity="info">正在准备书籍信息…</Alert>;

  const update = <K extends keyof BookMetadataDraft>(key: K, value: BookMetadataDraft[K]) => setDraft((current) => current ? ({ ...current, [key]: value, sources: { ...current.sources, [key]: "MANUAL" } }) : current);
  const save = async () => run(async () => { await api.updateBookUploadMetadata(upload.id, draft); await onChanged(); });
  const commit = async () => run(async () => { await api.updateBookUploadMetadata(upload.id, draft); await api.commitBookUpload(upload.id, draft.publiclyVisible ?? true); await onCommitted(); });
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
  const coverChanged = async (file: File) => run(async () => { const blob = await requestCrop(file); if (!blob) return; await api.uploadBookCover(upload.id, blob); await onChanged(); });

  return <Stack spacing={2}>
    {cropDialog}
    {upload.similarBookIds.length > 0 && <Alert severity="warning" icon={<WarningAmberRounded />}>发现标题和作者相似的藏书。它不是完全重复文件，确认后仍可作为独立版本入库。</Alert>}
    {(upload.encrypted || upload.drmProtected || upload.digitallySigned) && <Alert severity="warning">该文件包含{upload.encrypted ? "加密" : ""}{upload.drmProtected ? " DRM" : ""}{upload.digitallySigned ? "数字签名" : ""}标记；可以入库，但默认禁止元数据写回原文件。</Alert>}
    <MetadataEditorForm aiEnabled value={{
      title: draft.title, subtitle: draft.subtitle ?? "", authors: draft.authors.join("，"), translators: draft.translators.join("，"),
      language: draft.language ?? "", publisher: draft.publisher ?? "", publishedDate: draft.publishedDate ?? "", isbn: draft.isbn ?? "",
      series: draft.series ?? "", seriesIndex: draft.seriesIndex?.toString() ?? "", tags: draft.tags.join("，"), description: draft.description ?? "", authorBiography: draft.authorBiography ?? "", tableOfContents: draft.tableOfContents ?? "", publiclyVisible: draft.publiclyVisible ?? true,
    }} disabled={busy} onChange={(key, value) => {
      if (key === "publiclyVisible") setDraft(current => current ? { ...current, publiclyVisible: Boolean(value) } : current);
      else if (key === "authors" || key === "translators" || key === "tags") update(key, split(String(value)));
      else if (key === "seriesIndex") update(key, value ? Number(value) : undefined);
      else update(key, String(value));
    }} extraFields={<div style={{ gridColumn: "1 / -1", minWidth: 0 }}><ThemaSubjectField value={draft.subjectCodes ?? []} disabled={busy}
      metadataText={`${draft.title} ${draft.description ?? ''} ${draft.tags.join(' ')}`} onChange={codes => update('subjectCodes', codes)} /></div>} coverUrl={upload.coverUrl} coverAlt={`${draft.title}封面`} coverDetails={
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}><Chip label={upload.format} variant="outlined" /><Chip label={formatBytes(upload.declaredSizeBytes)} variant="outlined" />{(draft.pageCount || draft.wordCount) && <Chip label={draft.pageCount ? `${draft.pageCount} 页` : `${draft.wordCount!.toLocaleString("zh-CN")} 字`} variant="outlined" />}</Stack>
    } coverActions={<>
        <Button variant="outlined" onClick={() => coverInput.current?.click()}>更换封面</Button>
        <input ref={coverInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: any) => { const file = event.target.files?.[0]; if (file) void coverChanged(file); event.target.value = ""; }} />
    </>} />
    {upload.metadataCandidates.length > 0 && <Stack spacing={1.5}><Typography variant="h6">候选书目信息</Typography>{upload.metadataCandidates.map((candidate) => <CandidateCard key={`${candidate.provider}-${candidate.id}`} candidate={candidate} onUse={() => useCandidate(candidate)} onCover={candidate.coverUrl ? () => run(async () => { await api.selectBookUploadCover(upload.id, candidate.id); await onChanged(); }) : undefined} />)}</Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "flex-end", gap: 1.5 }}>
      {onCancel && <Button color="error" disabled={busy || cancelling} onClick={() => void onCancel()}>取消上传</Button>}
      <Button onClick={() => run(async () => { await api.enrichBookUpload(upload.id); await onChanged(); })} disabled={busy}>在线补全</Button>
      <Button color="secondary" onClick={() => run(async () => { await api.aiMatchBookUpload(upload.id); await onChanged(); })} disabled={busy}>AI 匹配</Button>
      <Button variant="outlined" onClick={save} disabled={busy}>保存草稿</Button>
      <Button variant="contained" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined} onClick={commit} disabled={busy || !draft.title.trim() || draft.authors.length === 0}>{busy ? "正在处理…" : "确认入库"}</Button>
    </Stack>
  </Stack>;
}

function CandidateCard({ candidate, onUse, onCover }: { candidate: MetadataCandidate; onUse: () => void; onCover?: () => void }) {
  return <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2, alignItems: { sm: "center" }, border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
    {candidate.coverUrl && <BookCover src={candidate.coverUrl} alt="在线候选封面" sx={{ width: `${tokens.spacing[12]}px` }} />}
    <Box sx={{ flex: 1, minWidth: 0 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="subtitle2">{candidate.title ?? "未命名候选"}</Typography><Chip label={candidate.providerLabel ?? sourceText[candidate.provider]} size="small" />{candidate.requiresReview && <Chip label={`需核对${candidate.confidence != null ? ` · ${Math.round(candidate.confidence * 100)}%` : ""}`} size="small" color="warning" variant="outlined" />}</Stack><Typography variant="caption" color="text.secondary">{candidate.authors?.join(" / ")}{candidate.publisher ? ` · ${candidate.publisher}` : ""}{candidate.publishedDate ? ` · ${candidate.publishedDate}` : ""}</Typography>{candidate.matchReason && <Typography variant="caption" color="text.secondary">{candidate.matchReason}</Typography>}</Box>
    <Stack direction="row" spacing={1}>{onCover && <Button size="small" onClick={onCover}>采用封面</Button>}<Button size="small" variant="outlined" onClick={onUse}>采用信息</Button></Stack>
  </Stack>;
}

function patchLocal(items: LocalUpload[], id: string, patch: Partial<LocalUpload>) { return items.map((item) => item.id === id ? { ...item, ...patch } : item); }
function isWritable(root: LibraryRoot) { return root.status === "ONLINE" && root.canWrite && root.canStage; }
function split(value: string) { return value.split(/[，,;；]/).map((item) => item.trim()).filter(Boolean); }
function formatBytes(value?: number | null) { if (value == null) return "未知"; if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} GB`; if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`; return `${Math.max(1, Math.round(value / 1000))} KB`; }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "操作失败"; }
